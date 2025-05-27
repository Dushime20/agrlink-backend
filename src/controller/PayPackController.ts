import axios from 'axios';
import { Request, Response, NextFunction } from 'express';
import asyncWrapper from '../middleware/async';
import Order from '../model/OrderSchema';
import { BadRequestError } from '../error/BadREquestError';
import { NotFoundError } from '../error/NotFoundError';

const PAYPACK_CLIENT_ID = process.env.PAYPACK_CLIENT_ID;
const PAYPACK_CLIENT_SECRET = process.env.PAYPACK_CLIENT_SECRET;
const PAYPACK_BASE_URL = 'https://paypack.rw/api';
const CALLBACK_URL = process.env.PAYPACK_CALLBACK_URL || '';

let cachedToken: string | null = null;

interface PaypackTokenResponse {
  token: string;
}

interface PaypackPaymentResponse {
  status: string;
  [key: string]: any;
}

// Get PayPack access token
const getPaypackToken = async (): Promise<string> => {
  if (cachedToken) return cachedToken;

  const response = await axios.post<PaypackTokenResponse>(`${PAYPACK_BASE_URL}/auth/token`, {
    client_id: PAYPACK_CLIENT_ID,
    client_secret: PAYPACK_CLIENT_SECRET,
  });

  const token = response.data?.token;
  if (!token) throw new Error('Failed to retrieve PayPack token');

  cachedToken = token;
  return token;
};

// Initiate PayPack payment
export const initiatePaypackPayment = asyncWrapper(
  async (req: Request, res: Response, next: NextFunction) => {
    const { orderId } = req.params;
    if (!orderId) return next(new BadRequestError('Missing orderId'));

    const order = await Order.findOne({ orderId }).populate('buyer', 'phoneNumber name');
    if (!order) return next(new NotFoundError('Order not found'));

    const buyer = order.buyer as unknown as {
      phoneNumber: string;
      name: string;
    };

    if (!buyer.phoneNumber) {
      return next(new BadRequestError('Buyer phone number is missing'));
    }

    const token = await getPaypackToken();
    const transactionId = `TX-${Date.now()}`;

    order.transactionId = transactionId;
    await order.save();

    await axios.post(
      `${PAYPACK_BASE_URL}/collection/request`,
      {
        amount: order.totalAmount,
        phone: buyer.phoneNumber,
        tx_ref: transactionId,
        callback_url: CALLBACK_URL,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    res.status(200).json({
      success: true,
      message: 'Payment request sent to user phone',
      reference: transactionId,
      orderId: order.orderId,
    });
  }
);

// Verify PayPack payment manually (if needed)
export const verifyPaypackPayment = asyncWrapper(
  async (req: Request, res: Response, next: NextFunction) => {
    const transactionId = req.query.transactionId as string;
    if (!transactionId) return next(new BadRequestError('Missing transactionId'));

    const order = await Order.findOne({ transactionId });
    if (!order) return next(new NotFoundError('Order not found'));

    const token = await getPaypackToken();

    const response = await axios.get<PaypackPaymentResponse>(
      `${PAYPACK_BASE_URL}/transactions/${transactionId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const payment = response.data;

    if (!payment || !payment.status) {
      return res.status(400).json({ success: false, message: 'Invalid payment data received' });
    }

    if (payment.status.toUpperCase() === 'SUCCESSFUL') {
      order.paymentStatus = 'Paid';
      order.paymentVerified = true;
      order.paymentMetadata = payment;
      await order.save();

      return res.status(200).json({ success: true, message: 'Payment verified', order });
    }

    return res.status(200).json({
      success: false,
      message: 'Payment not successful yet',
      status: payment.status,
    });
  }
);


//notification

export const handlePaypackNotification = asyncWrapper(async (req: Request, res: Response) => {
  const { tx_ref, transactionId, status } = req.body;

  const ref = tx_ref || transactionId;
  if (!ref || !status) {
    return res.status(400).json({ success: false, message: 'Invalid notification payload' });
  }

  const order = await Order.findOne({ transactionId: ref });
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  order.paymentStatus = status.toUpperCase() === 'SUCCESSFUL' ? 'Paid' : 'Failed';
  order.paymentVerified = true;
  order.paymentMetadata = req.body;

  await order.save();

  res.status(200).json({ success: true, message: 'Notification processed successfully' });
});

