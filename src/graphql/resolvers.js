// src/graphql/resolvers.js
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
// import { adminLoginService } from "../services/auth.service.js";
import {
  createAdminService,
  addAstrologerService,
  adminLoginService,
} from "../services/adminService.js";
import { DateTimeResolver } from "graphql-scalars";
import { connectMongo } from "../config/mongo.js";

import GraphQLUpload from "graphql-upload/GraphQLUpload.mjs";
import { generateSlug } from "../utils/slugify.js";
import { generateAccessToken, generateRefreshToken } from "../config/jwt.js";

const prisma = new PrismaClient();

async function logGraphQLEvent(type, operation, userId = null, details = {}) {
  try {
    const db = await connectMongo();
    const collection = db.collection("adminGraphQLLogs");

    await collection.insertOne({
      type, // SUCCESS / ERROR
      operation, // getUsersDetails / createRole etc
      userId,
      details,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Mongo log failed:", error.message);
  }
}

async function checkPermission(staff, requiredPermission) {
  if (!staff) throw new Error("Unauthorized");

  // 🔥 SUPER ADMIN BYPASS
  const fullStaff = await prisma.staff.findUnique({
    where: { id: staff.id },
    include: { role: true },
  });

  if (fullStaff.role?.slug === "super-admin") {
    return true;
  }

  // 🔥 Normal RBAC flow
  const rolePerms = await prisma.rolePermission.findMany({
    where: { roleId: staff.roleId },
    include: { permission: true },
  });

  const staffPerms = await prisma.staffPermission.findMany({
    where: { staffId: staff.id },
    include: { permission: true },
  });

  const allPermissions = [
    ...rolePerms.map((r) => r.permission.name),
    ...staffPerms.map((s) => s.permission.name),
  ];

  console.log("staff:", staff);
  console.log("requiredPermission:", requiredPermission);
  console.log("rolePerms:", rolePerms.map(r => r.permission.name));
  console.log("staffPerms:", staffPerms.map(s => s.permission.name));

  if (!allPermissions.includes(requiredPermission)) {
    throw new Error("Unauthorized: Missing permission");
  }
}


// generate auto permission 
const generateCRUDPermissions = async (module) => {
  const actions = ["create", "read", "update", "delete"];

  for (const action of actions) {
    const name = `${module.slug}.${action}`;

    await prisma.permission.upsert({
      where: { name },
      update: {},
      create: {
        name,
        type: "SYSTEM",
        modules: {
          create: {
            module: { connect: { id: module.id } },
          },
        },
      },
    });
  }
};

export const resolvers = {
  Upload: GraphQLUpload,
  Query: {
    // ================= GET USERS (ADMIN ONLY) =================
    getUsersDetails: async (_, { page = 1, limit = 10 }, context) => {
      try {
        if (!context.user || context.user.role.name !== "ADMIN") {
          throw new Error("Admin only");
        }

        const skip = (page - 1) * limit;

        const [users, totalCount] = await Promise.all([
          prisma.user.findMany({
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
          }),
          prisma.user.count(),
        ]);

        return {
          data: users,
          totalCount,
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
        };
      } catch (error) {
        throw error;
      }
    },

    getUsersListBySearch: async (_, { searchInput }, context) => {
      try {
        if (!context.user || context.user.role !== "ADMIN") {
          throw new Error("Admin only");
        }

        const { query, page = 1, limit = 10 } = searchInput;

        const safePage = Math.max(page, 1);
        const safeLimit = Math.min(limit, 50);

        const skip = (safePage - 1) * safeLimit;

        const where = query
          ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { mobile: { contains: query } },
            ],
          }
          : {};

        const [users, totalCount] = await Promise.all([
          prisma.user.findMany({
            where,
            skip,
            take: safeLimit,
            orderBy: { createdAt: "desc" },
          }),
          prisma.user.count({ where }),
        ]);

        return {
          data: users,
          totalCount,
          currentPage: safePage,
          totalPages: Math.ceil(totalCount / safeLimit),
        };
      } catch (error) {
        throw error;
      }
    },

    getAstrologerListBySearch: async (_, { searchInput }, context) => {
      try {
        if (!context.user) throw new Error("Not authorized");

        const {
          query,
          sortField,
          sortOrder,
          limit = 10,
          page = 1,
        } = searchInput;

        const safeLimit = Math.min(limit, 50);
        const safePage = Math.max(page, 1);
        const skip = (safePage - 1) * safeLimit;

        let orderBy = {};

        if (sortField) {
          switch (sortField) {
            case "EXPERIENCE":
              orderBy.experience = sortOrder === "ASC" ? "asc" : "desc";
              break;
            case "PRICE":
              orderBy.price = sortOrder === "ASC" ? "asc" : "desc";
              break;
            case "RATING":
              orderBy.rating = sortOrder === "ASC" ? "asc" : "desc";
              break;
          }
        } else {
          orderBy.createdAt = "desc";
        }

        const where = query
          ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { skills: { has: query } },
              { languages: { has: query } },
            ],
          }
          : {};

        const [astrologers, totalCount] = await Promise.all([
          prisma.astrologer.findMany({
            where,
            orderBy,
            skip,
            take: safeLimit,
          }),
          prisma.astrologer.count({ where }),
        ]);

        const response = {
          data: astrologers,
          totalCount,
          currentPage: safePage,
          totalPages: Math.ceil(totalCount / safeLimit),
        };

        return response;
      } catch (error) {
        throw error;
      }
    },

    // ================= GET PENDING ASTROLOGERS =================
    getPendingAstrologers: async (_, { page = 1, limit = 10 }, context) => {
      try {
        if (!context.user || context.user.role !== "ADMIN") {
          throw new Error("Admin only");
        }

        const safePage = Math.max(page, 1);
        const safeLimit = Math.min(limit, 50);
        const skip = (safePage - 1) * safeLimit;

        const whereCondition = {
          approvalStatus: {
            in: ["PENDING", "INTERVIEW", "DOCUMENT_VERIFICATION"],
          },
        };

        const [astrologers, totalCount] = await Promise.all([
          prisma.astrologer.findMany({
            where: whereCondition,
            skip,
            take: safeLimit,
            include: {
              addresses: true,
              experiences: true,
              interviews: true,
              documents: true,
              rejectionHistory: true,
            },
            orderBy: { createdAt: "desc" },
          }),
          prisma.astrologer.count({ where: whereCondition }),
        ]);

        const response = {
          data: astrologers,
          totalCount,
          currentPage: safePage,
          totalPages: Math.ceil(totalCount / safeLimit),
        };

        return response;
      } catch (error) {
        throw error;
      }
    },

    getAstrologerInterviews: async (
      _,
      { astrologerId, page = 1, limit = 10 },
      context,
    ) => {
      try {
        if (!context.user || context.user.role !== "ADMIN") {
          throw new Error("Admin only");
        }

        const safePage = Math.max(page, 1);
        const safeLimit = Math.min(limit, 50);
        const skip = (safePage - 1) * safeLimit;

        const whereCondition = { astrologerId };

        const [interviews, totalCount] = await Promise.all([
          prisma.interview.findMany({
            where: whereCondition,
            skip,
            take: safeLimit,
            orderBy: { roundNumber: "asc" },
          }),
          prisma.interview.count({ where: whereCondition }),
        ]);

        const response = {
          data: interviews,
          totalCount,
          currentPage: safePage,
          totalPages: Math.ceil(totalCount / safeLimit),
        };

        return response;
      } catch (error) {
        throw error;
      }
    },

    getAstrologerDocuments: async (
      _,
      { astrologerId, page = 1, limit = 10 },
      context,
    ) => {
      try {
        if (!context.user || context.user.role !== "ADMIN") {
          throw new Error("Admin only");
        }

        const safePage = Math.max(page, 1);
        const safeLimit = Math.min(limit, 50);
        const skip = (safePage - 1) * safeLimit;

        const whereCondition = { astrologerId };

        const [documents, totalCount] = await Promise.all([
          prisma.astrologerDocument.findMany({
            where: whereCondition,
            skip,
            take: safeLimit,
            orderBy: { createdAt: "desc" },
          }),
          prisma.astrologerDocument.count({ where: whereCondition }),
        ]);

        const response = {
          data: documents,
          totalCount,
          currentPage: safePage,
          totalPages: Math.ceil(totalCount / safeLimit),
        };

        return response;
      } catch (error) {
        throw error;
      }
    },

    getRegisteredAstrologers: async (_, { page = 1, limit = 10 }, context) => {
      try {
        if (!context.user || context.user.role !== "ADMIN") {
          throw new Error("Admin only");
        }

        const safePage = Math.max(page, 1);
        const safeLimit = Math.min(limit, 50);
        const skip = (safePage - 1) * safeLimit;

        const astrologers = await prisma.astrologer.findMany({
          skip,
          take: safeLimit,
          include: {
            addresses: true,
            experiences: true,
          },
          orderBy: { createdAt: "desc" },
        });

        return astrologers;
      } catch (error) {
        throw error;
      }
    },

    getApprovedAstrologers: async (_, { page = 1, limit = 10 }, context) => {
      try {
        if (!context.user || context.user.role !== "ADMIN") {
          throw new Error("Admin only");
        }

        const safePage = Math.max(page, 1);
        const safeLimit = Math.min(limit, 50);
        const skip = (safePage - 1) * safeLimit;

        const whereCondition = { approvalStatus: "APPROVED" };

        const [astrologers, totalCount] = await Promise.all([
          prisma.astrologer.findMany({
            where: whereCondition,
            skip,
            take: safeLimit,
            include: {
              addresses: true,
              experiences: true,
              interviews: true,
              documents: true,
              rejectionHistory: true,
            },
            orderBy: { createdAt: "desc" },
          }),
          prisma.astrologer.count({ where: whereCondition }),
        ]);

        const response = {
          data: astrologers,
          totalCount,
          currentPage: safePage,
          totalPages: Math.ceil(totalCount / safeLimit),
        };

        return response;
      } catch (error) {
        throw error;
      }
    },

    getAdmins: async (_, { page = 1, limit = 10 }, context) => {
      try {
        console.log("getAdmins called", {
          requestedBy: context?.user?.id,
          role: context?.user?.role,
          page,
          limit,
          timestamp: new Date().toISOString(),
        });

        if (!context.user || context.user.role !== "SUPER_ADMIN") {
          console.warn("Unauthorized access attempt to getAdmins", {
            userId: context?.user?.id,
            role: context?.user?.role,
          });
          throw new Error("Only SUPER_ADMIN can view admins");
        }

        const skip = (page - 1) * limit;

        const whereCondition = {
          role: {
            name: "ADMIN",
          },
        };

        const [admins, totalCount] = await Promise.all([
          prisma.admin.findMany({
            where: whereCondition,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
              role: true,
            },
          }),
          prisma.admin.count({
            where: whereCondition,
          }),
        ]);

        console.log("getAdmins success", {
          totalCount,
          returnedRecords: admins.length,
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
        });

        return {
          data: admins,
          totalCount,
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
        };
      } catch (error) {
        console.error("getAdmins error", {
          message: error.message,
          stack: error.stack,
          requestedBy: context?.user?.id,
          timestamp: new Date().toISOString(),
        });

        throw new Error("Failed to fetch admins");
      }
    },

getRechargePacks: async (_, __, context) => {
  await checkPermission(context.user, "walletpackages.read");

  return prisma.rechargePack.findMany({
    orderBy: { createdAt: "desc" },
  });
},

    getWallets: async () => {
      try {
        const wallets = await prisma.wallet.findMany({
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
        });
        return wallets;
      } catch (error) {
        console.error("getWallets error:", error);
        throw new Error("Failed to fetch wallets");
      }
    },

    getUserWallet: async (_, { userId }) => {
      try {
        const userWallet = await prisma.userWallet.findUnique({
          where: { userId },
        });

        if (!userWallet) {
          throw new Error("User wallet not found");
        }

        return userWallet;
      } catch (error) {
        console.error("getUserWallet error:", error);
        throw new Error("Failed to fetch user wallet");
      }
    },

    // Modules Query
    getModulesPaginated: async (_, { page = 1, limit = 10 }) => {
      const skip = (page - 1) * limit;

      const [modules, totalCount] = await Promise.all([
        prisma.module.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.module.count(),
      ]);

      return {
        data: modules,
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
      };
    },

    // ROLES QUERY
    getRoles: async (_, { page = 1, limit = 10 }, context) => {
      try {
        const skip = (page - 1) * limit;

        const [roles, totalCount] = await Promise.all([
          prisma.role.findMany({
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
          }),
          prisma.role.count(),
        ]);

        return {
          data: roles,
          totalCount,
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
        };
      } catch (error) {
        console.error("getRoles error:", error);

        throw new Error(error.message);
      }
    },

    // Permission Query
    getPermissions: async (_, { page = 1, limit = 100, type }, context) => {
      await checkPermission(context.user, "permissions.read");

      const skip = (page - 1) * limit;

      const where = {
        isDeleted: false,
        ...(type && { type }), // 🔥 key line
      };

      const [permissions, totalCount] = await Promise.all([
        prisma.permission.findMany({
          where,
          skip,
          take: limit,
          include: {
            modules: {
              include: {
                module: true,
              },
            },
          },
        }),
        prisma.permission.count({ where }),
      ]);

      const formatted = permissions.map((p) => ({
        ...p,
        modules: p.modules.map((m) => m.module),
      }));

      return {
        data: formatted,
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
      };
    },

    // Department Query
    getDepartments: async (_, { page = 1, limit = 10 }) => {
      const skip = (page - 1) * limit;

      const [departments, totalCount] = await Promise.all([
        prisma.department.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.department.count(),
      ]);

      return {
        data: departments,
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
      };
    },

    // Staff query
    getStaff: async (_, { page = 1, limit = 10 }) => {
      const skip = (page - 1) * limit;

      const [staff, totalCount] = await Promise.all([
        prisma.staff.findMany({
          skip,
          take: limit,

          include: {
            department: true,
            role: true,
            permissions: {
              include: { permission: true },
            },
          },
        }),

        prisma.staff.count(),
      ]);

      const formatted = staff.map((s) => ({
        ...s,
        permissions: s.permissions.map((p) => p.permission),
      }));

      return {
        data: formatted,
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
      };
    },

    // Get my access
    getMyAccess: async (_, __, context) => {
      const user = context.user;
      if (!user) throw new Error("Unauthorized");

      const fullUser = await prisma.staff.findUnique({
        where: { id: user.id },
        include: { role: true },
      });

      // 🔥 SUPER ADMIN BYPASS (CRITICAL FIX)
      if (fullUser.role?.slug === "super-admin") {
        const modules = await prisma.module.findMany({
          where: { isDeleted: false, isActive: true },
        });
        if (!fullUser) throw new Error("User not found in DB");
        return modules.map((mod) => ({
          id: mod.id,
          name: mod.name,
          slug: mod.slug,
          permissions: [
            `${mod.slug}.create`,
            `${mod.slug}.read`,
            `${mod.slug}.update`,
            `${mod.slug}.delete`,
          ],
        }));
      }

      // ================= NORMAL FLOW =================

      const rolePermissions = await prisma.rolePermission.findMany({
        where: {
          roleId: user.roleId,
          permission: { isDeleted: false },
        },
        include: {
          permission: {
            include: {
              modules: {
                where: {
                  module: { isDeleted: false, isActive: true },
                },
                include: { module: true },
              },
            },
          },
        },
      });

      const staffPermissions = await prisma.staffPermission.findMany({
        where: {
          staffId: user.id,
          permission: { isDeleted: false },
        },
        include: {
          permission: {
            include: {
              modules: {
                where: {
                  module: { isDeleted: false, isActive: true },
                },
                include: { module: true },
              },
            },
          },
        },
      });

      const allPermissions = [
        ...rolePermissions.map((r) => r.permission),
        ...staffPermissions.map((s) => s.permission),
      ];

      const moduleMap = {};

      allPermissions.forEach((perm) => {
        perm.modules.forEach((mp) => {
          const mod = mp.module;

          if (!moduleMap[mod.id]) {
            moduleMap[mod.id] = {
              id: mod.id,
              name: mod.name,
              slug: mod.slug,
              permissions: new Set(),
            };
          }

          moduleMap[mod.id].permissions.add(perm.name);
        });
      });

      return Object.values(moduleMap).map((mod) => ({
        ...mod,
        permissions: Array.from(mod.permissions),
      }));
    },

    getModulesBySection: async (_, { section }) => {
      return prisma.module.findMany({
        where: {
          section: section.trim().toLowerCase(),
          isActive: true,
        },
        orderBy: { createdAt: "asc" },
      });
    },

    getSections: async () => {
      const sections = await prisma.module.findMany({
        select: { section: true },
        distinct: ["section"],
      });

      return sections.map((s) => s.section);
    },

    // get coupons 
    getCoupons: async (_, __, context) => {
      await checkPermission(context.user, "coupons.read");

      try {
        return await prisma.coupon.findMany({
          orderBy: { createdAt: "desc" },
        });
      } catch (error) {
        throw error;
      }
    },
  },

  // *******************************************************************************************************************************

  Mutation: {
    // ================= ADMIN LOGIN =================
    loginStaff: async (_, { email, password }, { res }) => {
      const staff = await prisma.staff.findUnique({
        where: { email },
        include: { role: true },
      });

      if (!staff) throw new Error("Invalid credentials");
      // console.log("hhhhhhhhhhhhhhhhhhhhhhhhhhh", permissions);
      const isMatch = await bcrypt.compare(password, staff.password);

      if (!isMatch) throw new Error("Invalid credentials");

      const accessToken = generateAccessToken(staff);
      const refreshToken = generateRefreshToken(staff);
      console.log("INPUT:", password);
      console.log("DB:", staff.password);
      // res.cookie("token", accessToken, {
      //   httpOnly: true,
      //   sameSite: "lax",
      //   secure: false,
      // });

      return {
        accessToken,
        refreshToken,
        user: staff,
      };
    },

    logoutAdmin: async (_, __, context) => {
      try {
        if (!context.user?.id) {
          throw new Error("Unauthorized");
        }

        return "Admin logged out successfully";
      } catch (error) {
        throw new Error(error.message || "Logout failed");
      }
    },

    assignPermissionsToRole: async (_, { roleId, permissionIds }, context) => {
      try {
        if (!context.user || context.user.role !== "SUPER_ADMIN") {
          throw new Error("Only SUPER_ADMIN can assign permissions");
        }

        const role = await prisma.role.findUnique({ where: { id: roleId } });
        if (!role) throw new Error("Role not found");

        const permissions = await prisma.permission.findMany({
          where: { id: { in: permissionIds } },
        });

        if (permissions.length !== permissionIds.length) {
          throw new Error("One or more permission IDs are invalid");
        }

        await prisma.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId,
            permissionId,
          })),
          skipDuplicates: true,
        });

        const updatedRole = await prisma.role.findUnique({
          where: { id: roleId },
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        });

        return {
          id: updatedRole.id,
          name: updatedRole.name,
          description: updatedRole.description,
          permissions: updatedRole.permissions.map((rp) => rp.permission),
        };
      } catch (error) {
        throw new Error(
          error.message || "Failed to assign permissions to role",
        );
      }
    },

    // ================= CREATE ADMIN =================
    createAdmin: async (_, args, context) => {
      try {
        if (!context.user || context.user.role !== "SUPER_ADMIN")
          throw new Error("Only SUPER_ADMIN can create admins");

        return await createAdminService(args);
      } catch (error) {
        throw new Error(error.message || "Failed to create admin");
      }
    },

    // ================= UPDATE ADMIN =================
    updateAdmin: async (_, { adminId, name, email, roleId }, context) => {
      try {
        if (!context.user || context.user.role !== "SUPER_ADMIN") {
          throw new Error("Only SUPER_ADMIN can update admins");
        }

        const existingAdmin = await prisma.admin.findUnique({
          where: { id: adminId },
          include: { role: true },
        });

        if (!existingAdmin) {
          throw new Error("Admin not found");
        }

        if (existingAdmin.role.name === "SUPER_ADMIN") {
          throw new Error("Cannot update SUPER_ADMIN");
        }

        if (email) {
          const duplicate = await prisma.admin.findUnique({
            where: { email },
          });

          if (duplicate && duplicate.id !== adminId) {
            throw new Error("Email already in use");
          }
        }

        if (roleId) {
          const role = await prisma.role.findUnique({
            where: { id: roleId },
          });

          if (!role) {
            throw new Error("Invalid role");
          }
        }

        const updatedAdmin = await prisma.admin.update({
          where: { id: adminId },
          data: {
            ...(name && { name }),
            ...(email && { email }),
            ...(roleId && { roleId }),
          },
          include: { role: true },
        });

        return updatedAdmin;
      } catch (error) {
        throw new Error(error.message || "Failed to update admin");
      }
    },

    // ================= DELETE ADMIN =================
    deleteAdmin: async (_, { adminId }, context) => {
      try {
        if (!context.user || context.user.role !== "SUPER_ADMIN") {
          throw new Error("Only SUPER_ADMIN can delete admins");
        }

        const existingAdmin = await prisma.admin.findUnique({
          where: { id: adminId },
          include: { role: true },
        });

        if (!existingAdmin) {
          throw new Error("Admin not found");
        }

        if (existingAdmin.role.name === "SUPER_ADMIN") {
          throw new Error("Cannot delete SUPER_ADMIN");
        }

        await prisma.admin.delete({
          where: { id: adminId },
        });

        return "Admin deleted successfully";
      } catch (error) {
        throw new Error(error.message || "Failed to delete admin");
      }
    },

    // ================= ADD ASTROLOGER =================
    addAstrologer: async (_, { data }, context) => {
      // if (
      //   !context.user ||
      //   !["SUPER_ADMIN", "MANAGER"].includes(context.user.role)
      // ) {
      //   throw new Error("Not authorized");
      // }

      console.log("documents received:", data.documents);
      console.log("aadhaar:", data.documents?.aadhaar);
      console.log("pan:", data.documents?.panCard);
      console.log("passbook:", data.documents?.passbook);
      console.log("profile:", data.documents?.profilePic);

      const astrologer = await prisma.astrologer.create({
        data: {
          name: data.astroname,
          displayName: data.displayName,

          gender: data.gender,

          email: data.email,

          contactNo: String(data.phoneNumber),

          password: data.password,

          experience: Number(data.experience),

          aboutEnglish: data.aboutEnglish,

          languages: data.languages,

          skills: data.expertise,

          problems: data.problems,

          tags: data.tags,

          vtags: data.vtags,

          callChatCharges: Number(data.charges.callChatCharges),
          callChatOfferCharges: Number(data.charges.callChatOfferCharges),
          callChatCommission: Number(data.charges.callChatCommission),
          videocall_charges: Number(data.charges.videocall_charges),
          audiocall_charges: Number(data.charges.audiocall_charges),
          audiovideocall_offer_charges: Number(
            data.charges.audiovideocall_offer_charges,
          ),

          addresses: {
            create: {
              street: data.address.street,
              city: data.address.city,
              state: data.address.state,
              country: data.address.country,
              pincode: data.address.pincode,
            },
          },

          documents: {
            create: [
              ...(data.documents?.aadhaar
                ? [{ type: "AADHAAR", fileUrl: data.documents?.aadhaar }]
                : []),

              ...(data.documents?.panCard
                ? [{ type: "PAN", fileUrl: data.documents?.panCard }]
                : []),

              ...(data.documents?.passbook
                ? [{ type: "PASSBOOK", fileUrl: data.documents?.passbook }]
                : []),

              ...(data.documents?.profilePic
                ? [{ type: "PROFILE", fileUrl: data.documents?.profilePic }]
                : []),
            ],
          },

          bankDetails: {
            create: {
              accountHolderName: data.bankDetails.accountHolderName,
              accountNumber: data.bankDetails.accountNumber,
              bankName: data.bankDetails.bankName,
              ifscCode: data.bankDetails.ifscCode,
              panCardNumber: data.bankDetails.panCardNumber,
              branchName: data.bankDetails.branchName,
            },
          },

          /* -----------------------------
         Admin relation
      --------------------------------*/

          // adminId: context.user.id,
        },
      });
      console.log("ertyuio", data.documents);
      return astrologer;
    },

    // ================= UPDATE ASTROLOGER =================
    updateAstrologer: async (_, { astrologerId, data }, context) => {
      try {
        if (
          !context.user ||
          !["SUPER_ADMIN", "MANAGER"].includes(context.user.role)
        )
          throw new Error("Not authorized");

        const existing = await prisma.astrologer.findUnique({
          where: { id: astrologerId },
        });

        if (!existing) throw new Error("Astrologer not found");

        return await prisma.astrologer.update({
          where: { id: astrologerId },
          data,
        });
      } catch (error) {
        throw new Error(error.message || "Failed to update astrologer");
      }
    },

    // ================= DELETE ASTROLOGER =================
    deleteAstrologer: async (_, { astrologerId }, context) => {
      try {
        if (
          !context.user ||
          !["SUPER_ADMIN", "MANAGER"].includes(context.user.role)
        )
          throw new Error("Not authorized");

        const existing = await prisma.astrologer.findUnique({
          where: { id: astrologerId },
        });

        if (!existing) throw new Error("Astrologer not found");

        await prisma.astrologer.delete({
          where: { id: astrologerId },
        });

        return true;
      } catch (error) {
        throw new Error(error.message || "Failed to delete astrologer");
      }
    },

    // ================= UPDATE USER =================
    updateUser: async (_, { userId, data }, context) => {
      try {
        if (!context.user || context.user.role !== "ADMIN") {
          throw new Error("Admin only");
        }

        const existingUser = await prisma.user.findUnique({
          where: { id: userId },
        });

        if (!existingUser || existingUser.isDeleted) {
          throw new Error("User not found");
        }

        if (data.mobile) {
          const mobileExists = await prisma.user.findFirst({
            where: {
              mobile: data.mobile,
              NOT: { id: userId },
            },
          });

          if (mobileExists) {
            throw new Error("Mobile already in use");
          }
        }

        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data,
        });

        return updatedUser;
      } catch (error) {
        throw new Error(error.message || "Failed to update user");
      }
    },

    updateUser: async (_, { userId, data }, context) => {
      try {
        if (!context.user || context.user.role !== "ADMIN") {
          throw new Error("Admin only");
        }

        const user = await prisma.user.findUnique({
          where: { id: userId },
        });

        if (!user || user.isDeleted) {
          throw new Error("User not found");
        }

        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: {
            ...data,
          },
        });

        return updatedUser;
      } catch (error) {
        throw new Error(error.message || "Failed to update user");
      }
    },

    deleteUser: async (_, { userId }, context) => {
      try {
        if (!context.user || context.user.role !== "ADMIN") {
          throw new Error("Admin only");
        }

        const user = await prisma.user.findUnique({
          where: { id: userId },
        });

        if (!user || user.isDeleted) {
          throw new Error("User not found");
        }

        await prisma.user.update({
          where: { id: userId },
          data: {
            isDeleted: true,
            isActive: false,
          },
        });

        return "User deleted successfully";
      } catch (error) {
        throw new Error(error.message || "Failed to delete user");
      }
    },

    // ================= VERIFY DOCUMENT =================
    verifyDocument: async (_, { documentId, status, remarks }, context) => {
      try {
        if (!context.user || context.user.role !== "ADMIN")
          throw new Error("Admin only");

        return await prisma.astrologerDocument.update({
          where: { id: Number(documentId) },
          data: {
            status,
            remarks,
            verifiedBy: context.user.id,
            verifiedAt: new Date(),
          },
        });
      } catch (error) {
        throw new Error(error.message || "Failed to verify document");
      }
    },

    // ================= SCHEDULE INTERVIEW =================
    scheduleInterview: async (_, args, context) => {
      try {
        if (!context.user || context.user.role !== "ADMIN")
          throw new Error("Admin only");

        await prisma.astrologer.update({
          where: { id: args.astrologerId },
          data: { approvalStatus: "INTERVIEW" },
        });

        return await prisma.interview.create({
          data: {
            astrologerId: args.astrologerId,
            roundNumber: args.roundNumber,
            interviewerName: args.interviewerName,
            scheduledAt: new Date(args.scheduledAt),
          },
        });
      } catch (error) {
        throw new Error(error.message || "Failed to schedule interview");
      }
    },

    // ================= REJECT ASTROLOGER =================
    rejectAstrologer: async (_, { astrologerId, stage, reason }, context) => {
      try {
        if (!context.user || context.user.role !== "ADMIN")
          throw new Error("Admin only");

        await prisma.astrologerRejectionHistory.create({
          data: {
            astrologerId,
            stage,
            reason,
            rejectedBy: context.user.id,
          },
        });

        await prisma.astrologer.update({
          where: { id: astrologerId },
          data: { approvalStatus: "REJECTED" },
        });

        return true;
      } catch (error) {
        throw new Error(error.message || "Failed to reject astrologer");
      }
    },

    // ================= APPROVE ASTROLOGER =================
    approveAstrologer: async (_, { astrologerId }, context) => {
      try {
        if (!context.user || context.user.role !== "ADMIN")
          throw new Error("Admin only");

        await prisma.astrologer.update({
          where: { id: astrologerId },
          data: { approvalStatus: "APPROVED" },
        });

        return true;
      } catch (error) {
        throw new Error(error.message || "Failed to approve astrologer");
      }
    },

    // Recharge packages ===============================

createRechargePack: async (_, { input }, context) => {
  await checkPermission(context.user, "walletpackages.create");

  try {
    const pack = await prisma.rechargePack.create({
      data: {
        name: input.name,
        description: input.description,
        price: input.price,
        talktime: input.talktime,
        isActive: input.isActive ?? true,
      },
    });

    return pack;
  } catch (error) {
    throw error;
  }
},

 deleteRechargePack: async (_, { id }, context) => {
  await checkPermission(context.user, "walletpackages.delete");

  try {
    await prisma.rechargePack.delete({
      where: { id },
    });

    return true;
  } catch (error) {
    throw error;
  }
},

 updateRechargePack: async (_, { id, input }, context) => {
  await checkPermission(context.user, "walletpackages.update");

  try {
    const pack = await prisma.rechargePack.update({
      where: { id },
      data: input,
    });

    return pack;
  } catch (error) {
    throw error;
  }
},

    // ===============Coupons ++++++++++++++++++++++

    createCoupon: async (_, { input }, context) => {
      await checkPermission(context.user, "coupons.create");

      try {
        const coupon = await prisma.coupon.create({
          data: {
            code: input.code,
            description: input.description,
            applicable: input.applicable,
            type: input.type,
            status: input.status === "active",
            visibility: input.visibility,
            percentage: input.percentage,
            max_discount: input.max_discount,
            redeem_limit: input.redeem_limit,
            start_date: new Date(input.start_date),
            end_date: new Date(input.end_date),
          },
        });

        return coupon;
      } catch (error) {
        throw error;
      }
    },

    deleteCoupon: async (_, { id }, context) => {
      await checkPermission(context.user, "coupons.delete");

      try {
        await prisma.coupon.delete({
          where: { id },
        });

        return true;
      } catch (error) {
        throw error;
      }
    },

    updateCouponStatus: async (_, { id, status }, context) => {
      await checkPermission(context.user, "coupons.update");

      try {
        const updated = await prisma.coupon.update({
          where: { id },
          data: {
            status: status === "active",
          },
        });

        return updated;
      } catch (error) {
        throw error;
      }
    },

    // ****************************** Modules ********************

    createModule: async (_, { name, slug, description, section }, context) => {
      try {
        const normalizedName = name.trim();
        const normalizedSlug = slug.trim().toLowerCase();
        const normalizedSection = section.trim().toLowerCase();

        // 🔥 slug must be unique
        const existingModule = await prisma.module.findUnique({
          where: { slug: normalizedSlug },
        });

        if (existingModule) {
          throw new Error("Module with same slug already exists");
        }

        const module = await prisma.module.create({
          data: {
            name: normalizedName,
            slug: normalizedSlug,
            description,
            section: normalizedSection,
          },
        });


        await generateCRUDPermissions(module);

        return module;
      } catch (error) {
        throw new Error(error.message || "Failed to create module");
      }
    },

    updateModule: async (
      _,
      { id, name, slug, description, section, isActive },
      context
    ) => {
      try {
        await checkPermission(context.user, "modules.edit");

        const moduleExists = await prisma.module.findUnique({
          where: { id },
        });

        if (!moduleExists) {
          throw new Error("Module not found");
        }

        // 🔥 normalize values if provided
        const normalizedSlug = slug?.trim().toLowerCase();
        const normalizedSection = section?.trim().toLowerCase();

        // 🔥 check slug uniqueness (if changed)
        if (normalizedSlug && normalizedSlug !== moduleExists.slug) {
          const existingSlug = await prisma.module.findUnique({
            where: { slug: normalizedSlug },
          });

          if (existingSlug) {
            throw new Error("Slug already exists");
          }
        }

        const updatedModule = await prisma.module.update({
          where: { id },
          data: {
            ...(name && { name: name.trim() }),
            ...(normalizedSlug && { slug: normalizedSlug }),
            ...(description !== undefined && { description }),
            ...(normalizedSection && { section: normalizedSection }), // 🔥 ADD THIS
            ...(isActive !== undefined && { isActive }),
          },
        });

        return updatedModule;
      } catch (error) {
        throw new Error(error.message || "Failed to update module");
      }
    },

    deleteModule: async (_, { id }, context) => {
      await checkPermission(context.user, "modules.delete");

      await prisma.modulePermission.deleteMany({
        where: { moduleId: id },
      });

      await prisma.module.delete({
        where: { id },
      });

      return true;
    },

    // Roles +++++++++++++++++++++++++++++++

    createRole: async (_, { name, slug, description }, context) => {
      try {
        await checkPermission(context.user, "roles.create");
        const normalizedName = name.trim();
        const normalizedSlug = slug.trim().toLowerCase();

        const existingRole = await prisma.role.findFirst({
          where: {
            OR: [{ name: normalizedName }, { slug: normalizedSlug }],
          },
        });

        if (existingRole) {
          throw new Error("Role with same name or slug already exists");
        }

        const role = await prisma.role.create({
          data: {
            name: normalizedName,
            slug: normalizedSlug,
            description,
          },
        });

        return role;
      } catch (error) {
        throw new Error(error.message || "Failed to create role");
      }
    },

    updateRole: async (_, { roleId, name, slug, description, isActive }, context) => {
      await checkPermission(context.user, "roles.edit");

      return prisma.role.update({
        where: { id: roleId },
        data: {
          ...(name && { name }),
          ...(slug && { slug: slug.trim().toLowerCase() }),
          ...(description !== undefined && { description }),
          ...(isActive !== undefined && { isActive }), // 👈 ADD THIS
        },
      });
    },

    deleteRole: async (_, { roleId }, context) => {
      try {
        await checkPermission(context.user, "roles.delete");
        const role = await prisma.role.findUnique({
          where: { id: roleId },
        });

        if (!role) {
          throw new Error("Role not found");
        }

        await prisma.role.delete({
          where: { id: roleId },
        });

        return {
          success: true,
          message: "Role deleted successfully",
          error: ""
        };
      } catch (error) {
        return {
          success: false,
          message: "Failed to delete role",
          error: "This role is assigned to staff. Delete or reassign first.",
        };
      }
    },

    // Permission
    createPermission: async (_, { name, moduleIds }, context) => {
      await checkPermission(context.user, "permissions.create");


      if (name.includes(".")) {
        throw new Error("System permissions cannot be created manually");
      }

      const permission = await prisma.permission.create({
        data: {
          name,
          type,
          modules: {
            create: moduleIds.map((id) => ({
              module: { connect: { id } },
            })),
          },
        },
        include: {
          modules: { include: { module: true } },
        },
      });

      return {
        ...permission,
        modules: permission.modules.map((m) => m.module),
      };
    },

    updatePermission: async (_, { permissionId, name, moduleIds }, context) => {
      await checkPermission(context.user, "permissions.update");

      const existing = await prisma.permission.findUnique({
        where: { id: permissionId },
      });

      // ❌ SYSTEM ko edit nahi karne dena
      if (existing.type === "SYSTEM") {
        throw new Error("System permissions cannot be updated");
      }

      if (moduleIds) {
        await prisma.modulePermission.deleteMany({
          where: { permissionId },
        });
      }

      const permission = await prisma.permission.update({
        where: { id: permissionId },
        data: {
          ...(name && { name }),
          ...(moduleIds && {
            modules: {
              create: moduleIds.map((id) => ({
                module: { connect: { id } },
              })),
            },
          }),
        },
        include: {
          modules: { include: { module: true } },
        },
      });

      return {
        ...permission,
        modules: permission.modules.map((m) => m.module),
      };
    },

    deletePermission: async (_, { permissionId }, context) => {
      await checkPermission(context.user, "permissions.delete");

      const existing = await prisma.permission.findUnique({
        where: { id: permissionId },
      });

      // ❌ SYSTEM delete block
      if (existing.type === "SYSTEM") {
        throw new Error("System permissions cannot be deleted");
      }

      await prisma.modulePermission.deleteMany({
        where: { permissionId },
      });

      await prisma.permission.delete({
        where: { id: permissionId },
      });

      return true;
    },

    // Department
    createDepartment: async (_, { name, description }, context) => {
      await checkPermission(context.user, "departments.create");
      const slug = generateSlug(name);

      const department = await prisma.department.create({
        data: {
          name,
          slug,
          description,
        },
      });

      return department;
    },
    updateDepartment: async (
      _,
      { departmentId, name, description, isActive },
      context,
    ) => {
      await checkPermission(context.user, "departments.edit");
      let slug;

      if (name) {
        slug = generateSlug(name);
      }

      const department = await prisma.department.update({
        where: { id: departmentId },
        data: {
          ...(name && { name }),
          ...(slug && { slug }),
          ...(description !== undefined && { description }),
          ...(isActive !== undefined && { isActive }),
        },
      });

      return department;
    },

    deleteDepartment: async (_, { departmentId }, context) => {
      await checkPermission(context.user, "departments.delete");
      const staffCount = await prisma.staff.count({
        where: { departmentId },
      });

      if (staffCount > 0) {
        throw new Error("Cannot delete department. Staff are assigned to it.");
      }

      await prisma.department.delete({
        where: { id: departmentId },
      });

      return true;
    },

    // Stafff
    createStaff: async (
      _,
      { name, email, password, departmentId, roleId, permissionIds },
      context,
    ) => {
      try {
        await checkPermission(context.user, "staff.create");

        const normalizedEmail = email.toLowerCase().trim();

        const existingStaff = await prisma.staff.findUnique({
          where: { email: normalizedEmail },
        });

        if (existingStaff) {
          throw new Error("Staff with this email already exists");
        }

        const hashedPassword = await bcrypt.hash(password.trim(), 10);

        const staff = await prisma.staff.create({
          data: {
            name,
            email: normalizedEmail,
            password: hashedPassword,

            department: { connect: { id: departmentId } },
            role: { connect: { id: roleId } },

            permissions: {
              create:
                permissionIds?.map((id) => ({
                  permission: { connect: { id } },
                })) || [],
            },
          },

          include: {
            department: true,
            role: true,
            permissions: { include: { permission: true } },
          },
        });

        return {
          ...staff,
          permissions: staff.permissions.map((p) => p.permission),
        };
      } catch (error) {
        throw new Error(error.message || "Failed to create staff");
      }
    },

    updateStaff: async (
      _,
      { staffId, name, email, password, departmentId, roleId, permissionIds },
      context,
    ) => {
      try {
        await checkPermission(context.user, "staff.edit");
        const staffExists = await prisma.staff.findUnique({
          where: { id: staffId },
        });

        if (!staffExists) {
          throw new Error("Staff not found");
        }

        if (email && email !== staffExists.email) {
          const emailExists = await prisma.staff.findUnique({
            where: { email },
          });

          if (emailExists) {
            throw new Error("Email already in use");
          }
        }

        let hashedPassword;

        if (password) {
          hashedPassword = await bcrypt.hash(password, 10);
        }

        if (permissionIds) {
          await prisma.staffPermission.deleteMany({
            where: { staffId },
          });
        }

        const staff = await prisma.staff.update({
          where: { id: staffId },

          data: {
            ...(name && { name }),
            ...(email && { email }),
            ...(hashedPassword && { password: hashedPassword }),

            ...(departmentId && {
              department: { connect: { id: departmentId } },
            }),

            ...(roleId && {
              role: { connect: { id: roleId } },
            }),

            ...(permissionIds && {
              permissions: {
                create: permissionIds.map((id) => ({
                  permission: { connect: { id } },
                })),
              },
            }),
          },

          include: {
            department: true,
            role: true,
            permissions: { include: { permission: true } },
          },
        });

        return {
          ...staff,
          permissions: staff.permissions.map((p) => p.permission),
        };
      } catch (error) {
        throw new Error(error.message || "Failed to update staff");
      }
    },
    deleteStaff: async (_, { staffId }, context) => {
      try {
        await checkPermission(context.user, "staff.delete");
        const staff = await prisma.staff.findUnique({
          where: { id: staffId },
        });

        if (!staff) {
          throw new Error("Staff not found");
        }

        await prisma.staffPermission.deleteMany({
          where: { staffId },
        });

        await prisma.staff.delete({
          where: { id: staffId },
        });

        return true;
      } catch (error) {
        throw new Error(error.message || "Failed to delete staff");
      }
    },
  },
};
