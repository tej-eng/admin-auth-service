// services/adminAuthService.js
import prisma from "../config/prisma.js";
import bcrypt from "bcryptjs";
import { generateAccessToken, generateRefreshToken } from "../config/jwt.js";
import { connectMongo } from "../config/mongo.js";

async function logAdminAuthEvent(type, email, details = {}) {
  try {
    const db = await connectMongo();
    const collection = db.collection("adminAuthLogs");

    await collection.insertOne({
      type, // LOGIN_SUCCESS / LOGIN_FAILED
      email,
      details,
      timestamp: new Date(),
    });
  } catch (error) {
  }
}
export const adminLoginService = async (email, password, meta = {}) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { email },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    });

    if (!admin || !admin.isActive) {
      await logAdminAuthEvent("LOGIN_FAILED", email, {
        reason: "Admin not found or inactive",
        ...meta,
      });

      throw new Error("Admin not found or inactive");
    }

    const valid = await bcrypt.compare(password, admin.password);

    if (!valid) {
      await logAdminAuthEvent("LOGIN_FAILED", email, {
        reason: "Invalid credentials",
        adminId: admin.id,
        ...meta,
      });

      throw new Error("Invalid credentials");
    }

    const accessToken = generateAccessToken({
      id: admin.id,
      email: admin.email,
      role: admin.role.name,
    });

    const refreshToken = generateRefreshToken({ id: admin.id });

    await prisma.admin.update({
      where: { id: admin.id },
      data: { refreshToken },
    });

    await logAdminAuthEvent("LOGIN_SUCCESS", email, {
      adminId: admin.id,
      role: admin.role.name,
      ...meta,
    });

    return { accessToken, refreshToken, admin };
  } catch (error) {

    throw new Error(error.message || "Admin login failed");
  }
};