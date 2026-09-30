import AppError from "../../utils/appError.js"
import { User } from "./auth.model.js"
import bcrypt from 'bcrypt'
import { createSessionService, destroySession } from "./session.service.js"


export const registerService=async(body)=>{
    const {name,email,password}=body

    if(!name || !email || !password){
        throw new AppError('All Fields are required',400)
    }

    if(password.length <10){
        throw new AppError('password must be length of more than 10',400)
    }

    const existingUser=await User.findOne({email})

    if(existingUser){
        throw new AppError('User already exist',401)
    }

    const hashedPassword=await bcrypt.hash(password,12)

    const user=await User.create({
        name,
        email,
        password:hashedPassword
    })

    return user
}

export const loginService=async(body,metadata={})=>{
    const {email,password}=body

    if(!email || !password){
        throw new AppError('All Fields are required',400)
    }

    const user=await User.findOne({email}).select('+password')

     if(!user){
        throw new AppError('User does not exist',401)
    }

    const isMatch=await bcrypt.compare(password,user.password)

    if(!isMatch){
        throw new AppError('Invalid email and password',401)
    }

    const session=await createSessionService(user._id,metadata)

    return{
        user,
        session
    }

}

export const logoutService=async(id)=>{

    if(id){
        await destroySession(id)
    }

}