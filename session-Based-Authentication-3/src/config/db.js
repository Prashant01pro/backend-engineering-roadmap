import mongoose from "mongoose";
import AppError from "../utils/appError.js";

export const connectDB = async () => {
    try {

        const dbUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/';

        await mongoose.connect(dbUri)
        console.log('Database is connected')

    } catch (error) {
        if (error instanceof AppError) throw error

        console.error('Database connection failed:', error);
        // Gracefully exit the process on critical connection failure
        process.exit(1);
    }
}