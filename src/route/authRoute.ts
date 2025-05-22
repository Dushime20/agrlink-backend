import { Router } from "express";
import { deleteUser, getAllUser, getUserById, signin, signUp, updateUserProfile } from "../controller/userController";

const authRoute = Router();
authRoute.post("/signup", signUp);
authRoute.post("/signin",signin);
authRoute.get("/getAll",getAllUser);
authRoute.get("/getById/:id",getUserById);
authRoute.put("/update/:id", updateUserProfile);
authRoute.delete("/delete/:id",deleteUser)


export default authRoute;