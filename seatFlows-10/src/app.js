import express from 'express';
import cors from 'cors';
import { pool } from './config/db.js';
import { globalErrorMiddleware } from './middleware/error.middleware.js';

const app = express();
     
app.use(cors());
app.use(express.json()); 

app.get('/health', async (req, res) => {
  try {
    const dbResult = await pool.query('SELECT NOW() as current_time');
    res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      database: 'Connected',
      db_time: dbResult.rows[0].current_time,
    });
  } catch (error) {
    res.status(500).json({
      status: 'DOWN',
      timestamp: new Date().toISOString(),
      database: 'Disconnected',
      error: error.message,
    });
  }
});


app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

app.use(globalErrorMiddleware)

export default app;