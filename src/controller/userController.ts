import { NextFunction, Request, Response } from "express";
import { BadRequestError } from "../error/BadREquestError";
import { AuthenticatedRequest } from "../middleware/authenticationToken";

import { NotFoundError } from "../error/NotFoundError";
import { UnauthorizedError } from "../error/UnauthorizedError";
import asyncWrapper from "../middleware/async";
import User from "../model/userModel";
import { signinValidation, signUpSchema } from "../utils/validation";
import bcrypt from 'bcrypt'
import jwt from "jsonwebtoken"



const saltRounds = 10;

const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(saltRounds);
  return await bcrypt.hash(password, salt);
};

export const signUp = asyncWrapper(async (req: Request, res: Response, next: NextFunction) => {
 const {
  password,
  confirmPassword,
  username,
  phoneNumber,
  address,
  email,
  role,
} = req.body;

  const { error } = signUpSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return next(new BadRequestError(error.details.map((err) => err.message).join(', ')));
  }

  if (password !== confirmPassword) {
    return next(new BadRequestError('Password and Confirm Password do not match.'));
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    return next(new BadRequestError('Email already exists.'));
  }

  const hashedPassword = await hashPassword(password);

  const newUser = new User({
    username: username,
    email: email.toLowerCase(),
    address: address,
    phoneNumber: phoneNumber,
    password: hashedPassword,
    role: role || 'user', // default role
  });

  const savedUser = await newUser.save();
  console.log('User is saved.');

  return res.status(201).json({
    message: 'User created successfully',
    user: {
      id: savedUser._id,
      username: savedUser.username,
      email: savedUser.email,
      role: savedUser.role,
      phoneNumber: savedUser.phoneNumber,
      address: savedUser.address,
    },
  });
});


export const signin = asyncWrapper(async(req:Request,res:Response,next:NextFunction) => {
    const { email, password } = req.body;
  
    // Validate input fields
    const { error } = signinValidation.validate(req.body, { abortEarly: false });
    if (error) {
      return next(new BadRequestError(error.details.map(err => err.message).join(", ")));
    }
  
    // Check if user exists
    const foundUser = await User.findOne({ email }); 
    if (!foundUser) {
      return next(new UnauthorizedError("Invalid email or password")); 
    }
  
    // Validate password
    const isPasswordMatch = await bcrypt.compare(password, foundUser.password);

    
    if (!isPasswordMatch) {
      return next(new UnauthorizedError("Invalid email or password")); // 🔹 Security Improvement
    }
  
   const jwtSecret = process.env.JWT_SECRET_KEY;
if (!jwtSecret) {
  throw new Error("JWT_SECRET_KEY environment variable is not set.");
}

const token = jwt.sign(
  { id: foundUser._id.toString(), email: foundUser.email, role: foundUser.role },
  jwtSecret,
  { expiresIn: "7d" }
);

  
    // Send response
    return res.status(200).json({
      success: true,
      message: "User logged in successfully",
      token:token
    });
  
  });


  export const getAllUser = asyncWrapper(async(req:Request,res:Response,next:NextFunction)=>{
    
    const findUser = await User.find();
    if(findUser){
        return res.status(200).json({
            message: "user found successfully",
            size: findUser.length,
            findUser,
        })
    }

  })

  export const getUserById = asyncWrapper(async(req:Request,res:Response,next:NextFunction)=>{
    const findUser = await User.findById(req.params.id)
    if(!findUser){
        return next(new NotFoundError("user not found"))
    }

    return res.status(200).json({
        message:"user Found successfully",
        findUser,
    })
  })

  export const getUserProfile = asyncWrapper(async(req:AuthenticatedRequest,res:Response,next:NextFunction)=>{
    const user = req.user?.id;
    if (!user) return next(new BadRequestError("User not authenticated"));
    const findUser = await User.findById(user)
    if(!findUser){
        return next(new NotFoundError("user not found"))
    }

    return res.status(200).json({
        message:"user Found successfully",
        findUser,
    })
  })

export const updateUserProfile = asyncWrapper(async(req:Request,res:Response,next:NextFunction)=> {
    const { id } = req.params;

    // Check if user exists
    const findUser = await User.findById(id);
    if (!findUser) {
        return next(new NotFoundError("User not found!"));
    }

    // Update user profile
    const updatedUser = await User.findByIdAndUpdate(id, req.body, {
        new: true, // Return the updated document
        runValidators: true, // Ensure the update follows schema validation
    });

    return res.status(200).json({
        user: updatedUser,
        message: "Successfully updated user profile",
    });
});


export const deleteUser = asyncWrapper(async(req:Request,res:Response,next:NextFunction)=> {
    const { id } = req.params;

    // Check if user exists
    const findUser = await User.findById(id);
    if (!findUser) {
        return next(new NotFoundError("User not found!"));
    }

    // Delete user
    const deletedUser = await User.findByIdAndDelete(id);

    return res.status(200).json({
        success: true,
        message: "Successfully deleted user",
    });
});





