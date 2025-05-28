import axios, { AxiosError } from "axios";
import { Request, Response, NextFunction } from "express";
import asyncWrapper from "../middleware/async";
import Order from "../model/OrderSchema";
import crypto from "crypto";
import { BadRequestError } from "../error/BadREquestError";
import { NotFoundError } from "../error/NotFoundError";

const PAYPACK_CLIENT_ID = process.env.PAYPACK_CLIENT_ID!;
const PAYPACK_CLIENT_SECRET = process.env.PAYPACK_CLIENT_SECRET!;
const PAYPACK_BASE_URL = process.env.PAYPACK_BASE_URL || "https://api.paypack.rw";
const CALLBACK_URL = process.env.PAYPACK_CALLBACK_URL || "";

let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

interface PaypackTokenResponse {
  // Main token response
  access_token: string;
  token_type: string;
  expires_in: number;
  
  // Error response
  status?: number;
  message?: string;
  error?: string;
  error_description?: string;
}

interface PaypackPaymentResponse {
  status: string;
  ref?: string;
  reference?: string;
  message?: string;
  transaction_id?: string;
  amount?: number;
  phone?: string;
}

interface Buyer {
  phoneNumber: string;
  name: string;
}

/**
 * Retrieves a valid PayPack token, using caching to avoid repeated requests.
 */
const getPaypackToken = async (): Promise<string> => {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry)
    return cachedToken;

  try {
    console.log("Attempting PayPack authentication...");
    
    const response = await axios({
      method: 'post',
      url: `${PAYPACK_BASE_URL}/api/auth/agents/authorize`,
      data: {
        client_id: PAYPACK_CLIENT_ID,
        client_secret: PAYPACK_CLIENT_SECRET
      },
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    console.log("PayPack Auth Response:", {
      status: response.status,
      hasData: !!response.data,
      dataKeys: Object.keys(response.data || {})
    });

    const token = response.data?.access_token || response.data?.access || response.data?.token;

    if (!token) {
      console.error("Invalid response from PayPack:", response.data);
      throw new Error("No access token in response");
    }

    // Set expiry based on absolute timestamp if available
    const expires = response.data?.expires;
    const expiresIn = expires ? (expires * 1000 - Date.now()) / 1000 : 3600;

    cachedToken = token;
    tokenExpiry = Date.now() + (expiresIn - 300) * 1000;

    return token;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("PayPack Auth Error:", {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        url: error.config?.url
      });
    }
    throw error;
  }
};


/**
 * Test PayPack connectivity and authentication.
 */
export const testPaypackConnection = asyncWrapper(
  async (_req: Request, res: Response) => {
    try {
      const healthResponse = await axios.get(PAYPACK_BASE_URL, {
        timeout: 5000,
        validateStatus: () => true,
      });

      const token = await getPaypackToken();

      return res.status(200).json({
        success: true,
        message: "PayPack connection successful",
        details: {
          baseUrl: PAYPACK_BASE_URL,
          hasCredentials: Boolean(PAYPACK_CLIENT_ID && PAYPACK_CLIENT_SECRET),
          tokenObtained: Boolean(token),
          tokenLength: token.length,
          healthStatus: healthResponse.status,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "PayPack connection failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * Initiates a payment request via PayPack API.
 */
export const initiatePaypackPayment = asyncWrapper(
  async (req: Request, res: Response, next: NextFunction) => {
    const { orderId } = req.params;
    if (!orderId) return next(new BadRequestError("Missing orderId"));

    const order = await Order.findOne({ orderId }).populate(
      "buyer",
      "phoneNumber name"
    );
    if (!order) return next(new NotFoundError("Order not found"));

    const buyer = order.buyer as unknown as Buyer;
    if (!buyer?.phoneNumber)
      return next(new BadRequestError("Buyer phone number is missing"));

    // Normalize and validate Rwandan phone number
    const cleaned = buyer.phoneNumber.replace(/[\s\-\(\)]/g, "");
    const regex = /^(\+?25)?0(78|79)\d{7}$/;
    if (!regex.test(cleaned)) {
      return next(
        new BadRequestError(`Invalid phone number format: ${buyer.phoneNumber}`)
      );
    }

    const normalizedPhone = "25" + cleaned.replace(/^(\+?25|0)/, "");

    const token = await getPaypackToken();
    const transactionId = `TX-${orderId}-${Date.now()}`;

    order.transactionId = transactionId;
    order.paymentStatus = "Pending";
    await order.save();

    const payload = {
      amount: Math.round(order.totalAmount),
      number: normalizedPhone,
      reference: transactionId,
      callback_url: CALLBACK_URL,
      redirect_url: CALLBACK_URL // Optional, but helpful for frontend redirection
    };

    try {
      const response = await axios.post(
        `${PAYPACK_BASE_URL}/api/transactions/cashin`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 15000,
        }
      );

      return res.status(200).json({
        success: true,
        message: "Payment request sent to user phone",
        reference: transactionId,
        orderId: order.orderId,
        data: response.data,
      });
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message || error.message
        : "Unknown error";

      console.error("PayPack cashin error:", message);
      return next(new Error(`Payment request failed: ${message}`));
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

export const handlePaypackNotification = asyncWrapper(
  async (req: Request, res: Response) => {
    try {
      const requestHash = req.get("X-Paypack-Signature");
      const secret = process.env.WEBHOOCK_SCRETE_KEY;

      if (!secret || !requestHash) {
        console.warn("Missing signature or secret");
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized webhook" });
      }

      const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

      const computedHash = crypto
        .createHmac("sha256", secret)
        .update(rawBody ?? Buffer.from(""))
        .digest("base64");

      if (computedHash !== requestHash) {
        console.warn("Invalid Paypack signature");
        return res
          .status(401)
          .json({ success: false, message: "Invalid signature" });
      }

      console.log("✅ PayPack webhook verified and received:", req.body);

      const payment = req.body as PaypackPaymentResponse;
      const transactionRef = payment.reference || payment.ref || payment.transaction_id;

      if (!transactionRef || !payment.status) {
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

      const successStatuses = ["successful", "completed", "paid"];
      const failedStatuses = ["failed", "cancelled", "expired"];

      if (successStatuses.includes(payment.status.toLowerCase())) {
        order.paymentStatus = "Paid";
        order.paymentVerified = true;
      } else if (failedStatuses.includes(payment.status.toLowerCase())) {
        order.paymentStatus = "Failed";
        order.paymentVerified = true;
      } else {
        order.paymentStatus = "Pending";
      }

      order.paymentMetadata = payment;
      await order.save();

      console.log("✅ Webhook processed for order:", order.orderId);
      return res.status(200).json({
        success: true,
        message: "Notification processed successfully",
      });
    } catch (error) {
      console.error("❌ Webhook processing error:", error);
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
      // Check if credentials are configured
      if (!PAYPACK_CLIENT_ID || !PAYPACK_CLIENT_SECRET) {
        console.warn("PayPack credentials not configured");
        return res.status(503).json({
          success: false,
          message: "PayPack service not configured",
          details: {
            hasClientId: !!PAYPACK_CLIENT_ID,
            hasClientSecret: !!PAYPACK_CLIENT_SECRET
          }
        });
      }

      const token = await getPaypackToken();
      console.log("PayPack health check successful");
      return res.status(200).json({
        success: true,
        message: "PayPack service is healthy",
        details: {
          hasToken: !!token,
          tokenLength: token?.length || 0,
          baseUrl: PAYPACK_BASE_URL,
          hasCallback: !!CALLBACK_URL
        }
      });
    } catch (error) {
      console.error("PayPack health check failed:", error);
      return res.status(503).json({
        success: false,
        message: "PayPack service unavailable",
        error: error instanceof Error ? error.message : "Unknown error",
        details: {
          baseUrl: PAYPACK_BASE_URL,
          hasCredentials: !!PAYPACK_CLIENT_ID && !!PAYPACK_CLIENT_SECRET
        }
      });
    }
  }
);
