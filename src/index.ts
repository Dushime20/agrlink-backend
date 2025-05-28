import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import mongoose from 'mongoose';
import errorHandler from './middleware/errorHandler';
import route from './route/index';

dotenv.config();

const app = express();
const port = process.env.PORT || 3300;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set.");
}

// Choose origin based on environment
const allowedOrigin =
  process.env.NODE_ENV === 'production'
    ? 'https://agrlink.vercel.app'
    : 'http://localhost:5173';

app.use(cors({
  origin: allowedOrigin,
  methods: ['POST', 'GET', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(
  express.json({
    verify: (req, res, buf) => {
      // Store raw body for signature validation
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  })
);



app.use('/agritech/v1', route);

// Cast errorHandler to Express error handler type
app.use(errorHandler as express.ErrorRequestHandler);

mongoose.connect(databaseUrl)
  .then(() => {
    console.log('DB connected');
    app.listen(port, () => {
      console.log(`Server is running at http://localhost:${port}`);
    });
  })
  .catch(err => {
    console.error('Failed to connect to DB:', err.message);
    process.exit(1);
  });
