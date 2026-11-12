import { Router } from "express";
import { createRestaurant } from "../controllers/restaurant.controllers";
import { createBranch, getBranch, updateBranch } from "../controllers/branch.controllers";
import {addMember,getMembers,updateMember,getMyMemberships,resendInvite,} from "../controllers/member.controllers";
import { isAuthenticated } from "../middleware/auth.middleware";
import { rateLimit, byUser } from "../middleware/rate-limit.middleware";

// Each add/resend sends an email, so cap them per person.
const inviteLimit = rateLimit({ name: "member-invite", windowSeconds: 60 * 60, max: 30, key: byUser, message: "You've sent a lot of invites. Try again in a while." });

const router = Router();

router.post("/", isAuthenticated, createRestaurant);

router.get("/my-memberships", isAuthenticated, getMyMemberships);

router.post("/:groupId/branches", isAuthenticated, createBranch);
router.get("/:groupId/branches/:branchId", isAuthenticated, getBranch);
router.patch("/:groupId/branches/:branchId", isAuthenticated, updateBranch);

// Members
router.post("/:groupId/members", isAuthenticated, inviteLimit, addMember);
router.get("/:groupId/members", isAuthenticated, getMembers);
router.patch("/:groupId/members/:memberId", isAuthenticated, updateMember);
router.post("/:groupId/members/:memberId/resend-invite", isAuthenticated, inviteLimit, resendInvite);

export default router;
