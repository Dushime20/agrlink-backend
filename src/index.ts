import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import mongoose from 'mongoose';
import errorHandler from './middleware/errorHandler';
import route from './route/index';

dotenv.config();

const app = express();
const port = 3300;
const databaseUrl: string = process.env.DATABASE_URL!;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set.");
}

app.use(cors({
  origin: "http://localhost:5173",
  methods: ["POST","GET","PUT","PATCH","DELETE"],
  allowedHeaders: ['content-type','Authorization']
}));

app.use(express.json());

app.use("/agritech/v1", route);

// Cast error handler to proper Express error handler type
app.use(errorHandler as express.ErrorRequestHandler);

const server = app.listen(port, () => {
  console.log(`server is running at http://localhost:${port}`);
});

mongoose.connect(databaseUrl)
  .then(() => console.log("DB connected"))
  .catch(err => console.log(err.message));
