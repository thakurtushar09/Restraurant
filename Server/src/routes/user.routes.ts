
import { Router } from "express";
import {signup,login,logout,getCurrentUser,} from "../controllers/user.controllers";
import { isAuthenticated } from "../middleware/auth.middleware";

const router = Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", isAuthenticated, getCurrentUser);

export default router;
