import { Router } from "express";
import { isAuthenticated } from "../middleware/auth.middleware";
import {createAddress,getMyAddresses,updateAddress,deleteAddress,} from "../controllers/address.controllers";

const router = Router();

router.use(isAuthenticated);
router.post("/", createAddress);
router.get("/", getMyAddresses);
router.patch("/:addressId", updateAddress);
router.delete("/:addressId", deleteAddress);

export default router;
