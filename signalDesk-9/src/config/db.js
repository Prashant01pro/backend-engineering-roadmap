import mongoose, { mongo } from 'mongoose'
import AppError from '../utils/appError.js'
import { env } from './env.js';
import { logger } from './logger.js';

export const connectDB = async () => {
    const dbUri = process.env.MONGO_URI || env?.MONGO_URI || 'mongodb://127.0.0.1:27017'

    try {

        // lifecycle event listeners
        mongoose.connection.on('connected', () => {
            logger.info('MongoDB connection established')
        })

        mongoose.connection.on('error', () => {
            logger.error({ err }, 'MongoDB connection error occured')
        })

        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected')
        })

        await mongoose.connect(dbUri, { serverSelectionTimeoutMS: 5000 }) //  // Fail fast during boot if MongoDB is not reachable within 5s
        // console.log("Database is connected")

    } catch (error) {

        logger.fatal({ err: error }, 'Failed to connect to MongoDB during startup');
        throw error;

        // if (error instanceof AppError) throw error

        // console.error('Database connection failed: ', error)
        // process.exit(1)
    }
}

export const disconnectDB=async()=>{
    try{
        await mongoose.connection.close(false);
        logger.info('MongoDB connection closed gracefully');
    }catch(error){
        logger.error({err:error},'Error during MongoDB disconnection')
    }
}



// export const connectDB=async()=>{
//     const dbUri=process.env.MONGO_URI || 'mongodb://127.0.0.1:27017'
//     try {
//         await mongoose.connect(dbUri)
//         console.log("Database is connected")
//     } catch (error) {
//         if(error instanceof AppError) throw error

//         console.error('Database connection failed: ',error)
//         process.exit(1)
//     }
// }