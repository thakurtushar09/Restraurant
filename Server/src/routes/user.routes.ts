
import { Router } from "express";
import {signup,login,logout,} from "../controllers/user.controllers";

const router = Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);

export default router;
