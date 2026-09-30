# Secure Authentication API

A Node.js authentication backend built with Express, MongoDB, JWTs, cookies, and email password reset.

For the reusable, route-by-route implementation guide, see [ROUTE_FLOWS.md](ROUTE_FLOWS.md).

## Features

- User registration and login
- JWT access tokens (15 minutes) and refresh tokens (7 days)
- HTTP-only authentication cookies
- Protected current-user and profile-update routes
- Password change, logout, refresh-token rotation
- Email-based, time-limited password reset

## Stack

| Purpose | Technology |
| --- | --- |
| API | Express 5 |
| Database | MongoDB and Mongoose |
| Password hashing | bcrypt |
| Tokens | jsonwebtoken |
| Cookies | cookie-parser |
| Email | Nodemailer / Gmail SMTP |
| Configuration | dotenv |

## Project layout

```text
src/
  config/db.js                     Database connection
  features/auth/
    auth.model.js                  User schema
    auth.route.js                  Endpoint definitions
    auth.controller.js             Request/response logic
    auth.services.js               Database and auth business logic
    auth.middleware.js             JWT authentication
  middlewares/error.middleware.js  Global error handler
  utils/                           Tokens, email, errors, async wrapper
  index.js                         Express application
  server.js                        Starts database and server
```

## Setup

```bash
npm install
npm start
```

Create `.env` in the project root. Keep it out of Git.

```env
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/Project1
ACCESS_TOKEN_SECRET=use-a-long-random-secret
REFRESH_TOKEN_SECRET=use-a-different-long-random-secret
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-google-app-password
FRONTEND_URL=http://localhost:5173
```

For Gmail, enable two-step verification and create a Google App Password. Do not use the normal Google account password.

The server runs on `http://localhost:3000` and uses the `/auth` route prefix.

## API reference

Send JSON request bodies with `Content-Type: application/json`. Protected endpoints accept either the `accessToken` HTTP-only cookie or:

```http
Authorization: Bearer <access-token>
```

| Method | Endpoint | Protected | Description |
| --- | --- | --- | --- |
| POST | `/auth/register` | No | Create a user |
| POST | `/auth/login` | No | Log in and issue tokens |
| POST | `/auth/refresh` | Refresh token | Rotate tokens |
| POST | `/auth/logout` | Yes | End session |
| GET | `/auth/profile` | Yes | Get current user |
| PATCH | `/auth/update-profile` | Yes | Update bio |
| PATCH | `/auth/change-password` | Yes | Change password |
| POST | `/auth/forgot-password` | No | Send reset email |
| POST | `/auth/reset-password/:token` | No | Reset password |

### Register

```http
POST /auth/register

{
  "name": "Asha Kumar",
  "email": "asha@example.com",
  "password": "securepassword123",
  "bio": "Backend learner"
}
```

### Login

```http
POST /auth/login

{
  "email": "asha@example.com",
  "password": "securepassword123"
}
```

### Current profile

```http
GET /auth/profile
Authorization: Bearer <access-token>
```

### Update profile

```http
PATCH /auth/update-profile
Authorization: Bearer <access-token>

{
  "bio": "Learning secure Node.js APIs"
}
```

### Change password

```http
PATCH /auth/change-password
Authorization: Bearer <access-token>

{
  "currentPassword": "securepassword123",
  "newPassword": "anothersecurepassword123"
}
```

### Password reset without a frontend

1. Send:

   ```http
   POST /auth/forgot-password

   { "email": "asha@example.com" }
   ```

2. Open the email and copy the token at the end of the reset URL.

3. Send it directly with Postman:

   ```http
   POST /auth/reset-password/<token-from-email>

   { "newPassword": "anothersecurepassword123" }
   ```

4. Confirm login fails with the old password and succeeds with the new one.

## How it works

On registration/login, the server issues signed access and refresh JWTs. The original tokens go into HTTP-only cookies; only a bcrypt hash of the refresh token is stored in MongoDB. `authenticate` verifies the access token, retrieves the user, and attaches it to `req.user`.

For password reset, the server emails a random raw token but stores only its SHA-256 hash with a 15-minute expiry. During reset, the submitted token is hashed again and matched against the unexpired stored hash. Successful reset removes the reset-token fields.

Fields with `select: false` (password, refresh token, reset token, and reset expiry) are still stored in MongoDB. Mongoose simply hides them in normal query results.

## Production checklist

- Use HTTPS and set cookie `secure: true` in production.
- Do not commit `.env` or credentials.
- Apply the same 10-character password policy in register, change-password, and reset-password flows.
- Clear `refreshToken` after a password change/reset so existing device sessions must log in again.
- Return one generic response for both known and unknown emails on forgot-password.
- Add rate limiting, request validation, CORS settings, tests, and production logging.

## Assignment API naming

The implemented API uses `/auth/profile` and `/auth/update-profile`. To use the assignment's exact convention in a future project, mount the router at `/api/auth` and name routes `GET /me` and `PATCH /profile`.
