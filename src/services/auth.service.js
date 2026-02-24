// services/adminAuthService.js
import prisma from "../config/prisma.js";
import bcrypt from "bcryptjs";
import { generateAccessToken, generateRefreshToken } from "../config/jwt.js";

export const adminLoginService = async (email, password) => {
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

  if (!admin || !admin.isActive)
    throw new Error("Admin not found or inactive");

  const valid = await bcrypt.compare(password, admin.password);
  if (!valid) throw new Error("Invalid credentials");

  const accessToken = generateAccessToken({
    id: admin.id,
    email: admin.email,
    role: admin.role.name,
  });

  const refreshToken = generateRefreshToken({ id: admin.id });

  // ✅ Store refresh token
  await prisma.admin.update({
    where: { id: admin.id },
    data: { refreshToken },
  });

  return { accessToken, refreshToken, admin };
};