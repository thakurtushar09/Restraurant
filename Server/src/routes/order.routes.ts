import { Router } from "express";
import { isAuthenticated } from "../middleware/auth.middleware";
import { checkout } from "../controllers/order.controllers";

const router = Router();

router.post("/checkout", isAuthenticated, checkout);

export default router;