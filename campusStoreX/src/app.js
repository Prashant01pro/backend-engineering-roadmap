import express, { urlencoded } from 'express'
import { globalErrorHandler } from './middlewares/error.middleware.js'
import cookieParser from 'cookie-parser'
import authRouter from './features/auth/auth.route.js'
import userRouter from './features/users/user.route.js'
import categoryRouter from './features/categories/category.route.js'
import productRouter from './features/products/product.route.js'
import inventoryRouter from './features/inventory/inventory.route.js';
import followRouter from './features/follows/follow.route.js'
import cartRouter from './features/cart/cart.route.js'
import orderRouter from './features/orders/order.route.js'
import reviewRouter from './features/reviews/review.route.js'


const app = express()

app.use(express.json())
app.use(urlencoded({ extended: true }))
app.use(cookieParser())


app.get('/health', (req, res) => {
    res.status(200).json({
        message: 'Server is running'
    })
})

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/categories', categoryRouter);
app.use('/api/v1/products', productRouter);
app.use('/api/v1/inventory', inventoryRouter);
app.use('/api/v1/follows', followRouter)
app.use('/api/v1/cart', cartRouter)
app.use('/api/v1/orders', orderRouter)
app.use('/api/v1/reviews', reviewRouter)



app.use(globalErrorHandler)

export default app;