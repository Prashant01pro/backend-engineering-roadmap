import crypto from 'crypto'
import AppError from '../../utils/appError.js'
// import { createSession,getSession,deleteSession,getUserSessions, deleteAllUserSessions } from '../../stores/memory-sessions.store.js'

import { 
    createSession, 
    getSession, 
    deleteSession, 
    getUserSessions, 
    deleteAllUserSessions 
} from '../../stores/redis.sessions.store.js'


const SESSIONDURATION=7*24*60*60*1000

export const createSessionService=async(userId,metadata = {})=>{
    const sessionId=crypto.randomBytes(32).toString('hex')

    const now=new Date()

    const session={
        userId:userId.toString(),
        userAgent:metadata.userAgent || 'Unknown Device',
        ip:metadata.ip || 'Unknown Ip',
        createdAt:now,
        expiresAt:new Date(now.getTime()+SESSIONDURATION)
    }

    await createSession(sessionId,session)

    return {session,sessionId}
}

export const getUserSession = async(sessionId) => {
    return await getSession(sessionId)
}

export const destroySession = async(sessionId) => {
    await deleteSession(sessionId)
}

export const getAllUserSessionsService=async(userId)=>{
    return await getUserSessions(userId)
}

export const destroyAllUserSessionsService=async(userId)=>{
    await deleteAllUserSessions(userId)
}

export const destroySpecificSessionService=async(userId,targetSessionsId)=>{
    const targetSession=await getSession(targetSessionsId)

     if (!targetSession || targetSession.userId !== userId.toString()) {
        throw new AppError('Session not found or unauthorized', 404)
    }
    await deleteSession(targetSessionsId)
}