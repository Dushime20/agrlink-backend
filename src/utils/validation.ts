

import Joi from "joi";


export const signUpSchema = Joi.object({
    username: Joi.string().min(3).max(30).required(),
    email: Joi.string().email().required(),
    address: Joi.string().required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid("Seller", "Buyer", "Admin").required(),
    confirmPassword: Joi.string()
        .valid(Joi.ref("password"))
        .required()
        .messages({ "any.only": "Passwords must match" }),
 phoneNumber: Joi.string()
        .pattern(/^[0-9]{10}$/) // Accepts exactly 10 digits (modify for your format)
        .required()
        .messages({
          "string.pattern.base": "Phone number must be 10 digits.",
          "any.required": "Phone number is required.",
        }),
});


export const signinValidation=Joi.object({
    password: Joi.string().min(6).required(),
    email: Joi.string().email().required(),
})




export const productSchema = Joi.object({
  name: Joi.string().min(3).max(100).required()
    .messages({
      "string.base": "Product name must be a string.",
      "string.empty": "Product name is required.",
      "string.min": "Product name must be at least 3 characters long.",
      "string.max": "Product name must be at most 100 characters long.",
      "any.required": "Product name is required.",
    }),

  description: Joi.string().min(10).max(1000).required()
    .messages({
      "string.base": "Description must be a string.",
      "string.empty": "Description is required.",
      "string.min": "Description must be at least 10 characters long.",
      "string.max": "Description must be at most 1000 characters long.",
      "any.required": "Description is required.",
    }),

  price: Joi.number().positive().precision(2).required()
    .messages({
      "number.base": "Price must be a number.",
      "number.positive": "Price must be a positive number.",
      "any.required": "Price is required.",
    }),

  category: Joi.string().min(3).max(50).required()
    .messages({
      "string.base": "Category must be a string.",
      "string.empty": "Category is required.",
      "string.min": "Category must be at least 3 characters long.",
      "string.max": "Category must be at most 50 characters long.",
      "any.required": "Category is required.",
    }),

  stock: Joi.number().integer().min(0).required()
    .messages({
      "number.base": "Stock must be a number.",
      "number.integer": "Stock must be an integer.",
      "number.min": "Stock cannot be negative.",
      "any.required": "Stock is required.",
    }),

  location: Joi.string().min(3).max(200).required()
    .messages({
      "string.base": "Location must be a string.",
      "string.empty": "Location is required.",
      "string.min": "Location must be at least 3 characters long.",
      "string.max": "Location must be at most 200 characters long.",
      "any.required": "Location is required.",
    }),

  images: Joi.string().uri().optional()
    .messages({
      "string.uri": "Image must be a valid URL.",
    }),
});

//add order schema validation
