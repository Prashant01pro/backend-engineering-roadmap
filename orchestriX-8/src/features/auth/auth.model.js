import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Please provide name'],
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
            match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/, 'Please provide a valid email address'],
        },
        password: {
            type: String,
            required: [true, 'Please provide a password'],
            select: false,
            minLength: 10,
            maxLength: 100
        },
        bio: {
            type: String,
            trim: true,
            maxLength: 250
        },
        avatar: {
            key: { type: String, default: null },       // Storage filename/key
            url: { type: String, default: null },
            publicId: { type: String, default: null },
            mimeType: { type: String, default: null },
            size: { type: Number, default: null },
            updatedAt: { type: Date, default: null }
        },
        role: {
            type: String,
            enum: ['user', 'admin'],
            default: 'user'
        },
        resetPasswordToken: {
            type: String,
            select: false
        },
        resetPasswordExpires: {
            type: Date,
            select: false
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
        verificationToken: {
            type: String,
            select: false, // Never return in queries
        },
        verificationTokenExpires: {
            type: Date,
            select: false,
        },

    },
    {
        timestamps: true
    }
)
const User = mongoose.model('User', userSchema)
export default User;
