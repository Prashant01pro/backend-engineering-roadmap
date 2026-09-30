import AppError from "../../utils/appError.js"
import { User } from "../auth/auth.model.js"

export const getMeService=async(id)=>{

    const user=await User.findById(id)

    if(!user){
        throw new AppError('Invalid user or Expires session ',401)
    }

    return user;

}