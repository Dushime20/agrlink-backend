import { Router } from "express";
import { createOrder, getAllOrders, getOrdersByBuyerId, getOrdersBySellerId } from "../controller/OrderController";


const orderRoute=Router()
orderRoute.post('/add/:productId', createOrder);
orderRoute.get('/getAll', getAllOrders);
orderRoute.get('/getByBuyerId', getOrdersByBuyerId);
orderRoute.get('/getBySellerId', getOrdersBySellerId);

export default orderRoute;

