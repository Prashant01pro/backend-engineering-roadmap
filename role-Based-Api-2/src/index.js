import express from 'express'
import cookieParser from 'cookie-parser'
import { globalErrorMiddleware } from './middlewares/error.middleware.js';
import authRouter from './features/auth/auth.route.js'
import { authenticate } from './features/auth/auth.middleware.js';
import adminRouter from './features/admin/admin.route.js'

const app=express()

app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(cookieParser())

app.get('/health',(req,res)=>{
    res.send('Server is Running')
})

app.get('/',(req,res)=>{
    res.status(201).json({
        message:'This is the home page demonstration like the real website'
    })
})

app.get('/dashboard',authenticate,(req,res)=>{
    res.status(201).json({
        message:'This is the dashboard page for specific user protected demonstration like the real website'
    })
})

app.use('/auth',authRouter)
app.use('/admin',adminRouter)

app.use(globalErrorMiddleware)
export default app;