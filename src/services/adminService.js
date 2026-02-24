// services/adminService.js
import prisma from "../config/prisma.js";
import bcrypt from "bcryptjs";
import { generateAccessToken, generateRefreshToken } from "../config/jwt.js";

// ================== ADMIN LOGIN ==================
export const adminLoginService = async (email, password) => {
  const admin = await prisma.admin.findUnique({
    where: { email },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
    },
  });

  if (!admin || !admin.isActive) throw new Error("Admin not found or inactive");

  const valid = await bcrypt.compare(password, admin.password);
  if (!valid) throw new Error("Invalid credentials");

  const accessToken = generateAccessToken({
    id: admin.id,
    email: admin.email,
    role: admin.role.name,
  });

  const refreshToken = generateRefreshToken({ id: admin.id });

  return { accessToken, refreshToken, admin };
};

// ================== CREATE ROLE ==================
export const createRoleService = async (name, description, permissionIds = []) => {
  const role = await prisma.role.create({
    data: {
      name,
      description,
      permissions: {
        create: permissionIds.map((pid) => ({ permissionId: pid })),
      },
    },
  });

  return role;
};

// ================== CREATE ADMIN ==================
export const createAdminService = async ({ name, email, phoneNo, password, roleId }) => {
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

  return admin;
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

  return astrologer;
};
