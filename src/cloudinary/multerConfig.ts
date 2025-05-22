import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from './cloudinaryConfig';
import { Request } from 'express';

// Create Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req: Request, file: Express.Multer.File) => {
    // Get the file extension from the original filename or mimetype
    let format = '';
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') {
      format = 'jpg';
    } else if (file.mimetype === 'image/png') {
      format = 'png';
    }
    
    return {
      folder: 'agrli-app',
      format: format,
      public_id: `sample-${Date.now()}`,
      resource_type: 'image'
    };
  }
});

// Define allowed MIME types
const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];

// Create file filter
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true); // accept file
  } else {
    // TypeScript requires the first argument to be null for FileFilterCallback
    cb(null, false);
    (req as any).fileValidationError = 'Only jpeg, jpg, and png images are allowed!';
  }
};

// Create multer upload object with file size limit
const upload = multer({ 
  storage, 
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // limit file size to 5MB
  }
});

export default upload;

// import multer from "multer";
// import { CloudinaryStorage } from "multer-storage-cloudinary";
// import cloudinary from "./cloudinaryConfig.js";

// const storage = new CloudinaryStorage({
//   cloudinary: cloudinary,
//   params: async (req, file) => {
//     let folder = "chat_app"; // Cloudinary folder
//     let resourceType = "auto"; // Automatically detect type

//     // Handle different file types
//     if (file.mimetype.startsWith("image/")) {
//       resourceType = "image"; // Store as an image
//     } else if (file.mimetype.startsWith("audio/")) {
//       resourceType = "video"; // Cloudinary treats audio as "video"
//     } else if (file.mimetype.startsWith("video/")) {
//       resourceType = "video"; // Store as a video
//     }

//     return {
//       folder,
//       resource_type: resourceType, // Set appropriate type
//       public_id: `chat-${Date.now()}`, // Unique filename
//     };
//   },
// });

// const upload = multer({ storage: storage })

// export default upload;

