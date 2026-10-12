#  CampusStore — Comprehensive Routes Blueprint & Implementation Guide

> This reference manual documents the **exact architecture, execution lifecycle, database queries, topics, and packages** for every route in the CampusStore backend. Use this blueprint as a master template whenever constructing production-ready REST APIs.

---

##  Master Index of Modules
1. [Authentication Module (`/api/v1/auth`)](#1-authentication-module-apiv1auth)
2. [Users Module (`/api/v1/users`)](#2-users-module-apiv1users)
3. [Categories Module (`/api/v1/categories`)](#3-categories-module-apiv1categories)
4. [Products Module (`/api/v1/products`)](#4-products-module-apiv1products)
5. [Inventory & Stock Ledger Module (`/api/v1/inventory`)](#5-inventory--stock-ledger-module-apiv1inventory)
6. [Follows Module (`/api/v1/follows`)](#6-follows-module-apiv1follows)
7. [Cart Module (`/api/v1/cart`)](#7-cart-module-apiv1cart)
8. [Orders & Checkout Module (`/api/v1/orders`)](#8-orders--checkout-module-apiv1orders)
9. [Reviews Module (`/api/v1/reviews`)](#9-reviews-module-apiv1reviews)
10. [Analytics & Aggregation Module (`/api/v1/analystics`)](#10-analytics--aggregation-module-apiv1analystics)

---

## 1. Authentication Module (`/api/v1/auth`)

---

### Route 1.1: Register Student
- **Method & Path**: `POST /api/v1/auth/register`
- **Access**: Public
- **Description**: Registers a new student account, hashes their password, registers a Redis device session, and issues dual JWT tokens.

####  Making Flow:
1. **Request Ingestion**: Express receives `req.body` containing `{ name, email, password, bio }`.
2. **Validation**: Check for required fields; verify password length ($\ge 10$ characters).
3. **Duplicate Prevention**: Run `User.findOne({ $or: [{ name }, { email }] })`. Throw `409 Conflict` if found.
4. **Password Hashing**: Hash plain password using `bcrypt.hash(password, 12)`.
5. **Database Insertion**: Save user record via `User.create()`.
6. **Redis Device Session Creation**:
   - Generate `sessionId` via `crypto.randomUUID()`.
   - Generate raw `refreshToken`, hash it via `crypto.createHash('sha256')`.
   - Extract client IP and user-agent metadata using `parseDeviceInfo(req)`.
   - Persist session in Redis with key `session:<sessionId>` and 7-day TTL.
7. **Token Issuance**: Sign short-lived `accessToken` containing `{ id, role, sessionId }` via `jsonwebtoken`.
8. **Response Delivery**: Set raw refresh token in HttpOnly cookie; respond with `201 Created` returning user data and access token.

- **Topics Used**: Password Hashing, Salting, Cryptographic Token Generation, In-Memory Session Storage (Redis), Token Rotation, Device Metadata Parsing, HttpOnly Cookies.
- **Technologies & Packages**: `bcrypt`, `crypto`, `ioredis`, `jsonwebtoken`, `express`, `mongoose`.

---

### Route 1.2: Login Student
- **Method & Path**: `POST /api/v1/auth/login`
- **Access**: Public
- **Description**: Authenticates user credentials, binds a new Redis device session, and returns access and refresh tokens.

####  Making Flow:
1. **Request Ingestion**: Receive `email` and `password`.
2. **User Lookup**: Query `User.findOne({ email }).select('+password')` to explicitly fetch hidden password hash.
3. **Credential Verification**: Compare submitted password with stored hash via `bcrypt.compare()`. Throw `401 Unauthorized` on mismatch.
4. **Session Registration**: Generate a new `sessionId` and hashed refresh token; store device information in Redis.
5. **Token Generation**: Generate new access token embedding `sessionId`.
6. **Response Delivery**: Return `200 OK` with user profile and access token; set refresh token in cookie.

- **Topics Used**: Password Verification, Selective Field Projection (`select('+password')`), Multi-Device Session Isolation, Device Fingerprinting.
- **Technologies & Packages**: `bcrypt`, `crypto`, `ioredis`, `jsonwebtoken`, `express`, `mongoose`.

---

### Route 1.3: Refresh Token Rotation
- **Method & Path**: `POST /api/v1/auth/refresh-token`
- **Access**: Public (Cookie/Payload Driven)
- **Description**: Rotates refresh tokens securely with automatic reuse detection.

####  Making Flow:
1. **Token Ingestion**: Read incoming `refreshToken` and `sessionId` from cookies or body.
2. **Session Fetch**: Read device session from Redis via `getSession(sessionId)`. Throw `401` if expired.
3. **Reuse Detection Check**: Hash incoming token and compare with stored `session.refreshTokenHash`.
   - *If hashes do not match*: Trigger security alarm! Delete session immediately from Redis and throw `403 Forbidden` (Token Reuse Detected).
4. **Database Verification**: Ensure `User.findById(session.userId)` still exists.
5. **Token Rotation**:
   - Generate brand new raw refresh token and compute its SHA-256 hash.
   - Update Redis session with new hash and reset TTL.
   - Generate brand new access token.
6. **Response Delivery**: Return `200 OK` with new tokens.

- **Topics Used**: Refresh Token Rotation (RTR), Replay Attack Prevention, Session Invalidation, Cryptographic SHA-256 Hashing.
- **Technologies & Packages**: `crypto`, `ioredis`, `jsonwebtoken`, `express`.

---

### Route 1.4: Forgot Password Request
- **Method & Path**: `POST /api/v1/auth/forgot-password`
- **Access**: Public
- **Description**: Generates a single-use password reset token and emails a reset URL to the student.

####  Making Flow:
1. **Input Check**: Validate `req.body.email`.
2. **User Lookup**: Search `User.findOne({ email })`.
   - *Security Rule*: If user not found, still return generic success message to prevent user enumeration attacks.
3. **Token Creation**: Generate 32-byte random hex string via `crypto.randomBytes(32).toString('hex')`.
4. **Hash & Save**: Hash token with SHA-256; store on `user.resetPasswordToken` with `resetPasswordExpires = Date.now() + 15 * 60 * 1000`. Save via `user.save({ validateBeforeSave: false })`.
5. **Email Delivery**: Compose HTML template with reset link containing unhashed token; transmit via `nodemailer`.
6. **Response Delivery**: Return `200 OK`.

- **Topics Used**: Cryptographic Nonce Generation, Token Expiration Handling, User Enumeration Attack Mitigation, SMTP Email Delivery.
- **Technologies & Packages**: `crypto`, `nodemailer`, `mongoose`, `express`.

---

### Route 1.5: Reset Password
- **Method & Path**: `POST /api/v1/auth/reset-password/:token`
- **Access**: Public
- **Description**: Resets password using valid token and invalidates all active sessions across all devices.

####  Making Flow:
1. **Token Hashing**: Compute SHA-256 hash of URL `:token`.
2. **User Query**: Query `User.findOne({ resetPasswordToken: hashedToken, resetPasswordExpires: { $gt: Date.now() } })`.
3. **Password Update**: Hash `newPassword` with bcrypt; update `user.password`. Clear `resetPasswordToken` and `resetPasswordExpires`.
4. **Save Document**: Persist updated user.
5. **Universal Session Revocation**: Call `deleteAllUserSessions(userId)` in Redis to immediately log out all compromised devices.
6. **Response Delivery**: Return `200 OK`.

- **Topics Used**: Mongo Time Comparisons (`$gt`), Field Unsetting, Global Session Invalidation on Security Events.
- **Technologies & Packages**: `bcrypt`, `crypto`, `ioredis`, `mongoose`, `express`.

---

### Route 1.6: Logout
- **Method & Path**: `POST /api/v1/auth/logout`
- **Access**: Authenticated
- **Description**: Revokes the current device session in Redis and clears cookies.

####  Making Flow:
1. **Session Identification**: Extract `sessionId` from `req.user.sessionId`.
2. **Redis Invalidation**: Delete key from Redis via `deleteSession(sessionId)`.
3. **Cookie Cleanup**: Clear refresh token cookie.
4. **Response Delivery**: Return `200 OK`.

- **Topics Used**: Stateless Token Revocation via Redis, Cookie Eviction.
- **Technologies & Packages**: `ioredis`, `express`.

---

## 2. Users Module (`/api/v1/users`)

---

### Route 2.1: Get Current User Profile
- **Method & Path**: `GET /api/v1/users/me`
- **Access**: Authenticated
- **Description**: Retrieves currently authenticated student's profile details.

####  Making Flow:
1. **Auth Middleware**: `authenticate` middleware verifies JWT, confirms user exists in DB, and attaches user to `req.user`.
2. **Service Retrieval**: Call `getMeService(req.user._id)`.
3. **Response Delivery**: Return `200 OK` with sanitized user object.

- **Topics Used**: Bearer Token Authentication, Request Context Attachment.
- **Technologies & Packages**: `jsonwebtoken`, `mongoose`, `express`.

---

### Route 2.2: Update User Bio
- **Method & Path**: `PATCH /api/v1/users/update-bio`
- **Access**: Authenticated
- **Description**: Updates profile biography.

####  Making Flow:
1. **Input Ingestion**: Read `bio` from `req.body`.
2. **Atomic Update**: Call `User.findByIdAndUpdate(userId, { bio }, { returnDocument: 'after', runValidators: true }).select('-password')`.
3. **Response Delivery**: Return `200 OK` with updated profile.

- **Topics Used**: Targeted Schema Updates, `runValidators` Flag, Response Projection.
- **Technologies & Packages**: `mongoose`, `express`.

---

## 3. Categories Module (`/api/v1/categories`)

---

### Route 3.1: Get All Active Categories
- **Method & Path**: `GET /api/v1/categories`
- **Access**: Public
- **Description**: Fetches all active categories for catalog filtering, alphabetically sorted.

####  Making Flow:
1. **Database Query**: `Category.find({ isActive: true }).sort({ name: 1 })`.
2. **Response Delivery**: Return `200 OK` with array of categories.

- **Topics Used**: Indexed Filtering, Cursor Sorting (`sort({ name: 1 })`).
- **Technologies & Packages**: `mongoose`, `express`.

---

### Route 3.2: Create Category
- **Method & Path**: `POST /api/v1/categories`
- **Access**: Admin Only (`authenticate`, `authorize('admin')`)
- **Description**: Adds a new category taxonomy with duplicate prevention.

####  Making Flow:
1. **Role Guard**: `authorize('admin')` verifies `req.user.role === 'admin'`. Throw `403` if unauthorized.
2. **Validation**: Check for `name`. Run case-insensitive regex check `Category.findOne({ name: { $regex: ... } })`. Throw `409 Conflict` if duplicate exists.
3. **Document Creation**: Save via `Category.create({ name, description })`.
4. **Response Delivery**: Return `201 Created`.

- **Topics Used**: Role-Based Access Control (RBAC), Case-Insensitive Unique Checks, Trim Validation.
- **Technologies & Packages**: `mongoose`, `express`.

---

## 4. Products Module (`/api/v1/products`)

---

### Route 4.1: List & Filter Catalog Products
- **Method & Path**: `GET /api/v1/products`
- **Access**: Public
- **Description**: Searches and filters marketplace catalog items with pagination, price bounding, and sorting.

####  Making Flow:
1. **Query Params Parsing**: Read `category`, `minPrice`, `maxPrice`, `search`, `sortBy`, `order`, `page`, `limit`.
2. **Dynamic Filter Construction**:
   - Base filter: `{ status: 'ACTIVE' }`.
   - Category filter: `filter.category = category`.
   - Price bounds: `filter.price.$gte = minPrice`, `filter.price.$lte = maxPrice`.
   - Text search: Regex match against `$or: [{ name: ... }, { description: ... }]`.
3. **Pagination Offsets**: Calculate `skip = (page - 1) * limit`.
4. **Concurrent Execution**: Run `Product.find(filter)` and `Product.countDocuments(filter)` in parallel via `Promise.all()`.
5. **Foreign Field Population**: Chain `.populate('category', 'name').populate('seller', 'name email')`.
6. **Response Delivery**: Return `200 OK` with products, total pages, and pagination metadata.

- **Topics Used**: Compound Query Filtering, Regex Text Search, Relational Population (`.populate()`), Parallel Promise Execution (`Promise.all`), Limit/Skip Pagination.
- **Technologies & Packages**: `mongoose`, `express`.

---

### Route 4.2: Get Single Product by ID
- **Method & Path**: `GET /api/v1/products/:id`
- **Access**: Public
- **Description**: Returns detailed product information with embedded specifications and populated seller bio.

####  Making Flow:
1. **Query**: Call `Product.findById(id).populate('category', 'name').populate('seller', 'name email bio')`.
2. **Error Guard**: If `null`, throw `404 Not Found`.
3. **Response Delivery**: Return `200 OK`.

- **Topics Used**: Deep Population, Embedded Subdocument Retrieval.
- **Technologies & Packages**: `mongoose`, `express`.

---

### Route 4.3: Create Product
- **Method & Path**: `POST /api/v1/products`
- **Access**: Authenticated (Any Student Seller)
- **Description**: Creates a new product listing with embedded specifications.

####  Making Flow:
1. **Input Validation**: Check `name`, `description`, `price`, and `category`.
2. **Category Verification**: Query `Category.findOne({ _id: category, isActive: true })`. Throw `400` if invalid or inactive.
3. **Subdocument Embedding**: Structure `specifications` (author, edition, condition, brand).
4. **Document Creation**: Save via `Product.create({ ...data, seller: req.user._id, status: 'ACTIVE' })`.
5. **Response Delivery**: Return `201 Created`.

- **Topics Used**: Subdocument Schema Embedding, Foreign-Key Reference Validation, Default Values.
- **Technologies & Packages**: `mongoose`, `express`.

---

### Route 4.4: Update Own Product
- **Method & Path**: `PATCH /api/v1/products/:id`
- **Access**: Authenticated (Product Owner Only)
- **Description**: Updates product details; prevents tampering with seller ownership.

####  Making Flow:
1. **Lookup**: Fetch product by ID.
2. **Ownership Guard**: Check `product.seller.toString() === req.user._id.toString()`. Throw `403 Forbidden` on mismatch.
3. **Security Sanitization**: Explicitly `delete updateData.seller` to prevent ownership reassignment.
4. **Update**: Execute `Product.findByIdAndUpdate(id, updateData, { returnDocument: 'after', runValidators: true })`.
5. **Response Delivery**: Return `200 OK`.

- **Topics Used**: Ownership Authorization, Field Sanitization, Schema Re-validation.
- **Technologies & Packages**: `mongoose`, `express`.

---

### Route 4.5: Soft-Delete Product
- **Method & Path**: `DELETE /api/v1/products/:id`
- **Access**: Authenticated (Product Owner Only)
- **Description**: Soft-deletes a product by marking its status as `INACTIVE`.

####  Making Flow:
1. **Lookup & Ownership Guard**: Fetch product; verify `product.seller.equals(req.user._id)`.
2. **Status Mutation**: Set `product.status = 'INACTIVE'`. Save via `product.save()`.
3. **Audit Integrity Rationale**: Hard delete is avoided to preserve past order line items and stock audit transactions.
4. **Response Delivery**: Return `200 OK`.

- **Topics Used**: Soft Deletion Architecture, Historical Data Integrity.
- **Technologies & Packages**: `mongoose`, `express`.

---

## 5. Inventory & Stock Ledger Module (`/api/v1/inventory`)

---

### Route 5.1: View Available Stock
- **Method & Path**: `GET /api/v1/inventory/:productId`
- **Access**: Public
- **Description**: Returns current stock quantity, reserved count, and derived available stock.

####  Making Flow:
1. **Query**: `Inventory.findOne({ product: productId }).populate('product', 'name price status')`.
2. **Virtual Evaluation**: The Mongoose virtual `available = quantity - reserved` executes dynamically via standard getter function.
3. **Response Delivery**: Return `200 OK` with serialized virtual fields.

- **Topics Used**: Mongoose Virtuals (Derived State vs Stored State), Serialization Hooks (`toJSON: { virtuals: true }`).
- **Technologies & Packages**: `mongoose`, `express`.

---

### Route 5.2: Add / Restock Inventory
- **Method & Path**: `POST /api/v1/inventory/add`
- **Access**: Authenticated (Product Seller Only)
- **Description**: Adds units to inventory and writes an immutable audit record in a MongoDB Transaction.

####  Making Flow:
1. **Product Verification**: Fetch product; verify `product.seller.equals(req.user._id)`.
2. **Start ACID Session**: Call `session = await mongoose.startSession(); session.startTransaction()`.
3. **Atomic Upsert**: Call `Inventory.findOneAndUpdate({ product: productId }, { $inc: { quantity: quantity } }, { upsert: true, new: true, session })`.
4. **Catalog Status Recovery**: If `product.status === 'SOLD_OUT'`, update `product.status = 'ACTIVE'` within session.
5. **Audit Ledger Creation**: Call `StockTransaction.create([{ product, type: 'PURCHASE', quantity, reason, performedBy: sellerId }], { session })`.
6. **Commit Session**: `await session.commitTransaction()`.
7. **Error Rollback**: If any failure occurs, trigger `await session.abortTransaction()`.
8. **Response Delivery**: Return `200 OK`.

- **Topics Used**: Multi-Document ACID Transactions, Atomic `$inc` Operators, Upserting Documents, Immutable Append-Only Audit Logging.
- **Technologies & Packages**: `mongoose`, `express`.

---

### Route 5.3: View Product Stock Audit History
- **Method & Path**: `GET /api/v1/inventory/:productId/history`
- **Access**: Authenticated (Product Seller Only)
- **Description**: Lists immutable chronological ledger of all stock movements for a product.

####  Making Flow:
1. **Ownership Check**: Ensure `product.seller.equals(req.user._id)`.
2. **Ledger Query**: `StockTransaction.find({ product: productId }).populate('performedBy', 'name email').sort({ createdAt: -1 })`.
3. **Response Delivery**: Return `200 OK`.

- **Topics Used**: Audit Trails, Chronological Indexing (`{ product: 1, createdAt: -1 }`).
- **Technologies & Packages**: `mongoose`, `express`.

---

## 6. Follows Module (`/api/v1/follows`)

---

### Route 6.1: Follow Seller
- **Method & Path**: `POST /api/v1/follows/:userId/follow`
- **Access**: Authenticated
- **Description**: Follows a campus seller.

####  Making Flow:
1. **Self-Follow Guard**: Validate `req.user._id.toString() !== targetUserId.toString()`. Throw `400` if equal.
2. **Target User Check**: Verify target user exists.
3. **Insert Junction Document**: Call `Follow.create({ follower: req.user._id, following: targetUserId })`.
4. **Duplicate Protection**: If error code is `11000` (E11000 duplicate key error from compound index `{ follower: 1, following: 1 }`), throw clean `409 Conflict`.
5. **Response Delivery**: Return `201 Created`.

- **Topics Used**: Many-to-Many Modeling ($N:M$), Compound Unique Indexes, Mongo Error Code `11000` Interception.
- **Technologies & Packages**: `mongoose`, `express`.

---

### Route 6.2: Unfollow Seller
- **Method & Path**: `DELETE /api/v1/follows/:userId/unfollow`
- **Access**: Authenticated
- **Description**: Removes follow relationship.

####  Making Flow:
1. **Deletion**: Call `Follow.findOneAndDelete({ follower: req.user._id, following: targetUserId })`.
2. **Response Delivery**: Return `200 OK`.

- **Topics Used**: Targeted Deletion on Junction Documents.
- **Technologies & Packages**: `mongoose`, `express`.

---

### Route 6.3: Get User Followers & Following
- **Method & Path**: `GET /api/v1/follows/:userId/followers` & `GET /api/v1/follows/:userId/following`
- **Access**: Public
- **Description**: Returns paginated list of students following a seller, or sellers a student follows.

####  Making Flow:
1. **Index Search**: Search `Follow.find({ following: userId })` or `Follow.find({ follower: userId })`.
2. **Population**: Chain `.populate('follower', 'name email bio')` or `.populate('following', 'name email bio')`.
3. **Array Mapping**: Map over junction documents to return pure user entities.
4. **Response Delivery**: Return `200 OK` with pagination metadata.

- **Topics Used**: Inverted Index Queries, Paginated Junction Traversals.
- **Technologies & Packages**: `mongoose`, `express`.

---

## 7. Cart Module (`/api/v1/cart`)

---

### Route 7.1: Get User Cart
- **Method & Path**: `GET /api/v1/cart`
- **Access**: Authenticated
- **Description**: Fetches or initializes user cart; dynamically calculates current subtotal.

####  Making Flow:
1. **Get-Or-Create Pattern**: Query `Cart.findOne({ user: userId })`. If none exists, create empty cart.
2. **Deep Population**: Populate `items.product` (selecting name, price, status), and nested populate `items.product.category`.
3. **Dynamic Subtotal Calculation**: Loop over `cart.items`, computing `subtotal += product.price * quantity`.
4. **Response Delivery**: Return `200 OK` with populated cart and calculated subtotal.

- **Topics Used**: Lazy Initialization (Get-Or-Create), Multi-Level Deep Population, Ephemeral Field Derivation.
- **Technologies & Packages**: `mongoose`, `express`.

---

### Route 7.2: Add Item to Cart
- **Method & Path**: `POST /api/v1/cart/items`
- **Access**: Authenticated
- **Description**: Adds a product to cart; merges duplicate items; guards against out-of-stock items and 20-item cap.

####  Making Flow:
1. **Product & Status Check**: Ensure product exists and `status === 'ACTIVE'`.
2. **Self-Purchase Guard**: Ensure student does not buy their own listed product (`product.seller !== userId`).
3. **Real-Time Stock Verification**: Query `Inventory.findOne({ product: productId })`. Read `inventory.available`.
4. **Cart Boundary Checks**:
   - Locate existing item via `cart.items.findIndex()`.
   - *If already in cart*: Compute `newQuantity = current + quantity`. Check `newQuantity <= availableStock`. Update in-place.
   - *If new item*: Verify `cart.items.length < 20`. Check `quantity <= availableStock`. Push new subdocument `{ product, quantity }`.
5. **Persist**: `await cart.save()`.
6. **Response Delivery**: Return `200 OK` with populated cart.

- **Topics Used**: Embedded Subdocument Manipulation, Array Boundary Constraints, Stock Pre-Validation.
- **Technologies & Packages**: `mongoose`, `express`.

---

### Route 7.3: Update Item Quantity & Remove Item
- **Method & Path**: `PATCH /api/v1/cart/items` & `DELETE /api/v1/cart/items/:productId`
- **Access**: Authenticated
- **Description**: Modifies line-item quantity (removing if $\le 0$), or purges a specific line-item.

####  Making Flow:
1. **Locate Subdocument**: Find matching array index in `cart.items`.
2. **Quantity Gate**:
   - If `quantity <= 0`: Remove item using `cart.items.splice(index, 1)`.
   - If `quantity > 0`: Check `quantity <= inventory.available`. Update `cart.items[index].quantity`.
3. **Single Delete Route**: Filter array via `cart.items.filter(item => !item.product.equals(productId))`.
4. **Persist & Return**: `await cart.save()`; return `200 OK`.

- **Topics Used**: In-Memory Embedded Array Mutation, Array Filtering.
- **Technologies & Packages**: `mongoose`, `express`.

---

## 8. Orders & Checkout Module (`/api/v1/orders`)

---

### Route 8.1: Checkout Order (ACID Pipeline)
- **Method & Path**: `POST /api/v1/orders/checkout`
- **Access**: Authenticated
- **Description**: Converts cart into an immutable snapshot order, atomically decrements stock, records sale transactions, generates mock payment, and clears cart in a single transaction.

####  Making Flow:
1. **Cart Pre-check**: Fetch cart with populated products; ensure `cart.items.length > 0`.
2. **Start MongoDB Transaction**: Initialize session via `mongoose.startSession()`.
3. **Loop Over Cart Items**:
   - Verify each product is `ACTIVE`.
   - **Atomic Conditional Decrement**:
     ```javascript
     const inv = await Inventory.findOneAndUpdate(
       { product: product._id, quantity: { $gte: item.quantity } },
       { $inc: { quantity: -item.quantity } },
       { returnDocument: 'after', session }
     );
     ```
   - If `inv` is `null`, throw `400 Insufficient Stock` (triggers transaction abort).
   - If `inv.quantity === 0`, update product status to `'SOLD_OUT'` within session.
   - Insert `StockTransaction` of type `'SALE'`.
   - Construct **Snapshot Line Item** `{ product: _id, name: product.name, price: product.price, quantity }`.
4. **Order Document Creation**: Call `Order.create([{ user, items: snapshotItems, subtotal, total, status: 'PLACED' }], { session })`.
5. **Mock Payment Fulfillment**: Generate unique `transactionId = TXN_...`; create `Payment` record with status `'SUCCESS'`.
6. **Order Confirmation**: Update `order.status = 'COMPLETED'`.
7. **Cart Purge**: Set `cart.items = []`; save within session.
8. **Commit Transaction**: `await session.commitTransaction(); session.endSession()`.
9. **Response Delivery**: Return `201 Created` with frozen receipt.

- **Topics Used**: Multi-Document ACID Transactions, Atomic Conditional Decrement (`$gte` + `$inc`), Snapshotting/Denormalization, Payment Reconciliation, Cart Clearing.
- **Technologies & Packages**: `crypto`, `mongoose`, `express`.

---

### Route 8.2: Get User Orders & Single Order Details
- **Method & Path**: `GET /api/v1/orders/my-orders` & `GET /api/v1/orders/:id`
- **Access**: Authenticated (Owner Only)
- **Description**: Lists paginated historical order receipts or single order with linked payment record.

####  Making Flow:
1. **Query**: Find orders filtered by `{ user: req.user._id }` sorted by `{ createdAt: -1 }`.
2. **Payment Join**: On single order query, fetch linked payment via `Payment.findOne({ order: orderId })`.
3. **Response Delivery**: Return `200 OK`.

- **Topics Used**: Historical Receipt Fetching, 1-to-1 Reference Resolution.
- **Technologies & Packages**: `mongoose`, `express`.

---

## 9. Reviews Module (`/api/v1/reviews`)

---

### Route 9.1: Create Verified Buyer Review
- **Method & Path**: `POST /api/v1/reviews`
- **Access**: Authenticated
- **Description**: Allows a student to review a product only after verifying a completed purchase order.

####  Making Flow:
1. **Self-Review Guard**: Ensure reviewer is not the product seller (`product.seller !== userId`).
2. **Verified Purchase Check**: Query `Order.findOne({ user: userId, status: 'COMPLETED', 'items.product': productId })`. Throw `403 Forbidden` if no completed order exists.
3. **Insert Review**: Create review with `{ user, product, order: completedOrder._id, rating, comment }`.
4. **Duplicate Protection**: Compound index `{ user: 1, product: 1 }` prevents reviewing the same product twice.
5. **Response Delivery**: Return `201 Created`.

- **Topics Used**: Purchase Verification Queries, Compound Unique Constraints, Array Subdocument Queries (`'items.product': id`).
- **Technologies & Packages**: `mongoose`, `express`.

---

### Route 9.2: Product Rating Aggregation
- **Method & Path**: `GET /api/v1/reviews/product/:productId/stats`
- **Access**: Public
- **Description**: Computes real-time average rating and review count on the fly.

####  Making Flow:
1. **Pipeline Execution**:
   ```javascript
   Review.aggregate([
     { $match: { product: new mongoose.Types.ObjectId(productId) } },
     {
       $group: {
         _id: '$product',
         averageRating: { $avg: '$rating' },
         totalReviews: { $sum: 1 }
       }
     }
   ])
   ```
2. **Mathematical Rounding**: Round average to 1 decimal place (`Math.round(avg * 10) / 10`).
3. **Response Delivery**: Return `200 OK` with `{ averageRating, totalReviews }`.

- **Topics Used**: MongoDB Aggregation Pipeline, `$match` Filtering, `$group` with `$avg` and `$sum`.
- **Technologies & Packages**: `mongoose`, `express`.

---

## 10. Analytics & Aggregation Module (`/api/v1/analystics`)

---

### Route 10.1: Best-Selling Products
- **Method & Path**: `GET /api/v1/analystics/best-sellers`
- **Access**: Public
- **Description**: Unwinds order arrays and ranks products by units sold and revenue.

####  Pipeline Flow:
```javascript
Order.aggregate([
  { $match: { status: 'COMPLETED' } },
  { $unwind: '$items' },
  {
    $group: {
      _id: '$items.product',
      productName: { $first: '$items.name' },
      unitsSold: { $sum: '$items.quantity' },
      totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
    }
  },
  { $sort: { unitsSold: -1 } },
  { $limit: Number(limit) }
])
```
- **Topics Used**: `$unwind` Array Flattening, Group Accumulators (`$first`, `$sum`), Arithmetic `$multiply`, Descending `$sort`, `$limit`.
- **Technologies & Packages**: `mongoose`, `express`.

---

### Route 10.2: Sales by Category
- **Method & Path**: `GET /api/v1/analystics/sales-by-category`
- **Access**: Public
- **Description**: Multi-collection join across Orders $\to$ Products $\to$ Categories computing revenue per category.

####  Pipeline Flow:
```javascript
Order.aggregate([
  { $match: { status: 'COMPLETED' } },
  { $unwind: '$items' },
  {
    $lookup: {
      from: 'products',
      localField: 'items.product',
      foreignField: '_id',
      as: 'product'
    }
  },
  { $unwind: '$product' },
  {
    $lookup: {
      from: 'categories',
      localField: 'product.category',
      foreignField: '_id',
      as: 'category'
    }
  },
  { $unwind: '$category' },
  {
    $group: {
      _id: '$category._id',
      categoryName: { $first: '$category.name' },
      totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
      unitsSold: { $sum: '$items.quantity' }
    }
  },
  { $sort: { totalRevenue: -1 } }
])
```
- **Topics Used**: Multi-Stage `$lookup` (Foreign Collection Left Outer Joins), Intermediate `$unwind` Array Flattening, Category Grouping.
- **Technologies & Packages**: `mongoose`, `express`.

---

### Route 10.3: Seller Revenue
- **Method & Path**: `GET /api/v1/analystics/my-revenue`
- **Access**: Authenticated (Seller)
- **Description**: Calculates total revenue and units sold specifically for products belonging to the logged-in seller.

####  Pipeline Flow:
```javascript
Order.aggregate([
  { $match: { status: 'COMPLETED' } },
  { $unwind: '$items' },
  {
    $lookup: {
      from: 'products',
      localField: 'items.product',
      foreignField: '_id',
      as: 'product'
    }
  },
  { $unwind: '$product' },
  { $match: { 'product.seller': new mongoose.Types.ObjectId(sellerId) } },
  {
    $group: {
      _id: '$product.seller',
      totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
      unitsSold: { $sum: '$items.quantity' }
    }
  },
  { $project: { _id: 0, totalRevenue: 1, unitsSold: 1 } }
])
```
- **Topics Used**: Post-Join Filtering (`$match` on joined field), Projection Reshaping (`$project`).
- **Technologies & Packages**: `mongoose`, `express`.

---

### Route 10.4: User Spending Summary
- **Method & Path**: `GET /api/v1/analystics/my-spending`
- **Access**: Authenticated (Buyer)
- **Description**: Aggregates total money spent and order count by a specific student.

####  Pipeline Flow:
```javascript
Order.aggregate([
  { $match: { user: new mongoose.Types.ObjectId(userId), status: 'COMPLETED' } },
  {
    $group: {
      _id: '$user',
      totalSpent: { $sum: '$total' },
      totalOrders: { $sum: 1 }
    }
  },
  { $project: { _id: 0, totalSpent: 1, totalOrders: 1 } }
])
```
- **Topics Used**: User-Scoped Metrics, Aggregation `$group` with Count and Sum.
- **Technologies & Packages**: `mongoose`, `express`.

---

### Route 10.5: Product Stock Breakdown by Type
- **Method & Path**: `GET /api/v1/analystics/product-stock-breakdown/:productId`
- **Access**: Authenticated (Seller)
- **Description**: Summarizes total quantities across transaction types (`PURCHASE`, `SALE`, `RETURN`, `DAMAGE`, `ADJUSTMENT`).

####  Pipeline Flow:
```javascript
StockTransaction.aggregate([
  { $match: { product: new mongoose.Types.ObjectId(productId) } },
  {
    $group: {
      _id: '$type',
      totalQuantity: { $sum: '$quantity' },
      transactionCount: { $sum: 1 }
    }
  },
  {
    $project: {
      _id: 0,
      type: '$_id',
      totalQuantity: 1,
      transactionCount: 1
    }
  }
])
```
- **Topics Used**: Audit Grouping, Ledger Metric Aggregation.
- **Technologies & Packages**: `mongoose`, `express`.

---

### Route 10.6: Total Platform Sales
- **Method & Path**: `GET /api/v1/analystics/total-sales`
- **Access**: Admin Only (`authenticate`, `authorize('admin')`)
- **Description**: Calculates global gross merchandise volume (GMV) and order volume across the marketplace.

####  Pipeline Flow:
```javascript
Order.aggregate([
  { $match: { status: 'COMPLETED' } },
  {
    $group: {
      _id: null, // Null groups all matched documents into a single row
      totalRevenue: { $sum: '$total' },
      totalOrdersCount: { $sum: 1 }
    }
  },
  { $project: { _id: 0, totalRevenue: 1, totalOrdersCount: 1 } }
])
```
- **Topics Used**: Global Aggregation (`_id: null`), Admin Analytics Authorization.
- **Technologies & Packages**: `mongoose`, `express`.

