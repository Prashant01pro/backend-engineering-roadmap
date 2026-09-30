# Reusable Route-Making Flow

Use this reference to rebuild authentication and RBAC routes in another project.

```text
Route -> middleware -> controller -> service -> model/database -> response
```

## Shared foundation

| Component | Responsibility | Topics | Packages |
| --- | --- | --- | --- |
| `User` model | Fields, roles, validation, hidden secrets | schema design, defaults | Mongoose, MongoDB |
| `catchAsync`, `AppError` | Forward async failures and return HTTP errors | error handling | Express, JavaScript |
| `authenticate` | Verify JWT and assign `req.user` | authentication | jsonwebtoken, cookie-parser, Mongoose |
| `authorize` | Permit selected roles only | RBAC | Express |
| `token.js` | Sign access/refresh tokens | sessions | jsonwebtoken |

## 1. Health check — `GET /health`

1. Add `app.get('/health', handler)`.
2. Return a small `200` response; no authentication needed.

**Topics:** Express routing, HTTP GET, health checks.  
**Technology/packages:** Node.js, Express.

## 2. Register — `POST /auth/register`

**Body:** `name`, `email`, `password`, optional `bio`.

1. Create `router.post('/register', register)`.
2. Controller passes `req.body` to its service via `catchAsync`.
3. Validate fields/password length and check duplicate user.
4. Hash password with `bcrypt.hash(password, 12)`.
5. Create the document; schema default assigns `role: 'USER'`.
6. Sign access/refresh tokens, hash the stored refresh token, set HTTP-only cookies.
7. Return only safe user fields.

**Topics:** POST, validation, defaults, duplicate prevention, password hashing, JWT, cookies.  
**Technology/packages:** Express, Mongoose, MongoDB, bcrypt, jsonwebtoken, cookie-parser.

## 3. User login — `POST /auth/login`

**Body:** `email`, `password`.

1. Validate input, find user by email, explicitly select hidden password.
2. Compare supplied password using bcrypt; reject missing/bad/banned user.
3. Call `loginServices(req.body)` without a required role.
4. Issue/store the rotated token pair and set cookies.

**Topics:** authentication, hidden schema fields, bcrypt comparison, sessions.  
**Technology/packages:** Express, Mongoose, bcrypt, jsonwebtoken, cookie-parser.

## 4. Admin login — `POST /admin/login`

**Body:** `email`, `password`.

1. Keep login public so an admin can obtain a token.
2. Call `loginServices(req.body, 'ADMIN')`.
3. Define service as `loginServices(body, requiredRole)`.
4. After credential checks, reject if a supplied required role differs from `user.role`.
5. Generate tokens only when the role check succeeds.

**Topics:** authentication versus authorization, RBAC, least privilege.  
**Technology/packages:** Express, Mongoose, bcrypt, jsonwebtoken, cookie-parser.

## 5. Refresh token — `POST /auth/refresh`

**Input:** cookie or `{ "refresh": "<token>" }`.

1. Read refresh token from cookie, then request body.
2. Verify JWT and find the token's user.
3. Compare raw token against the stored bcrypt hash.
4. Sign a new pair, replace stored hash, and set new cookies.

**Topics:** refresh-token rotation, JWT verification, session revocation.  
**Technology/packages:** Express, jsonwebtoken, bcrypt, Mongoose, cookie-parser.

## 6. View profile — `GET /auth/profile`

**Protection:** `authenticate`.

1. Middleware reads cookie/Bearer token, verifies it, loads safe user, assigns `req.user`.
2. Controller returns `req.user`.

**Topics:** protected routes, Bearer authentication, middleware chaining.  
**Technology/packages:** Express, jsonwebtoken, cookie-parser, Mongoose.

## 7. Update profile — `PATCH /auth/update-profile`

**Protection:** `authenticate`; **Body:** optional `bio`.

1. Use `req.user._id`, never an id from request body.
2. Build an allowlisted `updates` object.
3. Update with validators enabled; return safe updated data.

**Topics:** ownership authorization, PATCH, allowlisting, validation.  
**Technology/packages:** Express, Mongoose, jsonwebtoken.

## 8. Change password — `PATCH /auth/change-password`

**Protection:** `authenticate`; **Body:** `currentPassword`, `newPassword`.

1. Load current user including hidden password.
2. Verify current password; enforce length and reject password reuse.
3. Hash/save new password; clear refresh token.

**Topics:** re-authentication, password policy, session invalidation.  
**Technology/packages:** Express, Mongoose, bcrypt.

## 9. Logout — `POST /auth/logout`

**Protection:** `authenticate`.

1. Set database refresh token to `null`.
2. Clear access/refresh cookies with matching options.
3. Return success.

**Topics:** logout, cookie clearing, server-side revocation.  
**Technology/packages:** Express, Mongoose, cookie-parser.

## 10. Forgot password — `POST /auth/forgot-password`

**Body:** `email`.

1. Validate/find email user.
2. Create raw token with `crypto.randomBytes(32)`.
3. Store its SHA-256 hash and short expiry, never raw token.
4. Email reset URL and return a generic response.

**Topics:** random secrets, hashing, expiry, email, anti-enumeration.  
**Technology/packages:** Express, Mongoose, Node `crypto`, Nodemailer.

## 11. Reset password — `POST /auth/reset-password/:token`

**Body:** `newPassword`.

1. SHA-256 hash `req.params.token` exactly as in forgot-password.
2. Find matching, unexpired user; reject otherwise.
3. Hash the new password, clear reset and refresh token fields, save.

**Topics:** URL params, one-time tokens, expiry, password reset.  
**Technology/packages:** Express, Mongoose, Node `crypto`, bcrypt.

## Admin middleware wall

Place this before every management route:

```js
router.use(authenticate, authorize('ADMIN'))
```

It returns `401` for missing/invalid identity and `403` for a non-admin identity.

**Topics:** RBAC, middleware order, protected resources.  
**Technology/packages:** Express, jsonwebtoken, Mongoose, cookie-parser.

## 12. List users — `GET /admin/users`

1. Query/sort users and exclude password, refresh token, reset fields.
2. Return count and safe array.

**Topics:** read operations, data minimization, RBAC.  
**Technology/packages:** Express, Mongoose.

## 13. Admin creates user — `POST /admin/users`

**Body:** `name`, `email`, `password`, optional `bio`.

1. Validate input and unique email.
2. Hash password.
3. Create with fixed `role: 'USER'`; do not accept a client-selected role.
4. Return safe account data.

**Topics:** admin actions, validation, least privilege, password hashing.  
**Technology/packages:** Express, Mongoose, bcrypt.

## 14. Delete user — `DELETE /admin/users/:id`

1. Get target id from params, current admin id from `req.user`.
2. Reject self-deletion.
3. Delete target; return `404` if missing, otherwise `204 No Content`.

**Topics:** destructive actions, self-protection, HTTP status codes.  
**Technology/packages:** Express, Mongoose.

## 15. Ban user — `PATCH /admin/users/:id/ban`

1. Reject self-ban.
2. Set `isBanned: true` and `refreshToken: null`.
3. Return safe user. Authentication must reject banned users even with a live access token.

**Topics:** moderation, session revocation, PATCH, RBAC.  
**Technology/packages:** Express, Mongoose, jsonwebtoken.

## 16. Unban user — `PATCH /admin/users/:id/unban`

1. Reuse ban service with `isBanned: false`.
2. Return `404` for missing user or the safe updated user.

**Topics:** service reuse, moderation, PATCH.  
**Technology/packages:** Express, Mongoose.

## 17. Change role — `PATCH /admin/users/:id/role`

**Body:** `{ "role": "USER" | "ADMIN" | "MODERATOR" }`.

1. Validate requested role against explicit allowlist.
2. Reject changing signed-in admin's own role.
3. Update with validators and return safe data.

**Topics:** RBAC administration, enum validation, privilege safety.  
**Technology/packages:** Express, Mongoose.

## Future-project checklist

1. Default every new account to the lowest role.
2. Separate authentication (identity) from authorization (permission).
3. Hash and hide passwords/refresh tokens.
4. Derive owner id from verified `req.user`.
5. Revoke sessions on logout, bans, password changes, and resets.
6. Before production add validation, rate limiting, CORS, HTTPS cookies, audits, and tests.
