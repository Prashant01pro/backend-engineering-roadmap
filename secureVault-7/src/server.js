import 'dotenv/config'
import app from './app.js'
import { connectDB } from './config/db.js'
import { redis } from './config/redis.js'
import mongoose from 'mongoose'

const PORT = process.env.PORT || 5000
await connectDB()

//server variable stores a reference to this active listener instance.
const server = app.listen(PORT, () => {
    console.log(`server is running at http://localhost:${PORT}`)
})

const gracefulShutdown = async (signal) => {
    console.log(`\n Received ${signal}.Starting graceful shutdown...`)

    server.close(async () => {
        console.log('HTTP server closed.')

        try {
            await mongoose.connection.close(false)
            console.log('MongoDB connection closed.')

            await redis.quit()
            console.log('Redis connection closed.')

            process.exit(0)
        } catch (err) {
            console.error('Error during shutdown:', err)
            process.exit(1)
        }
    })

    // force shutdown if cleanup takes more than 10 seconds
    setTimeout(() => {
        console.error("Forced shutdown due to timeout")
        process.exit(1)
    }, 10000)

    //  Timeout Safeguard:
    //  setTimeout(..., 10000): If cleanup hangs or takes longer than 10 seconds, it forces an immediate shutdown (process.exit(1)) to prevent the server from getting stuck indefinitely.
}

// Graceful Shutdown Function (gracefulShutdown):
//  server.close(...): Stops accepting new HTTP requests while letting existing inflight requests finish.
//  await mongoose.connection.close(false): Closes the MongoDB connection gracefully (false means do not force-close pending operations).
//  await redis.quit(): Gracefully disconnects the Redis client by waiting for pending commands to execute.
//  process.exit(0): Exits the Node.js process cleanly with a "success" status code.


process.on('SIGINT', () => gracefulShutdown('SIGINT'))
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))

//  What happens: Node.js registers event listeners for operating system termination signals. SIGINT triggers when you press Ctrl+C in your terminal. SIGTERM triggers when a production orchestrator (like Docker, Kubernetes, or PM2) asks the app to stop.
//  Why: By default, these signals immediately kill the process. Listening to them allows your app to finish outstanding work instead of abruptly cutting off users mid-request.

// Executing the Graceful Shutdown

// When a signal is caught, the gracefulShutdown function fires:
// server.close(async () => { ... })
// • What happens: server.close() stops the server from accepting new network requests but keeps the process alive long enough to finish any HTTP requests currently in flight. Once those are done, it fires the inner callback function.
// • Why: This ensures users who are in the middle of saving a profile or making a payment don't experience a sudden broken connection.




// Q: what is the motive to use this and why

// The core motive for using this specific setup is to build a production-grade, resilient backend application.
// In professional environments, simply turning a server "on" and "off" isn't enough. Code must be written to handle unexpected restarts, cloud scaling, and heavy user traffic without losing data or breaking user experiences.
// Here is the exact motive behind the two main patterns used in this code:

// 1. The Motive for "Top-Level Await" on Database Connections

// Instead of starting the HTTP server instantly and letting the database connect in the background, this code uses await connectDB() at the very top.
// • The Goal: Prevent a race condition.
// • Why it matters: When a server boots up (or reboots during a cloud update), it instantly tries to accept traffic. If a user visits your app in the first 2 seconds while MongoDB is still connecting, their request will fail with a database error.
// • The fix: By using await, you force the entire application to wait. The server will not open its ports to the public until it is 100% connected to MongoDB and ready to serve data safely.

// 2. The Motive for "Graceful Shutdown"

// In modern cloud hosting (like AWS, Google Cloud, Heroku, or Docker/Kubernetes), servers are destroyed and recreated constantly—either during automated scaling or when you deploy new code updates. When this happens, the hosting provider sends a death signal (SIGTERM or SIGINT) to your app.
// A standard node app shuts down like pulling a plug from a wall. A graceful shutdown handler changes that.

//  Reason A: Zero Downtime & Happy Users

// • Without it: If a user is in the middle of a 5-second database write (like processing a payment or uploading a profile image) and the server shuts down, their connection is abruptly cut. The user gets a generic network error, and their data might be half-saved or corrupted.
// • With it: server.close() tells the app: "Stop taking new visitors, but wait for the users currently on the site to finish what they are doing."

//  Reason B: Clean Resource Management

// • Without it: When an app dies abruptly, it leaves its database connections "hanging" open in the cloud. MongoDB and Redis won't know the server died immediately and will keep those connection slots occupied. If you scale up and down often, you can quickly hit your database's maximum connection limit, crashing your database cluster.
// • With it: mongoose.connection.close() and redis.quit() wave goodbye to the databases, freeing up the slots immediately for the next server instance.

//  Reason C: The 10-Second Time Bomb (The Safeguard)

// • Without it: If you tell your server to wait for connections to close, but a connection gets stuck in an infinite loop, the server will hang forever. It becomes a "zombie process"—taking up memory but doing no work.
// • With it: The setTimeout acts as an absolute deadline. It says, "We prefer to be polite and wait, but if cleanup takes longer than 10 seconds, kill the app immediately to save the physical server's memory."
// Are you setting this backend up to be deployed on a specific cloud service like Docker, AWS, PM2, or Heroku? I can explain how that platform interacts with these signals.
