# Role-Based Admin Dashboard API

A Node.js, Express, MongoDB backend for authentication and role-based access control (RBAC). It separates normal-user account actions from administrator-only user management.

## Features

- Registration, login, refresh-token rotation, logout, and profile management
- Password change, forgot-password email, and password reset
- HTTP-only token cookies and Bearer-token support
- Roles: `USER`, `ADMIN`, and `MODERATOR`
- Admin-only user listing, creation, deletion, bans, unbans, and role changes
- Password/refresh-token hashing and centralized error handling

## Stack

| Technology/package | Purpose |
| --- | --- |
| Node.js | Runtime |
| Express 5 | HTTP server, routes, middleware |
| MongoDB + Mongoose | Database, schema validation, queries |
| bcrypt | Password and refresh-token hashing |
| jsonwebtoken | Access and refresh JWTs |
| cookie-parser | Reads authentication cookies |
| dotenv | Environment variables |
| Nodemailer | Password-reset email |
| Node `crypto` | Reset-token generation and hashing |

## Project layout

```text
src/
  config/db.js                 MongoDB connection
  features/auth/               auth, profile, tokens, password recovery
  features/admin/              admin user-management routes
  middlewares/error.middleware.js
  utils/                       errors, async wrapper, email, JWT helpers
  index.js                     Express app and mounted routers
  server.js                    startup and DB connection
```

## Setup

```bash
npm install
npm start
```

Create `.env` first:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/role_based_api
ACCESS_TOKEN_SECRET=a-long-random-secret
REFRESH_TOKEN_SECRET=a-different-long-random-secret
EMAIL_USER=your-email-address
EMAIL_PASSWORD=your-email-app-password
FRONTEND_URL=http://localhost:3000
```

Verify the server: `GET http://localhost:5000/health`.

## Roles and permissions

| Role | Permissions |
| --- | --- |
| `USER` | Login, own profile view/update, password management, logout |
| `ADMIN` | All user capabilities plus all `/admin` routes |
| `MODERATOR` | Valid stored role; no moderator-specific route is implemented yet |

New users receive the least-privileged default role:

```js
role: { type: String, enum: ['USER', 'ADMIN', 'MODERATOR'], default: 'USER' }
```

All user-management routes are protected by:

```js
router.use(authenticate, authorize('ADMIN'))
```

`authenticate` proves identity and sets `req.user`; `authorize('ADMIN')` checks permission.

## Authentication design

1. bcrypt hashes passwords before storage.
2. Register/login creates a 15-minute access JWT and 7-day refresh JWT.
3. MongoDB stores only the bcrypt hash of the refresh token.
4. Raw tokens are set as HTTP-only cookies; the access token is also returned for API testing.
5. Protected routes accept the cookie or `Authorization: Bearer <token>`.
6. Refresh rotates tokens. Logout, bans, password changes, and resets invalidate the stored refresh token.

## API reference

Base URL: `http://localhost:5000`

### Public routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/health` | Server health check |
| GET | `/` | API home response |
| POST | `/auth/register` | Register a regular user |
| POST | `/auth/login` | Login a valid, unbanned user |
| POST | `/auth/refresh` | Rotate refresh token |
| POST | `/auth/forgot-password` | Send reset-password email |
| POST | `/auth/reset-password/:token` | Reset password with one-time token |
| POST | `/admin/login` | Login an `ADMIN` account |

### Authenticated user routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/auth/profile` | View own profile |
| PATCH | `/auth/update-profile` | Update own `bio` |
| PATCH | `/auth/change-password` | Change password |
| POST | `/auth/logout` | Revoke refresh session and clear cookies |

### Administrator-only routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/admin/users` | List safe user data |
| POST | `/admin/users` | Create a `USER` account |
| DELETE | `/admin/users/:id` | Delete another user |
| PATCH | `/admin/users/:id/ban` | Ban user and revoke refresh token |
| PATCH | `/admin/users/:id/unban` | Remove ban |
| PATCH | `/admin/users/:id/role` | Set `USER`, `ADMIN`, or `MODERATOR` |

## Request examples

```http
POST /auth/register
Content-Type: application/json

{
  "name": "Asha Singh",
  "email": "asha@example.com",
  "password": "password1234",
  "bio": "Backend learner"
}
```

```http
GET /auth/profile
Authorization: Bearer <accessToken>
```

```http
PATCH /admin/users/<userId>/role
Authorization: Bearer <adminAccessToken>
Content-Type: application/json

{ "role": "MODERATOR" }
```

## Postman quick test

1. Call `/auth/register` or `/auth/login`.
2. Add this in the login request's **Tests** tab:

   ```js
   pm.environment.set('accessToken', pm.response.json().accessToken)
   ```

3. Call `/auth/profile` with `Authorization: Bearer {{accessToken}}`.
4. Promote a test account to `ADMIN` in MongoDB Compass, login at `/admin/login`, then request `/admin/users`.
5. Request `/admin/users` with a normal-user token and expect `403`.

## Production checklist

- Use HTTPS and `secure: true` cookies in production.
- Add CORS, request validation, rate limiting, tests, and admin audit logs.
- Use an app password/production email provider.
- Never commit `.env` secrets.

See [ROUTE_FLOWS.md](ROUTE_FLOWS.md) for the reusable implementation flow of every route.
