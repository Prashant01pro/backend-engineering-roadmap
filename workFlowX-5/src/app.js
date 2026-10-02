import express, { urlencoded } from 'express'
import { globalErrorHandler } from './middlewares/error.middleware.js'
import cookieParser from 'cookie-parser'
import authRouter from './features/auth/auth.route.js'
import userRouter from './features/users/user.route.js'
import projectsRouter from './features/projects/project.route.js'
import taskRouter from './features/tasks/task.route.js'

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
app.use('/api/v1/projects',projectsRouter)
app.use('/api/v1/tasks',taskRouter)

app.use(globalErrorHandler)

export default app;