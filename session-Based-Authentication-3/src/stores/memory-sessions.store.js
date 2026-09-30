const session=new Map()

const userSessions=new Map()

export const createSession=(sessionId,sessionData)=>{
    session.set(sessionId,sessionData)

    if(!userSessions.has(sessionData.userId)){
        userSessions.set(sessionData.userId,new Set())
    }

    userSessions.get(sessionData.userId).add(sessionId)

}

export const getSession=(sessionId)=>{
    return session.get(sessionId)
}

export const deleteSession=(sessionId)=>{
    const sessionData=session.get(sessionId)

    if(sessionData){
        userSessions.get(sessionData.userId)?.delete(sessionId)
    }

    session.delete(sessionId)
}

export const getUserSessions=(userId)=>{
    const sessionIds=userSessions.get(userId)

    if(!sessionIds) return []

    const activeSessions=[]
    for (const id of sessionIds){
        const data=session.get(id)
        if(data){
            activeSessions.push({sessionId:id,...data})
        }
    }
    return activeSessions
}

// Notice: we include { sessionId: id, ...data } 
// so the frontend knows each device's session ID if the user wants to terminate that specific device).


export const deleteAllUserSessions=(userId)=>{
    const sessionIds=userSessions.get(userId)

    if (!sessionIds) return
    for (const id of sessionIds) {
        session.delete(id)
    }
    userSessions.delete(userId)
}