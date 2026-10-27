
import { Router } from "express";
import { getPublicBranchMenu } from "../controllers/public-menu.controllers";

const router = Router();

router.get("/branches/:publicSlug/menu",getPublicBranchMenu);

export default router;
