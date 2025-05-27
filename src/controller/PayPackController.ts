import axios, { AxiosError } from "axios";
import { Request, Response, NextFunction } from "express";
import asyncWrapper from "../middleware/async";
import Order from "../model/OrderSchema";
import { BadRequestError } from "../error/BadREquestError";
import { NotFoundError } from "../error/NotFoundError";
// Env vars
const PAYPACK_CLIENT_ID = process.env.PAYPACK_CLIENT_ID;
const PAYPACK_CLIENT_SECRET = process.env.PAYPACK_CLIENT_SECRET;
const PAYPACK_BASE_URL = process.env.PAYPACK_BASE_URL || "https://payments.paypack.rw";
const CALLBACK_URL = process.env.PAYPACK_CALLBACK_URL || "";

let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

interface PaypackTokenResponse {
  access_token?: string;
  expires_in?: number;
}

const getPaypackToken = async (): Promise<string> => {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  if (!PAYPACK_CLIENT_ID || !PAYPACK_CLIENT_SECRET) {
    throw new Error("Missing PayPack credentials");
  }

  const response = await axios.post<PaypackTokenResponse>(
    `${PAYPACK_BASE_URL}/api/auth/agents/authorize`,
    {
      client_id: PAYPACK_CLIENT_ID,
      client_secret: PAYPACK_CLIENT_SECRET,
    },
    {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 10000,
    }
  );

  const token = response.data.access_token;
  const expiresIn = response.data.expires_in || 3600;

  if (!token) throw new Error("No access token received from PayPack");

  cachedToken = token;
  tokenExpiry = Date.now() + (expiresIn - 300) * 1000;

  return token;
};

//  Test PayPack Connection
export const testPaypackConnection = asyncWrapper(async (req: Request, res: Response) => {
  try {
    await axios.get(PAYPACK_BASE_URL, { timeout: 5000 });

    const token = await getPaypackToken();

    res.status(200).json({
      success: true,
      message: "PayPack connection successful",
      tokenPreview: token.substring(0, 6) + "...",
    });
  } catch (error) {
    const err = error as AxiosError;
    res.status(500).json({
      success: false,
      message: "PayPack connection failed",
      error: err.message,
      details: err.response?.data,
    });
  }
});

interface Buyer {
  phoneNumber: string;
  name: string;
}

// Initiate Payment
export const initiatePaypackPayment = asyncWrapper(
  async (req: Request, res: Response, next: NextFunction) => {
    const { orderId } = req.params;

    if (!orderId) return next(new BadRequestError("Order ID is required"));

    const order = await Order.findOne({ orderId }).populate<{ buyer: Buyer }>("buyer", "phoneNumber name");

if (!order) return next(new NotFoundError("Order not found"));

// Now buyer is of type Buyer
  const buyer = order.buyer;
    if (!buyer?.phoneNumber) return next(new BadRequestError("Buyer phone number is missing"));

    // Normalize phone number to 2507XXXXXXXX
    let phone = buyer.phoneNumber.replace(/[\s-]/g, "");
    if (phone.startsWith("+25")) phone = phone.slice(1);
    else if (phone.startsWith("0")) phone = "25" + phone.slice(1);
    else if (!phone.startsWith("25")) phone = "25" + phone;

    const phoneRegex = /^2507[89]\d{7}$/;
    if (!phoneRegex.test(phone)) {
      return next(new BadRequestError("Invalid phone number. Must be 2507XXXXXXXX format."));
    }

    const token = await getPaypackToken();
    const transactionId = `TX-${orderId}-${Date.now()}`;

    order.transactionId = transactionId;
    order.paymentStatus = "Pending";
    await order.save();

    const paymentPayload = {
      amount: Math.round(order.totalAmount),
      phone,
      external_reference: transactionId,
      callback_url: CALLBACK_URL,
    };

    try {
      const response = await axios.post(
        `${PAYPACK_BASE_URL}/api/transactions/cashin`,
        paymentPayload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );

      res.status(200).json({
        success: true,
        message: "Payment initiated successfully",
        data: response.data,
      });
    } catch (error) {
      const err = error as AxiosError;
      res.status(500).json({
        success: false,
        message: "Failed to initiate payment",
        error: err.message,
        details: err.response?.data,
      });
    }
  }
);

// Enhanced payment verification
export const verifyPaypackPayment = asyncWrapper(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const transactionId = req.query.transactionId as string;
      if (!transactionId) {
        return next(new BadRequestError("Missing transactionId"));
      }

      const order = await Order.findOne({ transactionId });
      if (!order) {
        return next(new NotFoundError("Order not found"));
      }

      const token = await getPaypackToken();

      console.log("Verifying PayPack payment:", transactionId);

      const response = await axios.get<PaypackPaymentResponse>(
        `${PAYPACK_BASE_URL}/api/transactions/find/${transactionId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          timeout: 10000,
        }
      );

      const payment = response.data;

      if (!payment || !payment.status) {
        return res.status(400).json({
          success: false,
          message: "Invalid payment data received",
        });
      }

      console.log("Payment verification response:", {
        status: payment.status,
        ref: payment.ref,
      });

      // Check for successful payment statuses
      const successStatuses = ["successful", "completed", "paid"];
      if (successStatuses.includes(payment.status.toLowerCase())) {
        order.paymentStatus = "Paid";
        order.paymentVerified = true;
        order.paymentMetadata = payment;
        await order.save();

        return res.status(200).json({
          success: true,
          message: "Payment verified successfully",
          order,
        });
      }

      // Handle failed payments
      const failedStatuses = ["failed", "cancelled", "expired"];
      if (failedStatuses.includes(payment.status.toLowerCase())) {
        order.paymentStatus = "Failed";
        order.paymentVerified = true;
        order.paymentMetadata = payment;
        await order.save();

        return res.status(200).json({
          success: false,
          message: "Payment failed",
          status: payment.status,
        });
      }

      // Payment still pending
      return res.status(200).json({
        success: false,
        message: "Payment still pending",
        status: payment.status,
      });
    } catch (error) {
      console.error("Payment verification error:", error);

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        console.error("PayPack verification error:", {
          message: axiosError.message,
          status: axiosError.response?.status,
          data: axiosError.response?.data,
        });

        if (axiosError.response?.status === 404) {
          return res.status(404).json({
            success: false,
            message: "Transaction not found",
          });
        }

        return res.status(axiosError.response?.status || 500).json({
          success: false,
          message: "Payment verification failed",
          error: axiosError.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Internal server error during payment verification",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Enhanced webhook handler
export const handlePaypackNotification = asyncWrapper(
  async (req: Request, res: Response) => {
    try {
      console.log("PayPack webhook received:", req.body);

      const { external_reference, ref, status, kind } = req.body;
      const transactionRef = external_reference || ref;

      if (!transactionRef || !status) {
        console.error("Invalid webhook payload:", req.body);
        return res.status(400).json({
          success: false,
          message: "Invalid notification payload",
        });
      }

      const order = await Order.findOne({ transactionId: transactionRef });
      if (!order) {
        console.error("Order not found for transaction:", transactionRef);
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      // Update order based on webhook status
      const successStatuses = ["successful", "completed", "paid"];
      const failedStatuses = ["failed", "cancelled", "expired"];

      if (successStatuses.includes(status.toLowerCase())) {
        order.paymentStatus = "Paid";
        order.paymentVerified = true;
      } else if (failedStatuses.includes(status.toLowerCase())) {
        order.paymentStatus = "Failed";
        order.paymentVerified = true;
      } else {
        order.paymentStatus = "Pending";
      }

      order.paymentMetadata = req.body;
      await order.save();

      console.log("Webhook processed successfully for order:", order.orderId);

      return res.status(200).json({
        success: true,
        message: "Notification processed successfully",
      });
    } catch (error) {
      console.error("Webhook processing error:", error);
      return res.status(500).json({
        success: false,
        message: "Webhook processing failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Health check endpoint for PayPack service
export const checkPaypackHealth = asyncWrapper(
  async (req: Request, res: Response) => {
    try {
      const token = await getPaypackToken();
      return res.status(200).json({
        success: true,
        message: "PayPack service is healthy",
        hasToken: !!token,
      });
    } catch (error) {
      return res.status(503).json({
        success: false,
        message: "PayPack service unavailable",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);
