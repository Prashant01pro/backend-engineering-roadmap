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
            match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address'],
        },
        password: {
            type: String,
            required:[true,'Please provide a password'],
            select:false,
            minLength: 10,
            maxLength: 100
        },
        bio:{
            type:String,
            optional:true
        },
        refreshToken:{
            type:String,
            default:null,
            select:false
        },
        resetPasswordToken:{
            type:String,
            select:false 
        },
        resetPasswordExpires:{
            type:Date,
            select:false
        },
        role:{
            type:String,
            enum:['USER','ADMIN','MODERATOR'],
            default:'USER'
        },
        isBanned:{
            type:Boolean,
            default:false
        }

    },
    {
        timestamps: true
    }
)
const User = mongoose.model('User', userSchema)
export default User;
