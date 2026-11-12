
import { Router } from "express";
import { isAuthenticated } from "../middleware/auth.middleware";
import {getMyOrders,getMyOrderDetails,cancelMyOrder,} from "../controllers/customer-order.controllers";
import { rescheduleOrder } from "../controllers/reschedule-order.controllers";
const router = Router();

router.use(isAuthenticated);
router.get("/me", getMyOrders);
router.get("/:orderId", getMyOrderDetails);
router.patch("/:orderId/reschedule", rescheduleOrder);
router.patch("/:orderId/cancel", cancelMyOrder);
export default router;
