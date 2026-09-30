import jwt from 'jsonwebtoken'

export const generateAccessToken=(user)=>{
    return jwt.sign(
        {
            userId:user._id,
            email:user.email
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn:'15m'
        }
    )
}

export const generateRefreshToken=(user)=>{
    return jwt.sign(
        {
            userId:user._id
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn:'7d'
        }
    )
}

// 1. Should these token generation functions be async or sync?

// It is much better to make them completely synchronous (remove async).
// Here is why:
// jwt.sign() runs synchronously by default unless you pass it a callback function.
// Making a function async when it contains no asynchronous operations (like database lookups or network calls) adds unnecessary overhead. JavaScript has to wrap the returned string in a Promise object, forcing you to use await when calling it later.