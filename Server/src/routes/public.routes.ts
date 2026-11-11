
import { Router } from "express";
import { getPublicBranchMenu, getPublicBranches } from "../controllers/public-menu.controllers";

const router = Router();

router.get("/branches", getPublicBranches);
router.get("/branches/:publicSlug/menu",getPublicBranchMenu);

export default router;
