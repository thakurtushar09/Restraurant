
import { Router } from "express";
import { isAuthenticated, requireAccount } from "../middleware/auth.middleware";
import { canAccessBranchOrders } from "../middleware/order.middleware";
import {getBranchOrders,updateOrderStatus,delayOrder,} from "../controllers/order-management.controllers";

const router = Router();

router.use("/:branchId", isAuthenticated, requireAccount("restaurant"), canAccessBranchOrders);

router.get("/:branchId", getBranchOrders);

router.patch("/:branchId/:orderId/status", updateOrderStatus);

router.patch("/:branchId/:orderId/delay", delayOrder);

export default router;
