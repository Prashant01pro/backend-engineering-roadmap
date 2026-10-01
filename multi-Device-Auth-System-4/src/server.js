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

// No, it is not strictly necessary to use await when calling an asynchronous function like server().
// However, what happens next depends entirely on whether you put await in front of it or not.

// 1. If you call it WITHOUT await (server())
// The function will start executing immediately. Because it is asynchronous, JavaScript will not wait for it to finish. It will instantly move on to execute any code written below the server() call.

// 2. If you call it WITH await (await server())
// JavaScript will completely pause execution at that line. It will wait until the entire server() function finishes running (meaning connectDB() resolves and app.listen() executes) before it allows any code below that line to run.