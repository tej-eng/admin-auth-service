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
  console.log("🔐 [LOGIN_ATTEMPT] Email:", email);

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

    console.log("👤 [DB_CHECK] Admin Found:", !!admin);

    if (!admin) {
      console.log("❌ [LOGIN_FAILED] Admin not found");
      await logAdminAuthEvent("LOGIN_FAILED", email, {
        reason: "Admin not found",
        ...meta,
      });

      throw new Error("Admin not found");
    }

    console.log("🟢 [STATUS_CHECK] isActive:", admin.isActive);

    if (!admin.isActive) {
      console.log("❌ [LOGIN_FAILED] Admin inactive");
      await logAdminAuthEvent("LOGIN_FAILED", email, {
        reason: "Admin inactive",
        adminId: admin.id,
        ...meta,
      });

      throw new Error("Admin not active");
    }

    console.log("🔎 [PASSWORD_CHECK] Comparing passwords...");

    const valid = await bcrypt.compare(password, admin.password);

    console.log("🔑 [PASSWORD_RESULT] Match:", valid);

    if (!valid) {
      console.log("❌ [LOGIN_FAILED] Invalid credentials");
      await logAdminAuthEvent("LOGIN_FAILED", email, {
        reason: "Invalid credentials",
        adminId: admin.id,
        ...meta,
      });

      throw new Error("Invalid credentials");
    }

    console.log("🎟️ [TOKEN_GENERATION] Creating tokens...");

    const accessToken = generateAccessToken({
      id: admin.id,
      email: admin.email,
      role: admin.role.name,
    });

    const refreshToken = generateRefreshToken({ id: admin.id });

    console.log("💾 [DB_UPDATE] Saving refresh token...");

    await prisma.admin.update({
      where: { id: admin.id },
      data: { refreshToken },
    });

    console.log("✅ [LOGIN_SUCCESS] Admin:", admin.email);

    await logAdminAuthEvent("LOGIN_SUCCESS", email, {
      adminId: admin.id,
      role: admin.role.name,
      ...meta,
    });

    return { accessToken, refreshToken, admin };

  } catch (error) {
    console.error("🔥 [LOGIN_ERROR]", error.message);
    throw new Error(error.message || "Admin login failed");
  }
};