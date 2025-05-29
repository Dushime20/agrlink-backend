import { BadRequestError } from "../error/BadREquestError";
import asyncWrapper from "../middleware/async";

import { v2 as cloudinary } from "cloudinary";
import Product from "../model/ProductModel";
import { productSchema } from "../utils/validation";
import { NotFoundError } from "../error/NotFoundError";
import { Response,Request, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/authenticationToken";

export const addProduct = asyncWrapper(async(req:AuthenticatedRequest,res:Response,next:NextFunction) => {
  
    // Extract seller ID from the authenticated user in the token
    const sellerId = req.user?.id;
    console.log("seller id:",sellerId)
    
    if(!sellerId){
        return next(new NotFoundError("seller not found"));
    }

    

    const { name, description, price, category, stock, location } = req.body;

        const { error } = productSchema.validate(req.body, { abortEarly: false });
    
        if (error) {
            return next(new BadRequestError(error.details.map(err => err.message).join(", ")));
        }
    

    // Check if an image was uploaded
    let imageUrl = "";
    let publicId = "";
    
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path);
      imageUrl = result.secure_url;
      publicId = result.public_id;
    }

    // Create a new product
    const newProduct = await Product.create({
      name,
      description,
      price,
      category,
      stock,
      location,
      seller: sellerId, // Set seller from token
      images: imageUrl ? [{ url: imageUrl, public_id: publicId }] : [],
    });

    res.status(201).json({
      success: true,
      message: "Product added successfully",
      product: newProduct,
    });
 
});


export const getAllProducts = asyncWrapper(async(req:Request,res:Response,next:NextFunction) => {
    const products = await Product.find().populate('seller'); // Fetch all products from the database

    res.status(200).json({
        success: true,
        count: products.length,
        products,
        
    });
});

export const getProductById = asyncWrapper(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  const product = await Product.findById(id).populate('seller');

  if (!product) {
    return next(new NotFoundError("Product not found"));
  }

  res.status(200).json({
    success: true,
    product,
    seller: product.seller,
  });
});


//get product by sellId
export const getBySellerId = asyncWrapper(async(req:AuthenticatedRequest,res:Response,next:NextFunction)=>{

    const sellerId = req.user?.id
    const product = await Product.find({ seller: sellerId }).populate('seller');

     
    if (!product) {
        return next(new NotFoundError("Product not found"));
    }

    res.status(200).json({
        success: true,
        product,
    });
})

export const filterProductByNameAndPriceAndCategory = asyncWrapper(async(req:Request,res:Response,next:NextFunction) => {
    const { name, price, category } = req.body; 

     const filter: Record<string, any> = {};

    if (name) {
        filter.name = { $regex: name, $options: "i" }; // Case-insensitive search
    }

    if (price) {
        filter.price = Number(price); // Exact price match
    }

    if (category) {
        filter.category = category;
    }

    const products = await Product.find(filter);

    res.status(200).json({
        success: true,
        message:"product is filtered successfully",
        count: products.length,
        products,
    });
});


export const deleteProduct = asyncWrapper(async(req:Request,res:Response,next:NextFunction)=> {
    const { id } = req.params;

    // Check if Product exists
    const findProduct = await Product.findById(id);
    if (!findProduct) {
        return next(new NotFoundError("Product not found!"));
    }

    // Delete Product
    const deletedProduct = await Product.findByIdAndDelete(id);

    return res.status(200).json({
        success: true,
        message: "Successfully deleted Product",
    });
});