
import { Router } from "express";
import { isAuthenticated } from "../middleware/auth.middleware";
import {getMyOrders,getMyOrderDetails,} from "../controllers/customer-order.controllers";

const router = Router();

router.use(isAuthenticated);
router.get("/me", getMyOrders);
router.get("/:orderId", getMyOrderDetails);

export default router;
