// src/graphql/resolvers.js
import { PrismaClient } from "@prisma/client";
import { adminLoginService } from "../services/auth.service.js";
import { createAdminService, addAstrologerService } from "../services/adminService.js";
import { DateTimeResolver } from 'graphql-scalars';
import { connectMongo } from "../config/mongo.js";

const prisma = new PrismaClient();

async function logGraphQLEvent(type, operation, userId = null, details = {}) {
  try {
    const db = await connectMongo();
    const collection = db.collection("adminGraphQLLogs");

    await collection.insertOne({
      type,              // SUCCESS / ERROR
      operation,         // getUsersDetails / createRole etc
      userId,
      details,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Mongo log failed:", error.message);
  }
}

export const resolvers = {
  Query: {
    // ================= GET USERS (ADMIN ONLY) =================
getUsersDetails: async (_, { page = 1, limit = 10 }, context) => {
  try {
    if (!context.user || context.user.role !== "ADMIN") {
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

    const {
      query,
      page = 1,
      limit = 10
    } = searchInput;

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


getRoles: async (_, __, context) => {
  try {
    if (!context.user || context.user.role !== "SUPER_ADMIN") {
      throw new Error("Only SUPER_ADMIN can view roles");
    }

    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions.map((rp) => rp.permission),
    }));

  } catch (error) {
    throw error;
  }
},

getPermissions: async (_, __, context) => {
  try {
    if (!context.user || !["ADMIN", "SUPER_ADMIN"].includes(context.user.role)) {
      throw new Error("Not authorized to view permissions");
    }

    const permissions = await prisma.permission.findMany({
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return permissions;

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
      page = 1
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
        in: ["PENDING", "INTERVIEW", "DOCUMENT_VERIFICATION"]
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

getAstrologerInterviews: async (_, { astrologerId, page = 1, limit = 10 }, context) => {
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

getAstrologerDocuments: async (_, { astrologerId, page = 1, limit = 10 }, context) => {
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

  },

  Mutation: {
    // ================= ADMIN LOGIN =================
  loginAdmin: async (_, { email, password }) => {
  try {
    const result = await adminLoginService(email, password);
    return result;

  } catch (error) {
    throw new Error(error.message || "Login failed");
  }
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
     
 createPermission: async (_, { name, description }, context) => {
  try {
    if (!context.user || context.user.role !== "SUPER_ADMIN") {
      throw new Error("Only SUPER_ADMIN can create permissions");
    }

    const normalizedName = name.trim().toUpperCase();

    const existing = await prisma.permission.findUnique({
      where: { name: normalizedName },
    });

    if (existing) {
      throw new Error("Permission already exists");
    }

    return await prisma.permission.create({
      data: {
        name: normalizedName,
        description,
      },
    });

  } catch (error) {
    throw new Error(error.message || "Failed to create permission");
  }
},


updatePermission: async (
  _,
  { permissionId, name, description },
  context
) => {
  try {
    if (!context.user || context.user.role !== "SUPER_ADMIN") {
      throw new Error("Only SUPER_ADMIN can update permissions");
    }

    const existingPermission = await prisma.permission.findUnique({
      where: { id: permissionId },
    });

    if (!existingPermission) {
      throw new Error("Permission not found");
    }

    let normalizedName;

    if (name) {
      normalizedName = name.trim().toUpperCase();

      const duplicate = await prisma.permission.findUnique({
        where: { name: normalizedName },
      });

      if (duplicate && duplicate.id !== permissionId) {
        throw new Error("Permission name already exists");
      }
    }

    const updatedPermission = await prisma.permission.update({
      where: { id: permissionId },
      data: {
        ...(normalizedName && { name: normalizedName }),
        ...(description !== undefined && { description }),
      },
    });

    return updatedPermission;

  } catch (error) {
    throw new Error(error.message || "Failed to update permission");
  }
},


deletePermission: async (_, { permissionId }, context) => {
  try {
    if (!context.user || context.user.role !== "SUPER_ADMIN") {
      throw new Error("Only SUPER_ADMIN can delete permissions");
    }

    const existingPermission = await prisma.permission.findUnique({
      where: { id: permissionId },
      include: {
        roles: true,
      },
    });

    if (!existingPermission) {
      throw new Error("Permission not found");
    }

    if (existingPermission.roles.length > 0) {
      throw new Error("Cannot delete permission assigned to roles");
    }

    await prisma.permission.delete({
      where: { id: permissionId },
    });

    return "Permission deleted successfully";

  } catch (error) {
    throw new Error(error.message || "Failed to delete permission");
  }
},

createRole: async (_, { name, description, permissionIds = [] }, context) => {
  try {
    if (!context.user || context.user.role !== "SUPER_ADMIN") {
      throw new Error("Only SUPER_ADMIN can create roles");
    }

    const normalizedName = name.trim().toUpperCase();

    const existingRole = await prisma.role.findUnique({
      where: { name: normalizedName },
    });

    if (existingRole) {
      throw new Error("Role already exists");
    }

    if (permissionIds.length > 0) {
      const permissions = await prisma.permission.findMany({
        where: { id: { in: permissionIds } },
      });

      if (permissions.length !== permissionIds.length) {
        throw new Error("One or more permission IDs are invalid");
      }
    }

    const role = await prisma.role.create({
      data: {
        name: normalizedName,
        description,
        ...(permissionIds.length > 0 && {
          permissions: {
            create: permissionIds.map((permissionId) => ({
              permission: {
                connect: { id: permissionId },
              },
            })),
          },
        }),
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions.map((rp) => rp.permission),
    };

  } catch (error) {
    throw new Error(error.message || "Failed to create role");
  }
},


updateRole: async (
  _,
  { roleId, name, description, permissionIds },
  context
) => {
  try {
    if (!context.user || context.user.role !== "SUPER_ADMIN") {
      throw new Error("Only SUPER_ADMIN can update roles");
    }

    const existingRole = await prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: true },
    });

    if (!existingRole) {
      throw new Error("Role not found");
    }

    let normalizedName;
    if (name) {
      normalizedName = name.trim().toUpperCase();

      const duplicate = await prisma.role.findUnique({
        where: { name: normalizedName },
      });

      if (duplicate && duplicate.id !== roleId) {
        throw new Error("Role name already exists");
      }
    }

    if (permissionIds) {
      if (permissionIds.length > 0) {
        const permissions = await prisma.permission.findMany({
          where: { id: { in: permissionIds } },
        });

        if (permissions.length !== permissionIds.length) {
          throw new Error("One or more permission IDs are invalid");
        }
      }
    }

    const updatedRole = await prisma.role.update({
      where: { id: roleId },
      data: {
        ...(normalizedName && { name: normalizedName }),
        ...(description !== undefined && { description }),
        ...(permissionIds && {
          permissions: {
            deleteMany: {},
            ...(permissionIds.length > 0 && {
              create: permissionIds.map((permissionId) => ({
                permission: {
                  connect: { id: permissionId },
                },
              })),
            }),
          },
        }),
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
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
    throw new Error(error.message || "Failed to update role");
  }
},


deleteRole: async (_, { roleId }, context) => {
  try {
    if (!context.user || context.user.role !== "SUPER_ADMIN") {
      throw new Error("Only SUPER_ADMIN can delete roles");
    }

    const existingRole = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        admins: true,
      },
    });

    if (!existingRole) {
      throw new Error("Role not found");
    }

    if (existingRole.admins.length > 0) {
      throw new Error("Cannot delete role assigned to admins");
    }

    await prisma.rolePermission.deleteMany({
      where: { roleId },
    });

    await prisma.role.delete({
      where: { id: roleId },
    });

    return "Role deleted successfully";

  } catch (error) {
    throw new Error(error.message || "Failed to delete role");
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
    throw new Error(error.message || "Failed to assign permissions to role");
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
addAstrologer: async (_, args, context) => {
  try {
    if (!context.user || !["SUPER_ADMIN", "MANAGER"].includes(context.user.role))
      throw new Error("Not authorized");

    return await addAstrologerService(args);

  } catch (error) {
    throw new Error(error.message || "Failed to add astrologer");
  }
},


// ================= UPDATE ASTROLOGER =================
updateAstrologer: async (_, { astrologerId, data }, context) => {
  try {
    if (!context.user || !["SUPER_ADMIN", "MANAGER"].includes(context.user.role))
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
    if (!context.user || !["SUPER_ADMIN", "MANAGER"].includes(context.user.role))
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
  },
};
