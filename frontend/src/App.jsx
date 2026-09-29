import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, money } from './api';

const AuthContext = createContext(null);
const CartContext = createContext(null);
const NoticeContext = createContext(null);
export const useAuth = () => useContext(AuthContext);
export const useCart = () => useContext(CartContext);
export const useNotice = () => useContext(NoticeContext);

const coverPalettes = [
  ['#66745d', '#d9cbb0'], ['#b96d4f', '#efdfc6'], ['#405b68', '#d8c5a5'],
  ['#8b7355', '#e7d8c1'], ['#697f78', '#e8d4b2'], ['#a55243', '#e1cfae']
];

function BookCover({ book, index = 0, large = false }) {
  const colors = coverPalettes[index % coverPalettes.length];
  if (book.coverImage) return <div className={`book-cover ${large ? 'book-cover-large' : ''}`} style={{ backgroundImage: `url("${book.coverImage}")` }} role="img" aria-label={`Cover of ${book.title}`} />;
  return <div className={`book-cover ${large ? 'book-cover-large' : ''}`} style={{ '--cover': colors[0], '--cover-paper': colors[1] }} aria-hidden="true">
    <span className="cover-mark">P</span><span className="cover-title">{book.title}</span><span className="cover-author">{book.author}</span>
  </div>;
}

function Header({ onCart }) {
  const { user, signOut } = useAuth();
  const { count } = useCart();
  const location = useLocation();
  return <header className="site-header">
    <div className="header-inner">
      <Link to="/" className="brand" aria-label="Papertrail Books home"><span className="brand-mark">p.</span><span>papertrail<span className="brand-books">books</span></span></Link>
      <nav className="main-nav" aria-label="Main navigation">
        <Link className={location.pathname === '/' ? 'nav-active' : ''} to="/">Shop</Link>
        {user?.role === 'customer' && <Link className={location.pathname.startsWith('/orders') ? 'nav-active' : ''} to="/orders">My orders</Link>}
        {user?.role === 'admin' && <Link className={location.pathname.startsWith('/admin') ? 'nav-active' : ''} to="/admin">Store admin</Link>}
      </nav>
      <div className="header-actions">
        <button className="cart-button" onClick={onCart} aria-label={`Open cart with ${count} ${count === 1 ? 'item' : 'items'}`}><span aria-hidden="true">▱</span><span className="cart-label">Bag</span><span className="cart-count">{count}</span></button>
        {user ? <button className="text-button account-button" onClick={signOut} title={`Sign out ${user.name}`}>Sign out</button> : <Link className="text-button account-button" to="/login">Sign in</Link>}
      </div>
    </div>
  </header>;
}

function CartDrawer({ open, close }) {
  const { items, setQuantity, remove, subtotal } = useCart();
  const navigate = useNavigate();
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    return () => { window.removeEventListener('keydown', onKey); document.body.classList.remove('modal-open'); };
  }, [open, close]);
  if (!open) return null;
  return <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && close()}>
    <aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
      <div className="drawer-heading"><div><span className="eyebrow">YOUR SELECTION</span><h2 id="cart-title">Your bag <span className="muted">({items.length})</span></h2></div><button className="icon-button" onClick={close} aria-label="Close bag">×</button></div>
      {items.length === 0 ? <div className="empty-state"><span className="empty-illustration">▱</span><h3>Your next read goes here.</h3><p>Browse the shelves and add a book that catches your eye.</p><button className="button button-dark" onClick={close}>Explore books</button></div> : <>
        <div className="cart-lines">{items.map((item, index) => <div className="cart-line" key={item._id}>
          <BookCover book={item} index={index} /><div className="cart-line-info"><h3>{item.title}</h3><p>{item.author}</p><div className="cart-line-bottom"><div className="quantity-control" aria-label={`Quantity for ${item.title}`}><button onClick={() => setQuantity(item._id, item.quantity - 1)} aria-label="Decrease quantity">−</button><span>{item.quantity}</span><button onClick={() => setQuantity(item._id, item.quantity + 1)} disabled={item.quantity >= item.stock} aria-label="Increase quantity">+</button></div><strong>{money(item.price * item.quantity)}</strong></div><button className="remove-link" onClick={() => remove(item._id)}>Remove</button></div>
        </div>)}</div>
        <div className="cart-footer"><div className="subtotal-row"><span>Subtotal</span><strong>{money(subtotal)}</strong></div><p>Delivery details are added at checkout. Pay when your order arrives.</p><button className="button button-dark button-full" onClick={() => { close(); navigate('/checkout'); }}>Continue to checkout <span>→</span></button><button className="continue-link" onClick={close}>Continue browsing</button></div>
      </>}
    </aside>
  </div>;
}

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cart, setCart] = useState(() => { try { return JSON.parse(localStorage.getItem('papertrail-cart') || '[]'); } catch { return []; } });
  const [notice, setNotice] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    api('/auth/me').then(({ user: current }) => setUser(current)).catch(() => setUser(null)).finally(() => setAuthLoading(false));
  }, []);
  useEffect(() => { localStorage.setItem('papertrail-cart', JSON.stringify(cart)); }, [cart]);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const cartValue = useMemo(() => ({
    items: cart,
    count: cart.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    add: (book) => setCart((current) => {
      const exists = current.find((item) => item._id === book._id);
      if (exists) return current.map((item) => item._id === book._id ? { ...item, quantity: Math.min(item.quantity + 1, book.stock) } : item);
      return [...current, { ...book, quantity: 1 }];
    }),
    setQuantity: (id, quantity) => setCart((current) => quantity < 1 ? current.filter((item) => item._id !== id) : current.map((item) => item._id === id ? { ...item, quantity: Math.min(quantity, item.stock) } : item)),
    remove: (id) => setCart((current) => current.filter((item) => item._id !== id)),
    clear: () => setCart([])
  }), [cart]);
  const signOut = async () => {
    try { await api('/auth/logout', { method: 'POST' }); } finally { setUser(null); window.location.assign('/'); }
  };

  return <AuthContext.Provider value={{ user, setUser, authLoading, signOut }}><CartContext.Provider value={cartValue}><NoticeContext.Provider value={(message, type = 'success') => setNotice({ message, type })}>
    <Header onCart={() => setCartOpen(true)} />
    <main>
      <Routes>
        <Route path="/" element={<ShopPage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/register" element={<AuthPage register />} />
        <Route path="/admin/login" element={<AuthPage admin />} />
        <Route path="/checkout" element={<CustomerGuard><CheckoutPage /></CustomerGuard>} />
        <Route path="/orders" element={<CustomerGuard><OrdersPage /></CustomerGuard>} />
        <Route path="/orders/:orderId" element={<CustomerGuard><OrdersPage /></CustomerGuard>} />
        <Route path="/admin/*" element={<AdminGuard><AdminPage /></AdminGuard>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </main>
    <footer className="site-footer"><div className="footer-inner"><Link to="/" className="brand footer-brand"><span className="brand-mark">p.</span><span>papertrail<span className="brand-books">books</span></span></Link><p>A little more room for a good story.</p><span>© {new Date().getFullYear()} Papertrail Books</span></div></footer>
    <CartDrawer open={cartOpen} close={() => setCartOpen(false)} />
    {notice && <div className={`toast toast-${notice.type}`} role="status" aria-live="polite"><span>{notice.type === 'error' ? '!' : '✓'}</span>{notice.message}<button onClick={() => setNotice(null)} aria-label="Dismiss message">×</button></div>}
  </NoticeContext.Provider></CartContext.Provider></AuthContext.Provider>;
}

function CustomerGuard({ children }) {
  const { user, authLoading } = useAuth();
  const location = useLocation();
  if (authLoading) return <PageLoading />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (user.role !== 'customer') return <Navigate to="/admin" replace />;
  return children;
}

function AdminGuard({ children }) {
  const { user, authLoading } = useAuth();
  if (authLoading) return <PageLoading />;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function PageLoading() { return <div className="page-loading" role="status"><span className="spinner" /> Loading your bookstore…</div>; }
function NotFound() { return <section className="simple-page"><span className="eyebrow">404 · LOST IN THE STACKS</span><h1>This page wandered off.</h1><Link className="button button-dark" to="/">Back to the shop</Link></section>; }

function ShopPage() {
  const [books, setBooks] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const { add } = useCart();
  const notify = useNotice();
  useEffect(() => {
    let live = true;
    setLoading(true); setError('');
    const timer = window.setTimeout(() => api(`/books${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''}`)
      .then(({ books: results }) => { if (live) setBooks(results); })
      .catch((e) => { if (live) setError(e.message); })
      .finally(() => { if (live) setLoading(false); }), search ? 240 : 0);
    return () => { live = false; window.clearTimeout(timer); };
  }, [search]);
  return <>
    <section className="hero"><div className="hero-text"><span className="eyebrow">A BOOKSHOP FOR THE CURIOUS</span><h1>Stories worth<br /><em>keeping.</em></h1><p>Find the book that feels like it found you. Thoughtfully picked reads, delivered to your door.</p><a className="hero-link" href="#shelves">Explore the shelves <span>↓</span></a></div><div className="hero-art" aria-hidden="true"><div className="hero-sun" /><div className="hero-stilllife"><div className="hero-book hero-book-one" /><div className="hero-book hero-book-two" /><div className="hero-vase"><span /></div><div className="hero-stem stem-one" /><div className="hero-stem stem-two" /></div><span className="hero-art-caption">A good place to begin</span></div></section>
    <section className="shop-section" id="shelves"><div className="section-heading"><div><span className="eyebrow">THE PAPERTRAIL EDIT</span><h2>On our shelves</h2><p>Books with something to say, and space to stay.</p></div><label className="search-box"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, author…" aria-label="Search books" /><kbd>⌘ K</kbd></label></div>
      {loading ? <div className="loading-grid">{[1, 2, 3, 4].map((i) => <div className="skeleton-card" key={i}><div /><span /><span /></div>)}</div> : error ? <div className="state-card"><h3>We couldn’t load the shelves.</h3><p>{error}</p><button className="button button-outline" onClick={() => setSearch(`${search} `)}>Try again</button></div> : books.length === 0 ? <div className="state-card"><div className="empty-illustration">⌕</div><h3>No books found</h3><p>Try a different title, author, or category.</p><button className="text-button" onClick={() => setSearch('')}>Clear search</button></div> : <div className="book-grid">{books.map((book, index) => <article className="book-card" key={book._id}>
        <button className="cover-button" onClick={() => setSelected({ book, index })} aria-label={`View details for ${book.title}`}><BookCover book={book} index={index} /><span className="cover-detail">Quick look <span>↗</span></span></button>
        <div className="book-meta"><span className="category-label">{book.category || 'From the shelves'}</span><h3>{book.title}</h3><p className="book-author">by {book.author}</p><div className="book-buy-row"><strong>{money(book.price)}</strong><button className="add-button" onClick={() => { add(book); notify('Added to your bag.'); }} aria-label={`Add ${book.title} to bag`}>Add <span>+</span></button></div><span className="stock-note">{book.stock < 5 ? `Only ${book.stock} left` : 'In stock · Ready to ship'}</span></div>
      </article>)}</div>}
    </section>
    <section className="promise-strip"><div><span>01</span><strong>Picked with care</strong><p>Every title has a reason to be here.</p></div><div><span>02</span><strong>Delivered with care</strong><p>Thoughtfully packed, right to your door.</p></div><div><span>03</span><strong>Pay when it arrives</strong><p>Every order is cash on delivery.</p></div></section>
    {selected && <BookModal book={selected.book} index={selected.index} close={() => setSelected(null)} />}
  </>;
}

function BookModal({ book, index, close }) {
  const { add } = useCart(); const notify = useNotice();
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && close();
    document.body.classList.add('modal-open');
    window.addEventListener('keydown', onKey);
    return () => { document.body.classList.remove('modal-open'); window.removeEventListener('keydown', onKey); };
  }, [close]);
  return <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && close()}><section className="book-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="icon-button modal-close" onClick={close} aria-label="Close book details">×</button><BookCover book={book} index={index} large /><div className="modal-copy"><span className="eyebrow">{book.category || 'PAPERTRAIL PICK'}</span><h2 id="modal-title">{book.title}</h2><p className="book-author">by {book.author}</p><p className="modal-description">{book.description}</p><div className="modal-price"><strong>{money(book.price)}</strong><span>{book.stock < 5 ? `Only ${book.stock} remaining` : 'In stock and ready to ship'}</span></div><button className="button button-dark button-full" onClick={() => { add(book); notify('Added to your bag.'); close(); }}>Add to your bag <span>→</span></button></div></section></div>;
}

function AuthPage({ register = false, admin = false }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user, setUser, authLoading } = useAuth();
  const navigate = useNavigate(); const location = useLocation();
  if (authLoading) return <PageLoading />;
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />;
  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  const submit = async (event) => {
    event.preventDefault(); setError('');
    if (register && (form.password.length < 10 || new TextEncoder().encode(form.password).length > 72)) return setError('Use a password with at least 10 characters and no more than 72 UTF-8 bytes.');
    setLoading(true);
    try {
      const { user: signedIn } = await api(admin ? '/auth/admin/login' : register ? '/auth/register' : '/auth/login', { method: 'POST', body: JSON.stringify(form) });
      setUser(signedIn); navigate(admin ? '/admin' : location.state?.from || '/', { replace: true });
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  return <section className="auth-layout"><div className="auth-aside"><span className="eyebrow">{admin ? 'STAFF ROOM' : 'WELCOME TO PAPERTRAIL'}</span><h1>{admin ? <>Behind the<br /><em>bookshop.</em></> : <>Make room<br />for a <em>story.</em></>}</h1><p>{admin ? 'The shelves, orders, and small details that keep this place running.' : 'A good read is closer than you think. Sign in to pick up where you left off.'}</p><span className="auth-aside-flower" aria-hidden="true">✳</span></div><div className="auth-card"><span className="eyebrow">{admin ? 'ADMINISTRATOR ACCESS' : register ? 'YOUR NEXT CHAPTER' : 'YOUR READING NOOK'}</span><h2>{admin ? 'Admin sign in' : register ? 'Create your account' : 'Welcome back'}</h2><p className="auth-intro">{admin ? 'Sign in with your administrator account.' : register ? 'Join us and keep all your orders in one place.' : 'Sign in to see your orders and saved details.'}</p>
    <form onSubmit={submit} className="form-stack">{register && <label>Full name<input required name="name" autoComplete="name" maxLength="100" value={form.name} onChange={update} placeholder="Your name" /></label>}<label>Email address<input required type="email" name="email" autoComplete="email" maxLength="254" value={form.email} onChange={update} placeholder="you@example.com" /></label><label>Password<input required type="password" name="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 10 : undefined} maxLength="72" value={form.password} onChange={update} placeholder={register ? 'At least 10 characters' : 'Your password'} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}<button className="button button-dark button-full" disabled={loading}>{loading ? <><span className="spinner spinner-light" /> Signing you in…</> : <>{register ? 'Create account' : 'Sign in'} <span>→</span></>}</button>
    </form>{admin ? <p className="auth-switch"><Link to="/">← Back to the shop</Link></p> : <p className="auth-switch">{register ? 'Already have an account?' : 'New to Papertrail?'} <Link to={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create an account'}</Link></p>}
    {!admin && <Link className="admin-entry" to="/admin/login">Administrator sign in <span>↗</span></Link>}
  </div></section>;
}

function CheckoutPage() {
  const { items, subtotal, clear } = useCart(); const { user } = useAuth(); const notify = useNotice(); const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: user?.name || '', phone: '', address: '', city: '', state: '', postalCode: '' });
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  const submit = async (event) => {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      const { order, message } = await api('/orders', { method: 'POST', body: JSON.stringify({ items: items.map((item) => ({ bookId: item._id, quantity: item.quantity })), delivery: form, paymentMethod: 'Cash on Delivery' }) });
      clear(); notify(message); navigate(`/orders/${order._id}`);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  if (!items.length) return <Navigate to="/" replace />;
  return <section className="checkout-page"><div className="page-heading"><span className="eyebrow">ALMOST YOURS</span><h1>Make it a good delivery.</h1><p>Tell us where to send your books. Payment is due when they arrive.</p></div><div className="checkout-columns"><form className="checkout-form" onSubmit={submit}><div className="checkout-step"><span>01</span><div><h2>Delivery details</h2><p>Where should we send your order?</p></div></div><div className="field-grid"><label className="field-wide">Full name<input name="fullName" required maxLength="120" autoComplete="name" value={form.fullName} onChange={update} /></label><label>Phone number<input name="phone" required type="tel" maxLength="30" autoComplete="tel" value={form.phone} onChange={update} placeholder="For delivery updates" /></label><label className="field-wide">Street address<input name="address" required maxLength="240" autoComplete="street-address" value={form.address} onChange={update} /></label><label>City<input name="city" required maxLength="100" autoComplete="address-level2" value={form.city} onChange={update} /></label><label>State / region<input name="state" required maxLength="100" autoComplete="address-level1" value={form.state} onChange={update} /></label><label>Postal code<input name="postalCode" required maxLength="20" autoComplete="postal-code" value={form.postalCode} onChange={update} /></label></div><div className="checkout-step payment-step"><span>02</span><div><h2>Payment</h2><p>Simple, safe, and paid at your door.</p><div className="cod-choice"><span className="cod-icon">◉</span><span><strong>Cash on Delivery</strong><small>Pay in cash when your books arrive.</small></span><span className="radio-check">✓</span></div></div></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-dark button-full place-order" disabled={loading}>{loading ? <><span className="spinner spinner-light" /> Placing your order…</> : <>Place order · {money(subtotal)} <span>→</span></>}</button><p className="checkout-footnote">By placing your order, you agree to receive it at the delivery address above.</p></form>
    <aside className="order-summary"><span className="eyebrow">YOUR ORDER</span><h2>In the bag <span className="muted">({items.reduce((sum, item) => sum + item.quantity, 0)})</span></h2>{items.map((item, index) => <div className="summary-item" key={item._id}><BookCover book={item} index={index} /><div><strong>{item.title}</strong><span>{item.quantity} × {money(item.price)}</span></div><strong>{money(item.quantity * item.price)}</strong></div>)}<div className="summary-total"><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div className="cod-reminder"><span>✓</span><p>Cash on Delivery<br /><small>No online payment needed.</small></p></div></aside></div></section>;
}

function OrdersPage() {
  const { orderId } = useParams();
  const [orders, setOrders] = useState([]); const [selected, setSelected] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => {
    let live = true; setLoading(true); setError(''); setSelected(null);
    const load = orderId ? api(`/orders/mine/${orderId}`).then(({ order }) => ({ detail: order })) : api('/orders/mine').then(({ orders: list }) => ({ list }));
    load.then((result) => { if (live) { if (result.detail) setSelected(result.detail); else setOrders(result.list); } }).catch((e) => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [orderId]);
  if (loading) return <PageLoading />;
  return <section className="orders-page"><div className="page-heading"><span className="eyebrow">YOUR PAPERTRAIL</span><h1>{selected ? 'Order details' : 'Your orders'}</h1><p>{selected ? 'The latest word on your delivery.' : 'A little history of the stories coming your way.'}</p></div>{error ? <div className="state-card"><h3>We couldn’t load your order.</h3><p>{error}</p><Link className="button button-outline" to="/orders">Back to orders</Link></div> : selected ? <OrderDetail order={selected} /> : orders.length === 0 ? <div className="state-card"><div className="empty-illustration">▤</div><h3>No orders just yet.</h3><p>Your order history will appear here after checkout.</p><Link className="button button-dark" to="/">Find a book</Link></div> : <div className="orders-list">{orders.map((order) => <Link to={`/orders/${order._id}`} className="order-card" key={order._id}><div className="order-card-top"><span className="order-number">ORDER #{order._id.slice(-7).toUpperCase()}</span><StatusPill status={order.status} /><span className="order-date">{new Date(order.createdAt).toLocaleDateString()}</span></div><div className="order-card-bottom"><div><strong>{order.items.reduce((sum, item) => sum + item.quantity, 0)} {order.items.reduce((sum, item) => sum + item.quantity, 0) === 1 ? 'book' : 'books'}</strong><span>{order.items.map((item) => item.title).join(', ')}</span></div><strong>{money(order.total)}</strong><span className="order-arrow">→</span></div></Link>)}</div>}</section>;
}

function OrderDetail({ order }) {
  return <div className="order-detail-layout"><div className="order-detail-main"><Link to="/orders" className="back-link">← All orders</Link><div className="detail-title-row"><div><span className="order-number">ORDER #{order._id.slice(-7).toUpperCase()}</span><h2>Order placed {new Date(order.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</h2></div><StatusPill status={order.status} /></div><div className="status-progress"><div className={`progress-step ${['Pending', 'Confirmed', 'Shipped', 'Delivered'].includes(order.status) ? 'complete' : ''}`}><span>✓</span><small>Order placed</small></div><div className={`progress-step ${['Confirmed', 'Shipped', 'Delivered'].includes(order.status) ? 'complete' : ''}`}><span>✓</span><small>Confirmed</small></div><div className={`progress-step ${['Shipped', 'Delivered'].includes(order.status) ? 'complete' : ''}`}><span>✓</span><small>On the way</small></div><div className={`progress-step ${order.status === 'Delivered' ? 'complete' : ''}`}><span>✓</span><small>Delivered</small></div></div>{order.status === 'Cancelled' && <div className="cancelled-note">This order was cancelled. Please contact us if you need help.</div>}<div className="detail-section"><h3>Items in this order</h3>{order.items.map((item) => <div className="detail-item" key={item.book}><div className="mini-cover">P</div><div><strong>{item.title}</strong><span>by {item.author} · Qty {item.quantity}</span></div><strong>{money(item.price * item.quantity)}</strong></div>)}<div className="summary-total"><span>Total · Cash on Delivery</span><strong>{money(order.total)}</strong></div></div></div><aside className="delivery-card"><span className="eyebrow">DELIVERING TO</span><h3>{order.delivery.fullName}</h3><p>{order.delivery.address}<br />{order.delivery.city}, {order.delivery.state} {order.delivery.postalCode}</p><p>{order.delivery.phone}</p><div className="delivery-payment"><span>◉</span><div><strong>Cash on Delivery</strong><small>Pay when your books arrive.</small></div></div></aside></div>;
}

function StatusPill({ status }) { return <span className={`status-pill status-${status.toLowerCase()}`}>{status}</span>; }

function AdminPage() {
  const [tab, setTab] = useState(window.location.pathname.includes('books') ? 'books' : 'orders');
  const [books, setBooks] = useState([]); const [orders, setOrders] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [editing, setEditing] = useState(null); const [refresh, setRefresh] = useState(0);
  const notify = useNotice(); const location = useLocation(); const navigate = useNavigate();
  useEffect(() => { setTab(location.pathname.includes('books') ? 'books' : 'orders'); }, [location.pathname]);
  useEffect(() => {
    let live = true; setLoading(true); setError('');
    Promise.all([api('/books/admin'), api('/orders')]).then(([bookData, orderData]) => { if (live) { setBooks(bookData.books); setOrders(orderData.orders); } }).catch((e) => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [refresh]);
  const changeStatus = async (id, status) => {
    try { await api(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); notify('Order status updated.'); setRefresh((n) => n + 1); }
    catch (e) { notify(e.message, 'error'); }
  };
  const deleteBook = async (book) => {
    if (!window.confirm(`Remove “${book.title}” from the catalog?`)) return;
    try { await api(`/books/${book._id}`, { method: 'DELETE' }); notify('Book removed from the catalog.'); setRefresh((n) => n + 1); }
    catch (e) { notify(e.message, 'error'); }
  };
  return <section className="admin-page"><div className="admin-heading"><div><span className="eyebrow">THE PAPERTRAIL BACK OFFICE</span><h1>Good afternoon, <em>admin.</em></h1><p>A clear view of the shelves and the orders coming through.</p></div><div className="admin-stats"><div><span>LIVE TITLES</span><strong>{books.length}</strong></div><div><span>OPEN ORDERS</span><strong>{orders.filter((order) => !['Delivered', 'Cancelled'].includes(order.status)).length}</strong></div></div></div><div className="admin-tabs" role="tablist"><button role="tab" aria-selected={tab === 'orders'} className={tab === 'orders' ? 'tab-active' : ''} onClick={() => navigate('/admin')}>Orders <span>{orders.length}</span></button><button role="tab" aria-selected={tab === 'books'} className={tab === 'books' ? 'tab-active' : ''} onClick={() => navigate('/admin/books')}>Books <span>{books.length}</span></button></div>
    {loading ? <PageLoading /> : error ? <div className="state-card"><h3>We couldn’t load the admin workspace.</h3><p>{error}</p><button className="button button-outline" onClick={() => setRefresh((n) => n + 1)}>Try again</button></div> : tab === 'orders' ? <section className="admin-section"><div className="table-heading"><div><h2>Customer orders</h2><p>Review delivery details and keep each order moving.</p></div></div>{orders.length ? <div className="table-scroll"><table className="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Placed</th><th>Delivery</th><th>Total · COD</th><th>Status</th></tr></thead><tbody>{orders.map((order) => <tr key={order._id}><td><strong>#{order._id.slice(-7).toUpperCase()}</strong><small>{order.items.map((item) => `${item.title} ×${item.quantity}`).join(', ')}</small></td><td>{order.user?.name || 'Customer'}<small>{order.user?.email}</small></td><td>{new Date(order.createdAt).toLocaleDateString()}</td><td><span>{order.delivery.fullName}</span><small>{order.delivery.address}, {order.delivery.city}, {order.delivery.state} {order.delivery.postalCode}</small><small>{order.delivery.phone}</small></td><td>{money(order.total)}</td><td><label className="status-select-label"><span className="sr-only">Status for order {order._id}</span><select value={order.status} onChange={(event) => changeStatus(order._id, event.target.value)}>{['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].map((status) => <option key={status}>{status}</option>)}</select></label></td></tr>)}</tbody></table></div> : <div className="state-card"><h3>No orders have arrived yet.</h3><p>New customer orders will show up here.</p></div>}</section> : <section className="admin-section"><div className="table-heading"><div><h2>Book catalog</h2><p>Add titles, adjust prices, and keep stock current.</p></div><button className="button button-dark" onClick={() => setEditing({})}>Add a book <span>+</span></button></div>{books.length ? <div className="table-scroll"><table className="admin-table books-table"><thead><tr><th>Book</th><th>Category</th><th>Price</th><th>Stock</th><th>Actions</th></tr></thead><tbody>{books.map((book, index) => <tr key={book._id}><td className="catalog-book"><BookCover book={book} index={index} /><div><strong>{book.title}</strong><small>{book.author}</small></div></td><td>{book.category}</td><td>{money(book.price)}</td><td><span className={book.stock === 0 ? 'stock-empty' : ''}>{book.stock}</span></td><td><button className="table-action" onClick={() => setEditing(book)}>Edit</button><button className="table-action delete-action" onClick={() => deleteBook(book)}>Remove</button></td></tr>)}</tbody></table></div> : <div className="state-card"><h3>Your catalog is ready for its first title.</h3><button className="button button-dark" onClick={() => setEditing({})}>Add a book <span>+</span></button></div>}</section>}
    {editing && <BookEditor book={editing} close={() => setEditing(null)} saved={() => { setEditing(null); setRefresh((n) => n + 1); notify(editing._id ? 'Book details updated.' : 'Book added to the catalog.'); }} />}
  </section>;
}

function BookEditor({ book, close, saved }) {
  const [form, setForm] = useState({ title: book.title || '', author: book.author || '', description: book.description || '', price: book.price ?? '', stock: book.stock ?? '', category: book.category || '', isbn: book.isbn || '', coverImage: book.coverImage || '' });
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && close();
    document.body.classList.add('modal-open');
    window.addEventListener('keydown', onKey);
    return () => { document.body.classList.remove('modal-open'); window.removeEventListener('keydown', onKey); };
  }, [close]);
  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  const submit = async (event) => {
    event.preventDefault(); setLoading(true); setError('');
    try { await api(book._id ? `/books/${book._id}` : '/books', { method: book._id ? 'PUT' : 'POST', body: JSON.stringify({ ...form, price: Number(form.price), stock: Number(form.stock) }) }); saved(); }
    catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  return <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && close()}><section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="editor-title"><div className="drawer-heading"><div><span className="eyebrow">CATALOG DETAILS</span><h2 id="editor-title">{book._id ? 'Edit this book' : 'Add a book'}</h2></div><button className="icon-button" onClick={close} aria-label="Close editor">×</button></div><form className="form-stack editor-form" onSubmit={submit}><label>Book title<input name="title" required maxLength="180" value={form.title} onChange={update} /></label><div className="field-grid"><label>Author<input name="author" required maxLength="120" value={form.author} onChange={update} /></label><label>Category<input name="category" maxLength="80" value={form.category} onChange={update} placeholder="Literary fiction" /></label><label>Price (USD)<input name="price" type="number" required min="0.01" step="0.01" value={form.price} onChange={update} /></label><label>Stock quantity<input name="stock" type="number" required min="0" step="1" value={form.stock} onChange={update} /></label><label>ISBN <span className="optional-label">optional</span><input name="isbn" maxLength="20" value={form.isbn} onChange={update} /></label><label>Cover image URL <span className="optional-label">optional</span><input name="coverImage" type="url" maxLength="1000" value={form.coverImage} onChange={update} /></label></div><label>Description<textarea name="description" required maxLength="3000" rows="4" value={form.description} onChange={update} /></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="editor-actions"><button type="button" className="button button-outline" onClick={close}>Cancel</button><button className="button button-dark" disabled={loading}>{loading ? 'Saving…' : book._id ? 'Save changes' : 'Add to catalog'}</button></div></form></section></div>;
}

export default App;
