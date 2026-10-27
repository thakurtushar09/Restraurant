
import { Router } from "express";
import { isAuthenticated } from "../middleware/auth.middleware";
import { canAccessBranchOrders } from "../middleware/order.middleware";
import {getBranchOrders,updateOrderStatus,} from "../controllers/order-management.controllers";

const router = Router();

router.use("/:branchId", isAuthenticated, canAccessBranchOrders);

router.get("/:branchId", getBranchOrders);

router.patch("/:branchId/:orderId/status", updateOrderStatus);

export default router;
