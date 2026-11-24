import app from './app.js';
import dotenv from 'dotenv';
import { pool } from './config/db.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

const client=await pool.connect();
client.release();



app.listen(PORT, () => {
  console.log(` SeatFlow server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(` Health check available at: http://localhost:${PORT}/health`);
});