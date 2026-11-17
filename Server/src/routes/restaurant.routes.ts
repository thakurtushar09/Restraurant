import { Router } from "express";
import { createRestaurant } from "../controllers/restaurant.controllers";
import { createBranch, getBranch, updateBranch } from "../controllers/branch.controllers";
import {addMember,getMembers,updateMember,getMyMemberships,resendInvite,} from "../controllers/member.controllers";
import { isAuthenticated, requireAccount } from "../middleware/auth.middleware";
import { rateLimit, byUser } from "../middleware/rate-limit.middleware";

// Each add/resend sends an email, so cap them per person.
const inviteLimit = rateLimit({ name: "member-invite", windowSeconds: 60 * 60, max: 30, key: byUser, message: "You've sent a lot of invites. Try again in a while." });

const router = Router();

// Only restaurant (owner/staff) accounts manage restaurants; customer accounts are turned away.
const staff = [isAuthenticated, requireAccount("restaurant")];

router.post("/", ...staff, createRestaurant);

router.get("/my-memberships", ...staff, getMyMemberships);

router.post("/:groupId/branches", ...staff, createBranch);
router.get("/:groupId/branches/:branchId", ...staff, getBranch);
router.patch("/:groupId/branches/:branchId", ...staff, updateBranch);

// Members
router.post("/:groupId/members", ...staff, inviteLimit, addMember);
router.get("/:groupId/members", ...staff, getMembers);
router.patch("/:groupId/members/:memberId", ...staff, updateMember);
router.post("/:groupId/members/:memberId/resend-invite", ...staff, inviteLimit, resendInvite);

export default router;
