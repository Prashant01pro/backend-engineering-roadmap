import Redis from 'ioredis'

const redisURI=process.env.REDIS_URI || 'redis://127.0.0.1:6379'

//creates a Redis client and immediately opens a network connection to your Redis database using the provided address.

export const redis=new Redis(redisURI)

//Connection Success Event Listener
redis.on('connect',()=>{
    console.log('Redis is connected')
})

//Error Handler Event Listener
redis.on('error',(err)=>{
    console.error('Redis connection error: ',err)
})


// ioredis npm library for a Node.js application. 
// It is a highly robust, production-ready way to manage Redis connections.

// Compared to the standard redis library, ioredis is heavily favored in production 
// because it has built-in support for advanced features like Redis Cluster, Sentinels, and automatically handles complex pipeline/stream structures.
