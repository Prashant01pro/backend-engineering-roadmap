import { catchAsync } from "../../utils/catchAsync.js";
import { getMeService } from "./user.service.js";

export const me=catchAsync(async(req,res)=>{
    const {userId}=req.session

    const user=await getMeService(userId)

    res.status(200).json({
        id:user._id,
        name:user.name,
        email:user.email
    })

    
})