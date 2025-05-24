import { NextFunction, Request, Response } from "express";
import asyncWrapper from "../middleware/async";
import { AuthenticatedRequest } from "../middleware/authenticationToken";

import Order from "../model/OrderSchema";
import { NotFoundError } from "../error/NotFoundError";
import Product from "../model/ProductModel";
import { BadRequestError } from "../error/BadREquestError";

import crypto from "crypto"; // Ensure this is at the top

export const createOrder = asyncWrapper(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { productId } = req.params;
    const {
      quantity,
      shippingAddress,
      paymentMethod,
      deliveryDate,
    } = req.body;

    const buyer = req.user?.id;

    if (!buyer) {
      return next(new BadRequestError("Buyer not authenticated"));
    }

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

    const productDoc = await Product.findById(productId);
    if (!productDoc) {
      return next(new NotFoundError(`Product with ID ${productId} not found`));
    }

    const seller = productDoc.seller;
    const totalAmount = productDoc.price * parseInt(quantity);

    // Generate a random transaction ID with 'TXN-' prefix
    const transactionId = `TXN-${crypto.randomBytes(8).toString("hex")}`;

    const order = await Order.create({
      orderId: `ORD-${Date.now()}`,
      buyer,
      seller,
      product: {
        productId,
        quantity,
        price: productDoc.price,
      },
      totalAmount,
      shippingAddress: {
        fullName: shippingAddress.fullName,
        phoneNumber: shippingAddress.phoneNumber,
        streetAddress: shippingAddress.streetAddress,
        city: shippingAddress.city,
      },
      paymentMethod,
      transactionId,
      deliveryDate: deliveryDate || null,
    });

    res.status(201).json({ success: true, order });
  }
);


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
