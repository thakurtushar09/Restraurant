import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import { prisma } from "../config/prisma";
import type {AddMemberRequestBody,UpdateMemberRequestBody,MemberRole,} from "../types/restaurant.types";
import { staffInviteEmail, staffAddedEmail } from "../emails";
import { sendEmail, appUrl } from "../utils/send-email";
import { verificationUrl } from "../utils/email-verification";

type GroupParams = { groupId: string };
type MemberParams = { groupId: string; memberId: string };

const GROUP_ROLES: MemberRole[] = ["GROUP_ADMIN"];
const BRANCH_ROLES: MemberRole[] = ["BRANCH_MANAGER", "KITCHEN_STAFF", "DELIVERY_STAFF"];
const ASSIGNABLE_ROLES: MemberRole[] = [...GROUP_ROLES, ...BRANCH_ROLES];
// Branch managers run their own floor: they may add and manage these roles in their branch only.
const MANAGER_ASSIGNABLE_ROLES: MemberRole[] = ["KITCHEN_STAFF", "DELIVERY_STAFF"];
const MEMBER_STATUSES = ["ACTIVE", "SUSPENDED", "REMOVED"];

const ROLE_LABELS: Record<string, string> = {
  GROUP_OWNER: "Owner",
  GROUP_ADMIN: "Admin",
  BRANCH_MANAGER: "Branch manager",
  KITCHEN_STAFF: "Kitchen staff",
  DELIVERY_STAFF: "Delivery staff",
};

const USER_TYPE_FOR_ROLE = {
  GROUP_ADMIN: "RESTAURANT_OWNER",
  BRANCH_MANAGER: "BRANCH_MANAGER",
  KITCHEN_STAFF: "KITCHEN_STAFF",
  DELIVERY_STAFF: "DELIVERY_STAFF",
} as const;

const memberSelect = {
  id: true,
  role: true,
  status: true,
  branchId: true,
  joinedAt: true,
  createdAt: true,
  user: { select: { id: true, fullName: true, email: true, isEmailVerified: true, mustChangePassword: true, lastLoginAt: true } },
  branch: { select: { id: true, branchName: true } },
} as const;

const branchSummarySelect = {
  id: true,
  branchName: true,
  publicSlug: true,
  city: true,
  status: true,
  acceptsDelivery: true,
  acceptsPickup: true,
  acceptsDineIn: true,
  averagePreparationTimeMinutes: true,
} as const;

type ManagerScope = { role: string; branchId: string | null };

// Owners and admins manage the whole group; branch managers only their branch's kitchen and delivery staff.
async function getManagerScope(userId: string, groupId: string): Promise<ManagerScope | null> {
  const memberships = await prisma.restaurantMember.findMany({
    where: {
      userId,
      restaurantGroupId: groupId,
      status: "ACTIVE",
      OR: [
        { role: { in: ["GROUP_OWNER", "GROUP_ADMIN"] }, branchId: null },
        { role: "BRANCH_MANAGER" },
      ],
    },
    select: { role: true, branchId: true },
  });

  return memberships.find((entry) => entry.branchId === null) ?? memberships[0] ?? null;
}

const isGroupManager = (scope: ManagerScope) => scope.branchId === null;

// Group roles have no branch; branch roles need a branch in this group.
async function validateRoleScope(groupId: string,role: MemberRole,branchId: string | null | undefined): Promise<string | null> {
  if (GROUP_ROLES.includes(role)) {
    return branchId ? "Group roles cannot be assigned to a branch" : null;
  }

  if (!branchId) {
    return "A branch is required for this role";
  }

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, restaurantGroupId: groupId, deletedAt: null },
    select: { id: true },
  });

  return branch ? null : "Branch not found in this restaurant";
}

// Readable but hard to guess, e.g. "k7Qm-p2Xw-9fRt".
function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  const chars = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8).join("")}`;
}

async function emailContext(groupId: string, branchId: string | null, inviterId: string) {
  const [group, branch, inviter] = await Promise.all([
    prisma.restaurantGroup.findUnique({ where: { id: groupId }, select: { groupName: true } }),
    branchId ? prisma.branch.findUnique({ where: { id: branchId }, select: { branchName: true } }) : null,
    prisma.user.findUnique({ where: { id: inviterId }, select: { fullName: true } }),
  ]);

  return {
    groupName: group?.groupName ?? "your restaurant",
    branchName: branch?.branchName ?? null,
    inviterName: inviter?.fullName ?? "Your manager",
  };
}

export const addMember = async (req: Request<GroupParams, {}, AddMemberRequestBody>,res: Response): Promise<void> => {
  try {
    const userId = res.locals.userId as string;
    const { groupId } = req.params;
    const { email, role, fullName, password } = req.body ?? {};
    let { branchId } = req.body ?? {};

    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      res.status(400).json({
        success: false,
        message: "A valid email is required",
      });
      return;
    }

    if (!ASSIGNABLE_ROLES.includes(role)) {
      res.status(400).json({
        success: false,
        message: `Role must be one of ${ASSIGNABLE_ROLES.join(", ")}`,
      });
      return;
    }

    const scope = await getManagerScope(userId, groupId);

    if (!scope) {
      res.status(403).json({
        success: false,
        message: "You don't have permission to manage members of this restaurant",
      });
      return;
    }

    if (!isGroupManager(scope)) {
      if (!MANAGER_ASSIGNABLE_ROLES.includes(role)) {
        res.status(403).json({
          success: false,
          message: "Branch managers can add kitchen and delivery staff only",
        });
        return;
      }
      // Always their own branch, whatever was sent.
      branchId = scope.branchId!;
    }

    if (role === "GROUP_ADMIN" && scope.role !== "GROUP_OWNER") {
      res.status(403).json({
        success: false,
        message: "Only the restaurant owner can add group admins",
      });
      return;
    }

    const scopeError = await validateRoleScope(groupId, role, branchId);

    if (scopeError) {
      res.status(400).json({
        success: false,
        message: scopeError,
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const targetUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, fullName: true, email: true, status: true, deletedAt: true },
    });

    if (targetUser && (targetUser.status !== "ACTIVE" || targetUser.deletedAt)) {
      res.status(409).json({
        success: false,
        message: "This account is suspended or deleted and can't be added",
      });
      return;
    }

    if (!targetUser) {
      if (typeof fullName !== "string" || !fullName.trim() || typeof password !== "string" || password.length < 8) {
        res.status(400).json({
          success: false,
          message: "There's no account with this email yet. Enter their name and a password of at least 8 characters.",
        });
        return;
      }
    } else {
      // One live membership per user per group keeps permission checks unambiguous.
      const existing = await prisma.restaurantMember.findFirst({
        where: {
          userId: targetUser.id,
          restaurantGroupId: groupId,
          status: { not: "REMOVED" },
        },
        select: { id: true },
      });

      if (existing) {
        res.status(409).json({
          success: false,
          message: "This person is already a member of this restaurant",
        });
        return;
      }
    }

    const memberBranchId = GROUP_ROLES.includes(role) ? null : branchId!;

    const member = await prisma.$transaction(async (tx) => {
      const memberUserId = targetUser
        ? targetUser.id
        : (await tx.user.create({
          data: {
            fullName: fullName!.trim(),
            email: normalizedEmail,
            passwordHash: await bcrypt.hash(password!, 12),
            userType: USER_TYPE_FOR_ROLE[role],
            // They got this password by email from someone else, so they pick their own on first sign-in.
            mustChangePassword: true,
          },
          select: { id: true },
        })).id;

      return tx.restaurantMember.create({
        data: {
          userId: memberUserId,
          restaurantGroupId: groupId,
          branchId: memberBranchId,
          role,
          status: "ACTIVE",
          invitedBy: userId,
          joinedAt: new Date(),
        },
        select: memberSelect,
      });
    });

    const context = await emailContext(groupId, memberBranchId, userId);
    const loginUrl = appUrl("dashboard", "/login");
    const content = targetUser
      ? staffAddedEmail({ name: targetUser.fullName, roleLabel: ROLE_LABELS[role], loginUrl, ...context })
      : staffInviteEmail({
        name: member.user.fullName,
        email: normalizedEmail,
        password: password!,
        roleLabel: ROLE_LABELS[role],
        loginUrl,
        verifyUrl: verificationUrl("dashboard", member.user.id, normalizedEmail),
        ...context,
      });
    const delivery = await sendEmail(normalizedEmail, content);

    res.status(201).json({
      success: true,
      message: delivery.sent
        ? `Member added and emailed at ${normalizedEmail}`
        : "Member added, but the email couldn't be sent. Share the sign-in details with them yourself.",
      data: member,
      accountCreated: !targetUser,
      emailSent: delivery.sent,
      ...(!delivery.sent && { emailError: delivery.error }),
    });
  } catch (error) {
    console.error("Add member error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to add member",
    });
  }
};

// New temporary password + email, for invites that never arrived or were lost.
// Only for accounts that haven't signed in and set their own password yet.
export const resendInvite = async (req: Request<MemberParams>,res: Response): Promise<void> => {
  try {
    const userId = res.locals.userId as string;
    const { groupId, memberId } = req.params;
    const scope = await getManagerScope(userId, groupId);

    if (!scope) {
      res.status(403).json({
        success: false,
        message: "You don't have permission to manage members of this restaurant",
      });
      return;
    }

    const member = await prisma.restaurantMember.findFirst({
      where: {
        id: memberId,
        restaurantGroupId: groupId,
        status: { not: "REMOVED" },
        ...(!isGroupManager(scope) && { branchId: scope.branchId, role: { in: MANAGER_ASSIGNABLE_ROLES } }),
      },
      select: { role: true, branchId: true, user: { select: { id: true, fullName: true, email: true, mustChangePassword: true } } },
    });

    if (!member) {
      res.status(404).json({
        success: false,
        message: "Member not found",
      });
      return;
    }

    if (!member.user.mustChangePassword) {
      res.status(409).json({
        success: false,
        message: "They've already set their own password. They can sign in as usual.",
      });
      return;
    }

    const password = generatePassword();
    await prisma.user.update({
      where: { id: member.user.id },
      data: { passwordHash: await bcrypt.hash(password, 12) },
    });

    const context = await emailContext(groupId, member.branchId, userId);
    const delivery = await sendEmail(member.user.email, staffInviteEmail({
      name: member.user.fullName,
      email: member.user.email,
      password,
      roleLabel: ROLE_LABELS[member.role],
      loginUrl: appUrl("dashboard", "/login"),
      verifyUrl: verificationUrl("dashboard", member.user.id, member.user.email),
      ...context,
    }));

    res.status(200).json({
      success: true,
      message: delivery.sent
        ? `New sign-in details sent to ${member.user.email}`
        : "Password reset, but the email couldn't be sent. Share it with them yourself.",
      emailSent: delivery.sent,
      // Shown once to the manager so the invite isn't lost if email fails.
      password,
      ...(!delivery.sent && { emailError: delivery.error }),
    });
  } catch (error) {
    console.error("Resend invite error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to resend the invite",
    });
  }
};

export const getMembers = async (req: Request<GroupParams>,res: Response): Promise<void> => {
  try {
    const userId = res.locals.userId as string;
    const { groupId } = req.params;
    const scope = await getManagerScope(userId, groupId);

    if (!scope) {
      res.status(403).json({
        success: false,
        message: "You don't have permission to view members of this restaurant",
      });
      return;
    }

    const members = await prisma.restaurantMember.findMany({
      where: {
        restaurantGroupId: groupId,
        status: { not: "REMOVED" },
        // Branch managers see their own branch's team.
        ...(!isGroupManager(scope) && { branchId: scope.branchId }),
      },
      select: memberSelect,
      orderBy: { createdAt: "asc" },
    });

    res.status(200).json({
      success: true,
      data: members,
    });
  } catch (error) {
    console.error("Get members error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch members",
    });
  }
};

export const updateMember = async (req: Request<MemberParams, {}, UpdateMemberRequestBody>,res: Response): Promise<void> => {
  try {
    const userId = res.locals.userId as string;
    const { groupId, memberId } = req.params;
    const { role, branchId, status } = req.body ?? {};

    if (role === undefined && branchId === undefined && status === undefined) {
      res.status(400).json({
        success: false,
        message: "Provide a role, branch, or status to update",
      });
      return;
    }

    if (role !== undefined && !ASSIGNABLE_ROLES.includes(role)) {
      res.status(400).json({
        success: false,
        message: `Role must be one of ${ASSIGNABLE_ROLES.join(", ")}`,
      });
      return;
    }

    if (status !== undefined && !MEMBER_STATUSES.includes(status)) {
      res.status(400).json({
        success: false,
        message: "Status must be ACTIVE, SUSPENDED, or REMOVED",
      });
      return;
    }

    const scope = await getManagerScope(userId, groupId);

    if (!scope) {
      res.status(403).json({
        success: false,
        message: "You don't have permission to manage members of this restaurant",
      });
      return;
    }

    const member = await prisma.restaurantMember.findFirst({
      where: {
        id: memberId,
        restaurantGroupId: groupId,
        status: { not: "REMOVED" },
      },
      select: { id: true, userId: true, role: true, branchId: true },
    });

    if (!member) {
      res.status(404).json({
        success: false,
        message: "Member not found",
      });
      return;
    }

    if (member.role === "GROUP_OWNER" || member.userId === userId) {
      res.status(403).json({
        success: false,
        message: "You cannot change the owner's or your own membership",
      });
      return;
    }

    const nextRole = (role ?? member.role) as MemberRole;

    if (!isGroupManager(scope)) {
      const ownBranchStaff = member.branchId === scope.branchId && MANAGER_ASSIGNABLE_ROLES.includes(member.role as MemberRole);
      const staysInScope = MANAGER_ASSIGNABLE_ROLES.includes(nextRole) && (branchId === undefined || branchId === scope.branchId);

      if (!ownBranchStaff || !staysInScope) {
        res.status(403).json({
          success: false,
          message: "Branch managers can manage kitchen and delivery staff in their own branch only",
        });
        return;
      }
    }

    if (scope.role !== "GROUP_OWNER" &&(member.role === "GROUP_ADMIN" || nextRole === "GROUP_ADMIN")) {
      res.status(403).json({
        success: false,
        message: "Only the restaurant owner can manage group admins",
      });
      return;
    }

    // Moving to a group role clears the branch; otherwise keep the current one unless given.
    const nextBranchId = GROUP_ROLES.includes(nextRole)
      ? null
      : branchId !== undefined ? branchId : member.branchId;

    const scopeError = await validateRoleScope(groupId, nextRole, nextBranchId);

    if (scopeError) {
      res.status(400).json({
        success: false,
        message: scopeError,
      });
      return;
    }

    const updated = await prisma.restaurantMember.update({
      where: { id: member.id },
      data: {
        role: nextRole,
        branchId: nextBranchId,
        ...(status !== undefined && { status }),
      },
      select: memberSelect,
    });

    res.status(200).json({
      success: true,
      message: "Member updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("Update member error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update member",
    });
  }
};

// Lets a logged-in user find which restaurants and branches they work at.
export const getMyMemberships = async (_req: Request,res: Response): Promise<void> => {
  try {
    const userId = res.locals.userId as string;

    const memberships = await prisma.restaurantMember.findMany({
      where: {
        userId,
        status: "ACTIVE",
        restaurantGroup: { deletedAt: null },
      },
      select: {
        id: true,
        role: true,
        branchId: true,
        restaurantGroup: {
          select: {
            id: true,
            groupName: true,
            logoUrl: true,
            branches: {
              where: { deletedAt: null },
              select: branchSummarySelect,
              orderBy: { createdAt: "asc" },
            },
          },
        },
        branch: { select: branchSummarySelect },
      },
      orderBy: { createdAt: "asc" },
    });

    // Only group-level roles may see every branch in the group.
    const data = memberships.map(({ restaurantGroup, ...membership }) => {
      const { branches, ...group } = restaurantGroup;

      return {
        ...membership,
        restaurantGroup: membership.branchId === null ? { ...group, branches } : group,
      };
    });

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get my memberships error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch memberships",
    });
  }
};
