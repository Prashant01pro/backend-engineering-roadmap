import express, { urlencoded } from 'express'
import { globalErrorHandler } from './middlewares/error.middleware.js'
import cookieParser from 'cookie-parser'
import authRouter from './features/auth/auth.route.js'
import userRouter from './features/users/user.route.js'
import categoryRouter from './features/categories/category.route.js'
import productRouter from './features/products/product.route.js'


const app = express()

app.use(express.json())
app.use(urlencoded({extended:true}))
app.use(cookieParser())


app.get('/health',(req,res)=>{
    res.status(200).json({
        message:'Server is running'
    })
})

app.use('/api/v1/auth',authRouter)
app.use('/api/v1/users',userRouter)
app.use('/api/v1/categories',categoryRouter)
app.use('/api/v1/products',productRouter)

app.use(globalErrorHandler)

export default app;