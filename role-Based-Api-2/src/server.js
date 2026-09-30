import app from './index.js'
import connectDB from './config/db.js';
import dotenv from 'dotenv'

dotenv.config()

const PORT = process.env.PORT || 5000;

const server = async (PORT) => {

    await connectDB()

    app.listen(PORT, () => {
        console.log(`Server is running at http://localhost:${PORT}`)
    })
}

server(PORT)
