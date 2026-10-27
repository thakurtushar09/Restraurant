
import { Router } from "express";
import { isAuthenticated } from "../middleware/auth.middleware";
import { canManageBranch } from "../middleware/menu.middleware";

import {createMenuCategory,getMenuCategories,updateMenuCategory,deactivateMenuCategory,} from "../controllers/menu-category.controllers";

import {createMenuItem,getBranchMenuItems,updateMenuItem,archiveMenuItem,} from "../controllers/menu-item.controllers";

import {createMenuItemVariant,getMenuItemVariants,} from "../controllers/menu-variant.controllers";

const router = Router();

// Every route requires login and branch-level menu permissions.
router.use("/:branchId", isAuthenticated, canManageBranch);

// Categories
router.post("/:branchId/categories", createMenuCategory);
router.get("/:branchId/categories", getMenuCategories);
router.patch("/:branchId/categories/:categoryId", updateMenuCategory);
router.delete("/:branchId/categories/:categoryId", deactivateMenuCategory);

// Menu items
router.post("/:branchId/menu-items", createMenuItem);
router.get("/:branchId/menu-items", getBranchMenuItems);
router.patch("/:branchId/menu-items/:itemId", updateMenuItem);
router.delete("/:branchId/menu-items/:itemId", archiveMenuItem);

// Variants
router.post("/:branchId/menu-items/:itemId/variants",createMenuItemVariant);
router.get("/:branchId/menu-items/:itemId/variants",getMenuItemVariants);

export default router;
