# Moving to Stage 2: Feature-Based Development & The Auth Slice

Now that our database schema exists, we begin implementing the backend following the Vertical Slice Architecture.

Before writing business routes, an engineering-grade backend needs two fundamental shared building blocks:

A Global Error Handling Strategy
Standardized API Responses
1. Core Architectural Concepts for Stage 2
A. The Custom Error Class (AppError)

Instead of throwing generic new Error('Something failed') where everything becomes a 500 Internal Server Error, we create an AppError that carries an HTTP status code:

Validation failure → 400 Bad Request
Invalid credentials → 401 Unauthorized
Accessing someone else's booking → 403 Forbidden
Event/Seat not found → 404 Not Found
Seat already reserved by another user → 409 Conflict

This allows our global error middleware in app.js to catch any error thrown deep inside a service or repository and automatically return the correct HTTP status code without messy try/catch repetition in every single controller.

B. Standardized Response Format

Every endpoint across your entire API should return a predictable envelope:

json
// Success Response (200 / 201)
{
  "success": true,
  "data": { ... }
}
// Error Response (4xx / 5xx)
{
  "success": false,
  "message": "Invalid email or password",
  "errors": [] 
}

This predictability prevents frontend bugs where response structures vary from route to route.

C. The Repository Pattern with Pure SQL

Inside src/features/auth/, we separate the database interaction from the Express controller:

auth.repository.js: Contains pure SQL queries (pool.query(...)).
auth.service.js: Pure business logic (checking if email already exists, hashing passwords with bcrypt, generating JWTs).
auth.controller.js: HTTP layer (extracts req.body, calls the service, sends the response).
auth.routes.js: Express router definitions (POST /register, POST /login).
2. Deep Dive: The Auth Feature Slice

Here is how the authentication slice handles user and organizer registration:

text
POST /api/v1/auth/register
         │
         ▼
[auth.controller.js] ── extracts { email, password, full_name, role }
         │
         ▼
[auth.service.js]
         │
         ├── 1. Check if user already exists: authRepository.findByEmail(email)
         │      └─ If exists: throw new AppError('Email already registered', 409)
         │
         ├── 2. Hash password: await bcrypt.hash(password, 12)
         │
         ├── 3. Insert user: authRepository.createUser(...)
         │      └─ Uses SQL: INSERT INTO users (...) RETURNING id, email, full_name, role
         │
         └── 4. Generate JWT with payload: { userId, role }
         │
         ▼
[auth.controller.js] ── returns 201 Created with { user, token }
Critical Security Rule: Password Hash Sanitization

Notice step 3 above: when inserting or querying a user, never return password_hash in your SQL RETURNING clause or to the client. Keep sensitive credentials in the database only.

3. Plan for Your First Slices

Here is the exact progression for Stage 2:

Shared Foundation:
Create src/utils/appError.js (Custom error class).
Create src/utils/apiResponse.js (Standard response formatters).
Create src/middleware/error.middleware.js (Express global error interceptor).
Feature Slice 1 — Authentication (src/features/auth/):
register (Customer & Organizer).
login (Password comparison & JWT issuance).
auth.middleware.js (Verifying the JWT and protecting routes with RBAC).
Feature Slice 2 — Venues & Events (src/features/events/):
Creating venues and bulk-generating physical seats.
Creating events and mapping event_seats from venue_seats.
Browsing published events with filters (by city, category, date).