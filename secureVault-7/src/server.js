import 'dotenv/config'
import app from './app.js'
import { connectDB } from './config/db.js'


const server=async()=>{

    await connectDB()

    const PORT=process.env.PORT || 5000

    app.listen(PORT,()=>{
        console.log(`server is running at http://localhost:${PORT}`)
    })
    
}

// Using await means telling JavaScript to pause and wait for an asynchronous task to finish before moving to the next line of code inside that function.

await server()