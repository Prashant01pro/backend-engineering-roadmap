import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            minLength: 2,
            maxLength: 50

        },
        email: {
            type: String,
            required: [true, 'Please provide a email'],
            lowercase: true,
            trim: true,
            unique: true,
            match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address'],
        },
        password: {
            type: String,
            required: [true, 'Please provide a password'],
            select: false,
            minLength: 10,
            maxLength: 100
        },
    }
)

export const User=mongoose.model('User',userSchema);