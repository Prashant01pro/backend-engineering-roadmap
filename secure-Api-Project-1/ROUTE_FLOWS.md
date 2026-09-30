# Authentication Route Flows

Use this as a repeatable recipe for a future authentication backend.

```text
Route -> middleware (if protected) -> controller -> service -> model/database -> response
```

## Shared components

| Component | Purpose | Topics / packages |
| --- | --- | --- |
| `User` model | User fields; hides secrets by default | Mongoose, schema validation, `select: false` |
| `catchAsync` and `AppError` | Forward async errors and create safe HTTP errors | Express error handling |
| `authenticate` | Validates access JWT and sets `req.user` | jsonwebtoken, cookies, authorization |
| `token.js` | Creates 15-minute access and 7-day refresh JWTs | jsonwebtoken, expiration |
| `sendEmail` | Sends reset link | Nodemailer, SMTP |

## Register — `POST /auth/register`

**Input:** `name`, `email`, `password`, optional `bio`

1. Validate required fields.
2. Check duplicates with `User.findOne({ $or: [{ name }, { email }] })`.
3. Hash password: `bcrypt.hash(password, 12)`.
4. Create the user with the hash.
5. Sign access and refresh tokens using `user._id`.
6. Hash the refresh token before storing it in the user document.
7. Put raw tokens in HTTP-only cookies and return safe user fields.

**Topics:** validation, unique records, password hashing, JWT signing, cookies.  
**Packages:** Express, Mongoose, bcrypt, jsonwebtoken, cookie-parser.

## Login — `POST /auth/login`

**Input:** `email`, `password`

1. Validate email and password.
2. Fetch user with `User.findOne({ email }).select('+password')` because password is hidden by default.
3. Verify with `bcrypt.compare(password, user.password)`.
4. Generate new access/refresh tokens.
5. Hash and store the new refresh token; send raw tokens as HTTP-only cookies.

**Topics:** credential verification, hidden model fields, token issuance.  
**Packages:** Express, Mongoose, bcrypt, jsonwebtoken, cookie-parser.

## Authentication middleware — used on protected routes

1. Read access token from `req.cookies.accessToken` or `Authorization: Bearer <token>`.
2. Reject absent token with `401`.
3. Verify it with `jwt.verify()`.
4. Load `decoded.userId`, excluding password and refresh token.
5. Set `req.user = user`; call `next()`.
6. Controllers use `req.user._id`. `userId` is in the JWT payload, while `_id` is on the MongoDB user document.

**Topics:** middleware, bearer tokens, JWT verification, authorization.  
**Packages:** Express, jsonwebtoken, cookie-parser, Mongoose.

## Get profile — `GET /auth/profile`

**Protection:** `authenticate`

1. Route runs authentication middleware.
2. Middleware has already loaded the safe user record.
3. Return `req.user` with status `200`.

**Topics:** protected route, middleware reuse, safe response data.  
**Packages:** Express, jsonwebtoken, Mongoose.

## Update profile — `PATCH /auth/update-profile`

**Protection:** `authenticate`  
**Input:** optional `bio`

1. Read only permitted fields from the request—this project allowlists `bio`.
2. Get owner id from `req.user._id`.
3. Build an `updates` object; never pass the whole `req.body` to the database.
4. Call `findByIdAndUpdate(id, updates, { returnDocument: 'after', runValidators: true })`.
5. Exclude secret fields in the response.

**Topics:** PATCH, allowlisting, ownership authorization, update validation.  
**Packages:** Express, Mongoose, jsonwebtoken.

## Change password — `PATCH /auth/change-password`

**Protection:** `authenticate`  
**Input:** `currentPassword`, `newPassword`

1. Get `req.user._id`.
2. Fetch user with `.select('+password')`.
3. Compare current password against stored hash.
4. Reject an unchanged or policy-violating password.
5. Hash and save the new password.
6. Set `user.refreshToken = null` before saving to invalidate refresh-token sessions on other devices.

**Topics:** re-authentication, password policy, bcrypt, session invalidation.  
**Packages:** Express, Mongoose, bcrypt, jsonwebtoken.

## Refresh session — `POST /auth/refresh`

**Input:** refresh-token cookie or request-body `refresh`

1. Read and verify refresh JWT using `REFRESH_TOKEN_SECRET`.
2. Find the identified user.
3. Compare supplied raw token with the stored bcrypt hash.
4. Generate a new access/refresh pair.
5. Hash/store the new refresh token and set fresh cookies.

**Topics:** token expiry, refresh rotation, session renewal.  
**Packages:** Express, Mongoose, bcrypt, jsonwebtoken, cookie-parser.

## Logout — `POST /auth/logout`

**Protection:** `authenticate`

1. Obtain `req.user._id`.
2. Set `refreshToken: null` in MongoDB.
3. Clear both token cookies using matching cookie options/path.
4. Return success.

**Topics:** logout, session revocation, cookie clearing.  
**Packages:** Express, Mongoose, cookie-parser, jsonwebtoken.

## Forgot password — `POST /auth/forgot-password`

**Input:** `email`

1. Validate email.
2. Find one user with `User.findOne({ email })`; do not use `find()` because it returns an array.
3. Generate raw token: `crypto.randomBytes(32).toString('hex')`.
4. SHA-256 hash the token and store only the hash in `resetPasswordToken`.
5. Set expiry: `Date.now() + 15 * 60 * 1000`.
6. Save the user, then email the raw token in a reset URL.
7. Return the same generic message for known/unknown emails in production.

**Topics:** random tokens, SHA-256, expiry, SMTP, account-enumeration prevention.  
**Packages:** Express, Mongoose, Node.js `crypto`, Nodemailer.

## Reset password — `POST /auth/reset-password/:token`

**Input:** URL token and body `newPassword`

1. Define `:token` in the route and read it through `req.params.token`.
2. Hash token using the same SHA-256 process as forgot-password.
3. Find one user whose token hash matches and whose expiry is later than `Date.now()`.
4. Reject invalid, expired, or previously used token.
5. Validate and bcrypt-hash the new password.
6. Clear `resetPasswordToken`, `resetPasswordExpires`, and `refreshToken`.
7. Save. The reset link is now one-time-use.

**Topics:** URL params, hash matching, expiry checks, one-time credentials, password reset.  
**Packages:** Express, Mongoose, Node.js `crypto`, bcrypt.

## Reuse checklist

1. Hide `password`, `refreshToken`, `resetPasswordToken`, and `resetPasswordExpires` with `select: false`.
2. Use a short access JWT and a longer refresh JWT.
3. Hash passwords and stored refresh tokens with bcrypt.
4. Use `crypto.randomBytes()` plus SHA-256 for reset tokens.
5. Keep route/controller/service/model responsibilities separate.
6. Include `/:token` in the reset route.
7. Allowlist profile fields.
8. Revoke refresh sessions at logout, password change, and password reset.
9. Before deployment, add validation, rate limiting, tests, HTTPS, secure cookies, and CORS configuration.
