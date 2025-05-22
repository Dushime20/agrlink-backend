import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';

// Load environment variables from .env file
dotenv.config();

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.Cloud_name, // Ensure the correct case for variable names
  api_key: process.env.API_Key,
  api_secret: process.env.API_Secret,
});

export default cloudinary;
