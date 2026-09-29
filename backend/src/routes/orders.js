const express = require('express');
const mongoose = require('mongoose');
const Book = require('../models/Book');
const Order = require('../models/Order');
const { requireAuth, requireAdmin, requireCustomer } = require('../middleware/auth');
const { text } = require('../utils/validation');

const router = express.Router();
const statuses = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];

function validDelivery(delivery) {
  if (!delivery || typeof delivery !== 'object') return false;
  return text(delivery.fullName, 120) && text(delivery.phone, 30) && text(delivery.address, 240) &&
    text(delivery.city, 100) && text(delivery.state, 100) && text(delivery.postalCode, 20);
}

router.post('/', requireAuth, requireCustomer, async (req, res, next) => {
  const decremented = [];
  try {
    const { items, delivery, paymentMethod } = req.body || {};
    if (!Array.isArray(items) || items.length < 1 || items.length > 30 || !validDelivery(delivery)) {
      return res.status(400).json({ message: 'Add at least one book and complete every delivery field.' });
    }
    if (paymentMethod && paymentMethod !== 'Cash on Delivery') return res.status(400).json({ message: 'Cash on Delivery is the only available payment method.' });
    const quantities = new Map();
    for (const item of items) {
      if (!item || !mongoose.isValidObjectId(item.bookId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
        return res.status(400).json({ message: 'Each cart item must have a valid book and a quantity from 1 to 99.' });
      }
      quantities.set(item.bookId, (quantities.get(item.bookId) || 0) + item.quantity);
    }
    if ([...quantities.values()].some((quantity) => quantity > 99)) return res.status(400).json({ message: 'A book quantity cannot exceed 99.' });

    const orderItems = [];
    let total = 0;
    for (const [bookId, quantity] of quantities) {
      const book = await Book.findOneAndUpdate({ _id: bookId, stock: { $gte: quantity } }, { $inc: { stock: -quantity } }, { new: true });
      if (!book) {
        const exists = await Book.exists({ _id: bookId });
        const shortage = exists ? 'One or more books do not have enough stock. Your cart has not been checked out.' : 'A book in your cart is no longer available.';
        const error = new Error(shortage);
        error.status = 409;
        throw error;
      }
      decremented.push({ bookId, quantity });
      const unitPrice = Math.round(book.price * 100) / 100;
      orderItems.push({ book: book._id, title: book.title, author: book.author, price: unitPrice, quantity });
      total += unitPrice * quantity;
    }
    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      delivery: {
        fullName: delivery.fullName.trim(), phone: delivery.phone.trim(), address: delivery.address.trim(),
        city: delivery.city.trim(), state: delivery.state.trim(), postalCode: delivery.postalCode.trim()
      },
      paymentMethod: 'Cash on Delivery',
      total: Math.round(total * 100) / 100,
      status: 'Pending'
    });
    res.status(201).json({ order, message: 'Your order is placed. Payment is due on delivery.' });
  } catch (error) {
    await Promise.allSettled(decremented.map(({ bookId, quantity }) => Book.updateOne({ _id: bookId }, { $inc: { stock: quantity } })));
    next(error);
  }
});

router.get('/mine', requireAuth, requireCustomer, async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();
    res.json({ orders });
  } catch (error) { next(error); }
});

router.get('/mine/:id', requireAuth, requireCustomer, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Order not found.' });
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id }).lean();
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    res.json({ order });
  } catch (error) { next(error); }
});

router.get('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const orders = await Order.find().populate('user', 'name email').sort({ createdAt: -1 }).limit(250).lean();
    res.json({ orders });
  } catch (error) { next(error); }
});

router.patch('/:id/status', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Order not found.' });
    const { status } = req.body || {};
    if (!statuses.includes(status)) return res.status(400).json({ message: `Status must be one of: ${statuses.join(', ')}.` });
    let order;
    if (status === 'Cancelled') {
      order = await Order.findOneAndUpdate(
        { _id: req.params.id, status: { $ne: 'Cancelled' } },
        { status },
        { new: true, runValidators: true }
      );
      if (!order) {
        const exists = await Order.exists({ _id: req.params.id });
        if (!exists) return res.status(404).json({ message: 'Order not found.' });
        return res.status(409).json({ message: 'This order has already been cancelled.' });
      }
      await Promise.all(order.items.map((item) => Book.updateOne({ _id: item.book }, { $inc: { stock: item.quantity } })));
    } else {
      order = await Order.findOneAndUpdate(
        { _id: req.params.id, status: { $ne: 'Cancelled' } },
        { status },
        { new: true, runValidators: true }
      );
      if (!order) {
        const cancelledOrder = await Order.findOne({ _id: req.params.id, status: 'Cancelled' });
        if (!cancelledOrder) return res.status(404).json({ message: 'Order not found.' });
        const reserved = [];
        for (const item of cancelledOrder.items) {
          const book = await Book.findOneAndUpdate({ _id: item.book, stock: { $gte: item.quantity } }, { $inc: { stock: -item.quantity } }, { new: true });
          if (!book) {
            await Promise.all(reserved.map(({ bookId, quantity }) => Book.updateOne({ _id: bookId }, { $inc: { stock: quantity } })));
            return res.status(409).json({ message: 'There is not enough stock to reopen this order.' });
          }
          reserved.push({ bookId: item.book, quantity: item.quantity });
        }
        order = await Order.findOneAndUpdate({ _id: req.params.id, status: 'Cancelled' }, { status }, { new: true, runValidators: true });
        if (!order) {
          await Promise.all(reserved.map(({ bookId, quantity }) => Book.updateOne({ _id: bookId }, { $inc: { stock: quantity } })));
          return res.status(409).json({ message: 'The order status changed. Refresh and try again.' });
        }
      }
    }
    await order.populate('user', 'name email');
    res.json({ order, message: 'Order status updated.' });
  } catch (error) { next(error); }
});

module.exports = router;
