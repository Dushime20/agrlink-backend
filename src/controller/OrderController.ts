import { NextFunction, Request, Response } from "express";
import asyncWrapper from "../middleware/async";
import { AuthenticatedRequest } from "../middleware/authenticationToken";

import Order from "../model/OrderSchema";
import { NotFoundError } from "../error/NotFoundError";
import Product from "../model/ProductModel";
import { BadRequestError } from "../error/BadREquestError";

import crypto, { randomBytes } from "crypto"; // Ensure this is at the top

export const createOrder = asyncWrapper(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { productId } = req.params;
    const {
      quantity,
      shippingAddress,
      paymentMethod,
      deliveryDate,
      paymentChannel,
      paymentMetadata,
      paymentVerified,
    } = req.body;

    const buyer = req.user?.id;
    if (!buyer) return next(new BadRequestError("Buyer not authenticated"));

    if (
      !productId ||
      !quantity ||
      !shippingAddress ||
      !shippingAddress.fullName ||
      !shippingAddress.phoneNumber ||
      !shippingAddress.streetAddress ||
      !shippingAddress.city ||
      !paymentMethod
    ) {
      return next(new BadRequestError("Missing required order fields"));
    }

    // Validate quantity is a positive integer
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      return next(new BadRequestError("Quantity must be a positive number"));
    }

    const productDoc = await Product.findById(productId);
    if (!productDoc) {
      return next(new NotFoundError(`Product with ID ${productId} not found`));
    }

    const seller = productDoc.seller;
    const totalAmount = productDoc.price * qty;

    const transactionId = `TXN-${randomBytes(8).toString('hex')}`;


    const order = await Order.create({
      orderId: `ORD-${Date.now()}`,
      buyer,
      seller,
      product: {
        productId,
        quantity: qty,
        price: productDoc.price,
      },
      totalAmount,
      shippingAddress,
      paymentMethod,
      transactionId,
      deliveryDate: deliveryDate || null,
      paymentChannel: paymentChannel || "card",
      paymentMetadata: paymentMetadata || {},
      paymentVerified: paymentVerified || false,
    });

    res.status(201).json({ success: true, order });
  }
);


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



export const getAllOrders = asyncWrapper(
  async (req: Request, res: Response, next: NextFunction) => {
    const orders = await Order.find()
      .populate("buyer", "name email")
      .populate("seller", "name email")
      .populate("product.productId", "name price");

    res.status(200).json({ success: true, orders });
  }
);

//get order by buyerId

export const getOrdersByBuyerId = asyncWrapper(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const buyerId = req.user?.id;

    const orders = await Order.find({ buyer: buyerId })
      .populate("seller", "name email")
      .populate("product.productId", "name price");

    res.status(200).json({ success: true, orders });
  }
);

//get order by sellId
export const getOrdersBySellerId = asyncWrapper(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const sellerId = req.user?.id;

    const orders = await Order.find({ seller: sellerId })
      .populate("buyer", "name email")
      .populate("product.productId", "name price");

    res.status(200).json({ success: true, orders });
  }
);
