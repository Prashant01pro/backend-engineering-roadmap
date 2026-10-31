import mongoose from "mongoose";


const memberSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required for team member']
        },
        role: {
            type: String,
            enum: {
                values: ['lead', 'investigator', 'observer'],
                message: '{VALUE} is not a valid team role'
            },
            default: 'investigator'
        },
        joinedAt: {
            type: Date,
            default: Date.now
        }
    },
    { _id: false } // No separate _id needed for subdocuments
);


const teamSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Team name is required'],
            trim: true,
            unique: true,
            minLength: [2, 'Team name must be at least 2 characters'],
            maxLength: [50, 'Team name cannot exceed 50 characters']
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        description: {
            type: String,
            trim: true,
            maxLength: [250, 'Description cannot exceed 250 characters'],
            default: ''
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        members: [memberSchema]
    },
    {
        timestamps: true
    }
)

teamSchema.index({'members.user':1})

const Team = mongoose.model('Team', teamSchema)
export default Team;