import { Router } from "express";
import authRoute from "./authRoute";
import productRoute from "./ProductRoute";
import { authenticateToken } from "../middleware/authenticationToken";
import orderRoute from "./orderRoute";


const route = Router();
route.use("/user",authRoute);
route.use("/order",authenticateToken,orderRoute);
route.use("/product",authenticateToken,productRoute)
export default route;