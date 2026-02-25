// services/adminService.js
import prisma from "../config/prisma.js";
import bcrypt from "bcryptjs";
import { generateAccessToken, generateRefreshToken } from "../config/jwt.js";
import { connectMongo, getDb } from "../config/mongo.js";

async function logEvent(type, identifier, details = {}) {
  try {
    const db = await connectMongo();
    const collection = db.collection("adminAuthLogs");

    await collection.insertOne({
      type,
      identifier, // email or adminId
      details,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Failed to log event:", error);
  }
}

// ================== ADMIN LOGIN ==================
export const adminLoginService = async (email, password) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { email },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });

    if (!admin || !admin.isActive) {
      await logEvent("LOGIN_FAILED", email, { reason: "Admin not found or inactive" });
      throw new Error("Admin not found or inactive");
    }

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      await logEvent("LOGIN_FAILED", email, { reason: "Invalid credentials" });
      throw new Error("Invalid credentials");
    }

    const accessToken = generateAccessToken({
      id: admin.id,
      email: admin.email,
      role: admin.role.name,
    });

    const refreshToken = generateRefreshToken({ id: admin.id });

    await logEvent("LOGIN_SUCCESS", email, {
      adminId: admin.id,
      role: admin.role.name,
    });

    return { accessToken, refreshToken, admin };
  } catch (error) {
    throw new Error(error.message || "Failed to login admin");
  }
};

// ================== CREATE ROLE ==================
export const createRoleService = async (name, description, permissionIds = []) => {
  try {
    const role = await prisma.role.create({
      data: {
        name,
        description,
        permissions: {
          create: permissionIds.map((pid) => ({ permissionId: pid })),
        },
      },
    });

    await logEvent("ROLE_CREATED", name, {
      roleId: role.id,
      permissionCount: permissionIds.length,
    });

    return role;
  } catch (error) {
    await logEvent("ROLE_CREATION_FAILED", name, { error: error.message });
    throw new Error("Failed to create role");
  }
};

// ================== CREATE ADMIN ==================
export const createAdminService = async ({
  name,
  email,
  phoneNo,
  password,
  roleId,
}) => {
  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await prisma.admin.create({
      data: {
        name,
        email,
        phoneNo,
        password: hashedPassword,
        roleId,
      },
      include: { role: true },
    });

    await logEvent("ADMIN_CREATED", email, {
      adminId: admin.id,
      roleId,
    });

    return admin;
  } catch (error) {
    if (error.code === "P2002") {
      await logEvent("ADMIN_CREATION_FAILED", email, { reason: "Email already exists" });
      throw new Error("Email already exists");
    }

    await logEvent("ADMIN_CREATION_FAILED", email, { error: error.message });
    throw new Error("Failed to create admin");
  }
};

// ================== ADD ASTROLOGER ==================
export const addAstrologerService = async ({
  name,
  email,
  contactNo,
  gender,
  dateOfBirth,
  languages,
  skills,
  experience,
  about,
}) => {
  try {
    const astrologer = await prisma.astrologer.create({
      data: {
        name,
        email,
        contactNo,
        gender,
        dateOfBirth: new Date(dateOfBirth),
        languages,
        skills,
        experience,
        about,
        profilePic: "https://default.com/profile.png",
      },
    });

    await logEvent("ASTROLOGER_ADDED", email, {
      astrologerId: astrologer.id,
      experience,
    });

    return astrologer;
  } catch (error) {
    if (error.code === "P2002") {
      await logEvent("ASTROLOGER_ADD_FAILED", email, {
        reason: "Email already exists",
      });
      throw new Error("Astrologer with this email already exists");
    }

    await logEvent("ASTROLOGER_ADD_FAILED", email, { error: error.message });
    throw new Error("Failed to add astrologer");
  }
};