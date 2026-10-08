import mongoose from 'mongoose'

const categorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Category name is required'],
            unique: true,
            trim: true,
            minLength: [2, 'Category name must be at least 2 characters'],
            maxLength: [50, 'Category name must be less than 50 characters']
        },
        description: {
            type: String,
            trim: true,
            maxLength: [200, 'Description cannot exceed 200 characters'],
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
)


const Category=mongoose.model('Category',categorySchema)
export default Category;