import { Router } from "express";
import { isAuthenticated, requireAccount } from "../middleware/auth.middleware";
import { checkout } from "../controllers/order.controllers";

const router = Router();

router.post("/checkout", isAuthenticated, requireAccount("customer"), checkout);

export default router;