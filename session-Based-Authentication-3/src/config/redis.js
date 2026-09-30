import Redis from 'ioredis'
//import dotenv from 'dotenv'

//dotenv.config()

const redisUri = process.env.REDIS_URI || 'redis://127.0.0.1:6379'

export const redis = new Redis(redisUri)

redis.on('connect', () => {
    console.log('Connected to Redis successfully')
})

redis.on('error', (err) => {
    console.error(' Redis connection error:', err)
})