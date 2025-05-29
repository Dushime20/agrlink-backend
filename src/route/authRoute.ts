import { Router } from "express";
import { deleteUser, getAllUser, getUserById, signin, signUp, updateUserProfile,getUserProfile } from "../controller/userController";
import { authenticateToken } from "../middleware/authenticationToken";
const authRoute = Router();
authRoute.post("/signup", signUp);
authRoute.post("/signin",signin);
authRoute.get("/getAll",getAllUser);
authRoute.get("/getById/:id",getUserById);
authRoute.get("/getUserProfile",authenticateToken,getUserProfile);
authRoute.put("/update/:id", updateUserProfile);
authRoute.delete("/delete/:id",deleteUser)


export default authRoute;