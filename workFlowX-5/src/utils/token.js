import jwt from 'jsonwebtoken'
import crypto from 'crypto'

//  Payload includes userId AND sessionId so protected routes know which device called.
export const generateAccessToken=(user,sessionId)=>{
    return jwt.sign(
        {
            userId:user._id,
            email:user.email,
            sessionId:sessionId
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn:'15m'
        }
    )
}

// export const generateRefreshToken=(user)=>{
//     return jwt.sign(
//         {
//             userId:user._id
//         },
//         process.env.REFRESH_TOKEN_SECRET,
//         {
//             expiresIn:'7d'
//         }
//     )
// }

// why use crypto than jwt : answer it 
// Generates a cryptographically strong, 80-character random refresh token.
//  * 40 bytes = 320 bits of pure entropy (impossible to guess or brute-force).

export const generateRefreshToken=()=>{
    return crypto.randomBytes(40).toString('hex')
}

// Fast, one-way SHA-256 hash of a refresh token for safe storage in Redis.
//  * Runs in microseconds (<0.005ms) without blocking Node's event loop.

export const hashToken =(token)=>{
    return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex')
}



// 1. Should these token generation functions be async or sync?

// It is much better to make them completely synchronous (remove async).
// Here is why:
// jwt.sign() runs synchronously by default unless you pass it a callback function.
// Making a function async when it contains no asynchronous operations (like database lookups or network calls) adds unnecessary overhead. JavaScript has to wrap the returned string in a Promise object, forcing you to use await when calling it later.