import { Router } from "express";

import { addProduct, filterProductByNameAndPriceAndCategory, getAllProducts, getBySellerId, getProductById,deleteProduct } from "../controller/Productontroller";

import upload from "../cloudinary/multerConfig";
import { authenticateToken } from "../middleware/authenticationToken";

const productRoute = Router();
productRoute.post("/add",upload.single('image'),authenticateToken,addProduct);
productRoute.get("/getAll", getAllProducts);
productRoute.get("/getById/:id", getProductById);
productRoute.get("/getBySellerId", authenticateToken,getBySellerId);
productRoute.get("/filterProduct", filterProductByNameAndPriceAndCategory);
productRoute.delete("/delete/:id",deleteProduct)
export default productRoute;