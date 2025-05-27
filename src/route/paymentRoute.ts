import { Router } from 'express';
import { handlePaypackNotification,initiatePaypackPayment, verifyPaypackPayment } from '../controller/PayPackController';


const paymentRoute = Router();

// Updated PayPack routes
paymentRoute.post('/paypack/initiate/:orderId', initiatePaypackPayment);
paymentRoute.get('/paypack/verify', verifyPaypackPayment);
// PayPack sends payment result here (instead of waiting for frontend to confirm)
paymentRoute.post('/paypack/nitify', handlePaypackNotification);


export default paymentRoute;
