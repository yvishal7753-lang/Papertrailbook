# Papertrail Books

A full-stack online bookstore built with React, Express, and MongoDB. Customers can browse, search, and order books with Cash on Delivery. Administrators manage the catalog and fulfillment status from a protected back office.

## Requirements

- Node.js 22.12 or newer and npm (Node.js 24 LTS is recommended)
- MongoDB 6 or newer, running locally or hosted

## Run locally

1. Start MongoDB (for example, `mongod` or a local MongoDB service).
2. Configure and seed the API:

   ```powershell
   cd backend
   Copy-Item .env.example .env
   ```

   Edit `.env`, set a private `JWT_SECRET` of at least 32 random characters, and set a strong admin password. For example, generate the signing secret with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Then run:

   ```powershell
   npm install
   npm run seed
   npm run dev
   ```

   The API runs at `http://localhost:5000`.

3. In another terminal, start the storefront:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

   Open the URL Vite prints (usually `http://localhost:5173`). Vite proxies `/api` requests to the backend.

To run the API without hot reload, use `npm start` in `backend`. To build the frontend bundle, use `npm run build` in `frontend`.

## Environment variables

Copy `backend/.env.example` to `backend/.env` before starting the API.

| Variable | Purpose |
| --- | --- |
| `PORT` | API port (default `5000`) |
| `NODE_ENV` | Set to `production` to mark the session cookie secure |
| `MONGODB_URI` | MongoDB connection URI |
| `JWT_SECRET` | Private signing secret, at least 32 characters |
| `FRONTEND_URL` | Exact storefront origin allowed by CORS |
| `ADMIN_NAME` | Name for the seeded admin |
| `ADMIN_EMAIL` | Email for the seeded admin |
| `ADMIN_PASSWORD` | Initial admin password (10 or more characters, up to 72 UTF-8 bytes) |

Do not commit `.env`. The example leaves the JWT secret and admin password blank intentionally; the API and seed command require you to set them. `npm run seed` creates the administrator only if it does not already exist, and adds the sample catalog only when the books collection is empty. It does not reset an existing password or overwrite catalog data.

## Accounts and checkout

- Create a customer account from **Create an account**. Customer accounts can only be created with the customer role.
- Go to **Administrator sign in** from the sign-in page and use the credentials from `backend/.env`.
- Add books to the bag, enter delivery information, and place the order. Cash on Delivery is the only payment method.
- Customer orders begin in **Pending**. Administrators can update an order to Pending, Confirmed, Shipped, Delivered, or Cancelled. Cancelling an order returns its reserved quantities to stock once.

## API overview

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/admin/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/books`, `GET /api/books/:id` (available catalog and search); administrator-only `GET /api/books/admin`, `POST /api/books`, `PUT /api/books/:id`, `DELETE /api/books/:id`
- Customer-only `POST /api/orders`, `GET /api/orders/mine`, `GET /api/orders/mine/:id`; administrator-only `GET /api/orders`, `PATCH /api/orders/:id/status`
- `GET /api/health`

Sessions use a signed JWT in an HttpOnly cookie. Passwords are hashed with bcrypt. The API validates catalog, account, delivery, quantity, and payment inputs; order placement conditionally reserves stock in MongoDB to avoid accepting quantities beyond current inventory.

## Project structure

```text
backend/
  src/config/       MongoDB connection
  src/middleware/   Authentication, authorization, and errors
  src/models/       User, Book, and Order schemas
  src/routes/       Authentication, catalog, and order APIs
  src/seed.js       Admin and sample catalog setup
frontend/
  src/App.jsx       Storefront, customer account, checkout, and admin UI
  src/api.js        API client and currency formatting
  src/styles.css    Responsive accessible styling
```
