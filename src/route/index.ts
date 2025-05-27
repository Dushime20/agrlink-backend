import { Router } from "express";
import authRoute from "./authRoute";
import productRoute from "./ProductRoute";
import { authenticateToken } from "../middleware/authenticationToken";
import orderRoute from "./orderRoute";
import paymentRoute from "./paymentRoute";


const route = Router();
route.use("/user",authRoute);
route.use("/order",authenticateToken,orderRoute);
route.use("/product",productRoute)
route.use("/payment",authenticateToken,paymentRoute)
export default route;