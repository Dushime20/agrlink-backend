import axios, { AxiosError } from 'axios';
import { Request, Response, NextFunction } from 'express';
import asyncWrapper from '../middleware/async';
import Order from '../model/OrderSchema';
import { BadRequestError } from '../error/BadREquestError';
import { NotFoundError } from '../error/NotFoundError';

const PAYPACK_CLIENT_ID = process.env.PAYPACK_CLIENT_ID;
const PAYPACK_CLIENT_SECRET = process.env.PAYPACK_CLIENT_SECRET;
// Updated PayPack base URL - check PayPack documentation for correct sandbox URL
const PAYPACK_BASE_URL = process.env.PAYPACK_BASE_URL || 'https://payments.paypack.rw';
const CALLBACK_URL = process.env.PAYPACK_CALLBACK_URL || '';

let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

interface PaypackTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface PaypackPaymentResponse {
  status: string;
  ref: string;
  kind: string;
  [key: string]: any;
}

// Enhanced token management with expiry
const getPaypackToken = async (): Promise<string> => {
  // Check if token exists and hasn't expired
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  try {
    console.log('Requesting new PayPack token...');
    const response = await axios.post<PaypackTokenResponse>(
      `${PAYPACK_BASE_URL}/api/auth/agents/authorize`,
      {
        client_id: PAYPACK_CLIENT_ID,
        client_secret: PAYPACK_CLIENT_SECRET,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 10000, // 10 second timeout
      }
    );

    const { access_token, expires_in } = response.data;
    if (!access_token) {
      throw new Error('No access token received from PayPack');
    }

    cachedToken = access_token;
    // Set expiry time (subtract 5 minutes for safety)
    tokenExpiry = Date.now() + (expires_in - 300) * 1000;
    
    console.log('PayPack token obtained successfully');
    return access_token;
  } catch (error) {
    console.error('PayPack token request failed:', error);
    cachedToken = null;
    tokenExpiry = null;
    throw error;
  }
};

// Enhanced payment initiation with better error handling
export const initiatePaypackPayment = asyncWrapper(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId } = req.params;
      if (!orderId) {
        return next(new BadRequestError('Missing orderId'));
      }

      // Validate environment variables
      if (!PAYPACK_CLIENT_ID || !PAYPACK_CLIENT_SECRET) {
        console.error('PayPack credentials not configured');
        return res.status(500).json({
          success: false,
          message: 'Payment service not configured',
        });
      }

      const order = await Order.findOne({ orderId }).populate('buyer', 'phoneNumber name');
      if (!order) {
        return next(new NotFoundError('Order not found'));
      }

      const buyer = order.buyer as unknown as {
        phoneNumber: string;
        name: string;
      };

      if (!buyer?.phoneNumber) {
        return next(new BadRequestError('Buyer phone number is missing'));
      }

      // Validate phone number format (Rwanda format)
      const phoneRegex = /^(\+?25)?[078]\d{8}$/;
      if (!phoneRegex.test(buyer.phoneNumber.replace(/\s/g, ''))) {
        return next(new BadRequestError('Invalid phone number format'));
      }

      const token = await getPaypackToken();
      const transactionId = `TX-${orderId}-${Date.now()}`;

      // Update order before making payment request
      order.transactionId = transactionId;
      order.paymentStatus = 'Pending';
      await order.save();

      const paymentPayload = {
        amount: Math.round(order.totalAmount), // Ensure integer amount
        phone: buyer.phoneNumber.replace(/\s/g, ''), // Remove spaces
        external_reference: transactionId,
        callback_url: CALLBACK_URL,
      };

      console.log('Initiating PayPack payment:', {
        ...paymentPayload,
        phone: '***masked***',
      });

      const response = await axios.post(
        `${PAYPACK_BASE_URL}/api/transactions/cashin`,
        paymentPayload,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          timeout: 15000, // 15 second timeout
        }
      );

      console.log('PayPack payment initiated successfully');

      return res.status(200).json({
        success: true,
        message: 'Payment request sent to user phone',
        reference: transactionId,
        orderId: order.orderId,
        data: response.data,
      });

    } catch (error) {
      console.error('Payment initiation error:', error);

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        console.error('PayPack API Error:', {
          message: axiosError.message,
          status: axiosError.response?.status,
          data: axiosError.response?.data,
          url: axiosError.config?.url,
        });

        // Handle specific error cases
        if (axiosError.code === 'ENOTFOUND' || axiosError.code === 'ECONNREFUSED') {
          return res.status(503).json({
            success: false,
            message: 'Payment service temporarily unavailable',
            error: 'Service connection failed',
          });
        }

        if (axiosError.response?.status === 401) {
          // Clear cached token on auth failure
          cachedToken = null;
          tokenExpiry = null;
          return res.status(500).json({
            success: false,
            message: 'Payment service authentication failed',
          });
        }

        return res.status(axiosError.response?.status || 500).json({
          success: false,
          message: 'Payment initiation failed',
          error: axiosError.message,
          details: axiosError.response?.data,
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Internal server error during payment initiation',
        error: error instanceof Error ? error.message : 'Unknown error',
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
        return next(new BadRequestError('Missing transactionId'));
      }

      const order = await Order.findOne({ transactionId });
      if (!order) {
        return next(new NotFoundError('Order not found'));
      }

      const token = await getPaypackToken();

      console.log('Verifying PayPack payment:', transactionId);

      const response = await axios.get<PaypackPaymentResponse>(
        `${PAYPACK_BASE_URL}/api/transactions/find/${transactionId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
          timeout: 10000,
        }
      );

      const payment = response.data;

      if (!payment || !payment.status) {
        return res.status(400).json({
          success: false,
          message: 'Invalid payment data received',
        });
      }

      console.log('Payment verification response:', {
        status: payment.status,
        ref: payment.ref,
      });

      // Check for successful payment statuses
      const successStatuses = ['successful', 'completed', 'paid'];
      if (successStatuses.includes(payment.status.toLowerCase())) {
        order.paymentStatus = 'Paid';
        order.paymentVerified = true;
        order.paymentMetadata = payment;
        await order.save();

        return res.status(200).json({
          success: true,
          message: 'Payment verified successfully',
          order,
        });
      }

      // Handle failed payments
      const failedStatuses = ['failed', 'cancelled', 'expired'];
      if (failedStatuses.includes(payment.status.toLowerCase())) {
        order.paymentStatus = 'Failed';
        order.paymentVerified = true;
        order.paymentMetadata = payment;
        await order.save();

        return res.status(200).json({
          success: false,
          message: 'Payment failed',
          status: payment.status,
        });
      }

      // Payment still pending
      return res.status(200).json({
        success: false,
        message: 'Payment still pending',
        status: payment.status,
      });

    } catch (error) {
      console.error('Payment verification error:', error);

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        console.error('PayPack verification error:', {
          message: axiosError.message,
          status: axiosError.response?.status,
          data: axiosError.response?.data,
        });

        if (axiosError.response?.status === 404) {
          return res.status(404).json({
            success: false,
            message: 'Transaction not found',
          });
        }

        return res.status(axiosError.response?.status || 500).json({
          success: false,
          message: 'Payment verification failed',
          error: axiosError.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Internal server error during payment verification',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// Enhanced webhook handler
export const handlePaypackNotification = asyncWrapper(
  async (req: Request, res: Response) => {
    try {
      console.log('PayPack webhook received:', req.body);

      const { external_reference, ref, status, kind } = req.body;
      const transactionRef = external_reference || ref;

      if (!transactionRef || !status) {
        console.error('Invalid webhook payload:', req.body);
        return res.status(400).json({
          success: false,
          message: 'Invalid notification payload',
        });
      }

      const order = await Order.findOne({ transactionId: transactionRef });
      if (!order) {
        console.error('Order not found for transaction:', transactionRef);
        return res.status(404).json({
          success: false,
          message: 'Order not found',
        });
      }

      // Update order based on webhook status
      const successStatuses = ['successful', 'completed', 'paid'];
      const failedStatuses = ['failed', 'cancelled', 'expired'];

      if (successStatuses.includes(status.toLowerCase())) {
        order.paymentStatus = 'Paid';
        order.paymentVerified = true;
      } else if (failedStatuses.includes(status.toLowerCase())) {
        order.paymentStatus = 'Failed';
        order.paymentVerified = true;
      } else {
        order.paymentStatus = 'Pending';
      }

      order.paymentMetadata = req.body;
      await order.save();

      console.log('Webhook processed successfully for order:', order.orderId);

      return res.status(200).json({
        success: true,
        message: 'Notification processed successfully',
      });

    } catch (error) {
      console.error('Webhook processing error:', error);
      return res.status(500).json({
        success: false,
        message: 'Webhook processing failed',
        error: error instanceof Error ? error.message : 'Unknown error',
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
        message: 'PayPack service is healthy',
        hasToken: !!token,
      });
    } catch (error) {
      return res.status(503).json({
        success: false,
        message: 'PayPack service unavailable',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);