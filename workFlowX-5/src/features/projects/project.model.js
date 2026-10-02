import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            minLength: 2,
            maxLength: 150

        },
        description: {
            type: String,
            required: true,
            trim: true,
            maxLength: 500
        },
        // Rules inside the bracket apply to individual items within the array.
        techStack: [{ type: String, trim: true ,maxLength:50}],
        nonTechStack:[{type:String,trim:true,maxLength:50}],

        status:{
            type:String,
            enum:['active','paused','completed','archived'],
            default:'active'
        },
        //The ObjectId type is used to reference other documents in different collections. This allows you to establish relationships between documents, much like foreign keys in relational databases.
        user:{
            type:mongoose.Schema.Types.ObjectId,
            ref:'User',
            required:true,
            index:true // Fast lookup by user
        },
        deadline:{
            type:Date,
            required:[true, 'please provide a project deadline']
        }
    },
    {
        timestamps:true
    }
)

export const Project=mongoose.model('Project',projectSchema)