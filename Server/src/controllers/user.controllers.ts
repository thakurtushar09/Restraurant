import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../config/prisma";
import type { SignupRequestBody, LoginRequestBody } from "../types/user.types";

const COOKIE_NAME = "token";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const cookieOptions ={
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

function getJwtSecret():string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return secret;
}

// SIGNUP
export async function signup(req: Request,res: Response,next: NextFunction,): Promise<void> {
  try {
    const { fullName, email, password } = req.body as SignupRequestBody;
    if (typeof fullName !== "string" ||!fullName.trim() || typeof email !== "string" ||!email.trim() ||typeof password !== "string" ||password.length < 8){
      res.status(400).json({
        success: false,
        message:
          "Full name and email are required; password must be at least 8 characters",
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: "Email is already registered",
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        fullName: fullName.trim(),
        email: normalizedEmail,
        passwordHash,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
      },
    });

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      user,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      res.status(409).json({
        success: false,
        message: "Email is already registered",
      });
      return;
    }

    next(error);
  }
}

// LOGIN
export async function login(req: Request,res: Response,next: NextFunction,): Promise<void> {
  try {
    const { email, password } = req.body as LoginRequestBody;

    if (typeof email !== "string" ||!email.trim() ||typeof password !== "string" ||!password) {
      res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: {
        email: email.trim().toLowerCase(),
      },
    });

    if (!user || user.status !== "ACTIVE" || user.deletedAt !== null) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    const token = jwt.sign({ sub: user.id }, getJwtSecret(), {
      expiresIn: "7d",
    });

    res.cookie(COOKIE_NAME, token, {
      ...cookieOptions,
      maxAge: COOKIE_MAX_AGE,
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
      },
    });
  } catch (error) {
    next(error);
  }
}

// LOGOUT
export async function logout(_req: Request,res: Response,next: NextFunction,): Promise<void> {
  try {
    res.clearCookie(COOKIE_NAME, cookieOptions);

    res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    next(error);
  }
}
