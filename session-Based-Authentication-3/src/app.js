import express from 'express'
import { globalErrorMiddleware } from './middlewares/error.middleware.js'
import authRouter from './features/auth/auth.route.js'
import userRouter from './features/users/user.route.js'
import cookieParser from 'cookie-parser'

const app=express()

app.use(express.urlencoded({extended:true}))
app.use(express.json())
app.use(cookieParser())

app.get('/health',(req,res)=>{
    res.status(200).json({
        message:'Server is running'
    })
})

app.use('/auth',authRouter)
app.use('/user',userRouter)

app.use(globalErrorMiddleware)

export default app;