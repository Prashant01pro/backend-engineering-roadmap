// import dotenv from 'dotenv'
import 'dotenv/config'

import app from "./app.js";
import { connectDB } from "./config/db.js";

// dotenv.config()

const PORT=process.env.PORT || 5000

const startServer=async(PORT)=>{
    await connectDB()

    app.listen(PORT,()=>{
        console.log(`Server is running at http://localhost:${PORT}`)
    })
}

startServer(PORT)