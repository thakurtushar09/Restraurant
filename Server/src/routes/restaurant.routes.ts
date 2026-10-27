
import { Router } from "express";
import { createRestaurant } from "../controllers/restaurant.controllers";
import { createBranch } from "../controllers/branch.controllers";
import { isAuthenticated } from "../middleware/auth.middleware";

const router = Router();

router.post("/", isAuthenticated, createRestaurant);

router.post("/:groupId/branches", isAuthenticated, createBranch);

export default router;
