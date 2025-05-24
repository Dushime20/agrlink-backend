import { Router } from "express";

import { addProduct, filterProductByNameAndPriceAndCategory, getAllProducts, getBySellerId, getProductById } from "../controller/Productontroller";

import upload from "../cloudinary/multerConfig";

const productRoute = Router();
productRoute.post("/add",upload.single('image'),addProduct);
productRoute.get("/getAll", getAllProducts);
productRoute.get("/getById/:id", getProductById);
productRoute.get("/getBySellerId", getBySellerId);
productRoute.get("/filterProduct", filterProductByNameAndPriceAndCategory);
export default productRoute;