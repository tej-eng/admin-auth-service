// src/graphql/resolvers.js
import { PrismaClient } from "@prisma/client";
import { adminLoginService } from "../services/auth.service.js";
import { createAdminService, addAstrologerService } from "../services/adminService.js";
import { DateTimeResolver } from 'graphql-scalars';

const prisma = new PrismaClient();

export const resolvers = {
  Query: {
    // ================= GET USERS (ADMIN ONLY) =================
    getUsersDetails: async (_, { page = 1, limit = 10 }, context) => {
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
    },
  getUsersListBySearch: async (_, { searchInput }, context) => {
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
},

  getRoles: async (_, __, context) => {
  // 1 Authorization
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

  // 2️Flatten permissions
  return roles.map((role) => ({
    id: role.id,
    name: role.name,
    description: role.description,
    permissions: role.permissions.map((rp) => rp.permission),
  }));
},

getPermissions: async (_, __, context) => {
  // 1️ Authorization
  if (!context.user || !["ADMIN", "SUPER_ADMIN"].includes(context.user.role)) {
    throw new Error("Not authorized to view permissions");
  }
  //  Fetch permissions with assigned roles
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
},
  getAstrologerListBySearch : async (_, { searchInput }, context) => {
  if (!context.user) throw new Error("Not authorized");

  const { query, sortField, sortOrder, limit = 10, page = 1 } = searchInput;
  const skip = (page - 1) * limit;

  // Build sorting object for Prisma
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
    orderBy.createdAt = "desc"; // default sort
  }

  // Search filter (name, skills, languages)
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
      take: limit,
    }),
    prisma.astrologer.count({ where }),
  ]);

  return {
    data: astrologers,
    totalCount,
    currentPage: page,
    totalPages: Math.ceil(totalCount / limit),
  };
},


    // ================= GET PENDING ASTROLOGERS =================
    getPendingAstrologers: async (_, { page = 1, limit = 10 }, context) => {
      if (!context.user || context.user.role !== "ADMIN") {
        throw new Error("Admin only");
      }

      const skip = (page - 1) * limit;

      const whereCondition = {
        approvalStatus: { in: ["PENDING", "INTERVIEW", "DOCUMENT_VERIFICATION"] },
      };

      const [astrologers, totalCount] = await Promise.all([
        prisma.astrologer.findMany({
          where: whereCondition,
          skip,
          take: limit,
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

      return {
        data: astrologers,
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
      };
    },

    getAstrologerInterviews: async (_, { astrologerId, page = 1, limit = 10 }, context) => {
      if (!context.user || context.user.role !== "ADMIN") throw new Error("Admin only");

      const skip = (page - 1) * limit;
      const whereCondition = { astrologerId };

      const [interviews, totalCount] = await Promise.all([
        prisma.interview.findMany({
          where: whereCondition,
          skip,
          take: limit,
          orderBy: { roundNumber: "asc" },
        }),
        prisma.interview.count({ where: whereCondition }),
      ]);

      return {
        data: interviews,
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
      };
    },

    getAstrologerDocuments: async (_, { astrologerId, page = 1, limit = 10 }, context) => {
      if (!context.user || context.user.role !== "ADMIN") throw new Error("Admin only");

      const skip = (page - 1) * limit;
      const whereCondition = { astrologerId };

      const [documents, totalCount] = await Promise.all([
        prisma.astrologerDocument.findMany({
          where: whereCondition,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.astrologerDocument.count({ where: whereCondition }),
      ]);

      return {
        data: documents,
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
      };
    },

    getRegisteredAstrologers: async (_, { page = 1, limit = 10 }, context) => {
      if (!context.user || context.user.role !== "ADMIN") throw new Error("Admin only");

      return prisma.astrologer.findMany({
        skip: (page - 1) * limit,
        take: limit,
        include: { addresses: true, experiences: true },
      });
    },

    getApprovedAstrologers: async (_, { page = 1, limit = 10 }, context) => {
      if (!context.user || context.user.role !== "ADMIN") throw new Error("Admin only");

      const skip = (page - 1) * limit;

      const [astrologers, totalCount] = await Promise.all([
        prisma.astrologer.findMany({
          where: { approvalStatus: "APPROVED" },
          skip,
          take: limit,
          include: {
            addresses: true,
            experiences: true,
            interviews: true,
            documents: true,
            rejectionHistory: true,
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.astrologer.count({ where: { approvalStatus: "APPROVED" } }),
      ]);

      return {
        data: astrologers,
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
      };
    },
   getAdmins: async (_, { page = 1, limit = 10 }, context) => {
  if (!context.user || context.user.role !== "SUPER_ADMIN")
    throw new Error("Only SUPER_ADMIN can view admins");

  const skip = (page - 1) * limit;

  const [admins, totalCount] = await Promise.all([
    prisma.admin.findMany({
      where: {
        role: {
          name: "ADMIN",   
        },
      },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        role: true,       
      },
    }),
    prisma.admin.count({
      where: {
        role: {
          name: "ADMIN",  
        },
      },
    }),
  ]);

  return {
    data: admins,
    totalCount,
    currentPage: page,
    totalPages: Math.ceil(totalCount / limit),
  };
},


  },

  Mutation: {
    // ================= ADMIN LOGIN =================
    loginAdmin: async (_, { email, password }) => {
      return adminLoginService(email, password);
    },

   logoutAdmin: async (_, __, context) => {
    if (!context.user?.id) {
    throw new Error("Unauthorized");
    }

    return "Admin logged out successfully";
},
     
  createPermission: async (_, { name, description }, context) => {
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

  return prisma.permission.create({
    data: {
      name: normalizedName,
      description,
    },
  });
},


updatePermission: async (
  _,
  { permissionId, name, description },
  context
) => {
  //  Authorization
  if (!context.user || context.user.role !== "SUPER_ADMIN") {
    throw new Error("Only SUPER_ADMIN can update permissions");
  }

  //  Check permission exists
  const existingPermission = await prisma.permission.findUnique({
    where: { id: permissionId },
  });

  if (!existingPermission) {
    throw new Error("Permission not found");
  }

  let normalizedName;

  // Normalize + check duplicate
  if (name) {
    normalizedName = name.trim().toUpperCase();

    const duplicate = await prisma.permission.findUnique({
      where: { name: normalizedName },
    });

    if (duplicate && duplicate.id !== permissionId) {
      throw new Error("Permission name already exists");
    }
  }

  // Update
  const updatedPermission = await prisma.permission.update({
    where: { id: permissionId },
    data: {
      ...(normalizedName && { name: normalizedName }),
      ...(description !== undefined && { description }),
    },
  });

  return updatedPermission;
},

deletePermission: async (_, { permissionId }, context) => {
  //  Authorization
  if (!context.user || context.user.role !== "SUPER_ADMIN") {
    throw new Error("Only SUPER_ADMIN can delete permissions");
  }

  //  Check permission exists
  const existingPermission = await prisma.permission.findUnique({
    where: { id: permissionId },
    include: {
      roles: true, // RolePermission[]
    },
  });

  if (!existingPermission) {
    throw new Error("Permission not found");
  }

  //  Prevent delete if assigned
  if (existingPermission.roles.length > 0) {
    throw new Error("Cannot delete permission assigned to roles");
  }

  //  Delete permission
  await prisma.permission.delete({
    where: { id: permissionId },
  });

  return "Permission deleted successfully";
},


createRole: async (_, { name, description, permissionIds = [] }, context) => {
  // 1️ Authorization
  if (!context.user || context.user.role !== "SUPER_ADMIN") {
    throw new Error("Only SUPER_ADMIN can create roles");
  }

  const normalizedName = name.trim().toUpperCase();

  // 2️ Check existing role
  const existingRole = await prisma.role.findUnique({
    where: { name: normalizedName },
  });

  if (existingRole) {
    throw new Error("Role already exists");
  }

  // 3️ Validate permissions (if provided)
  if (permissionIds.length > 0) {
    const permissions = await prisma.permission.findMany({
      where: { id: { in: permissionIds } },
    });

    if (permissions.length !== permissionIds.length) {
      throw new Error("One or more permission IDs are invalid");
    }
  }

  // 4️ Create role
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

  // 5️ Return flattened permissions
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    permissions: role.permissions.map((rp) => rp.permission),
  };
},

updateRole: async (
  _,
  { roleId, name, description, permissionIds },
  context
) => {
  
  if (!context.user || context.user.role !== "SUPER_ADMIN") {
    throw new Error("Only SUPER_ADMIN can update roles");
  }

  //  Check role exists
  const existingRole = await prisma.role.findUnique({
    where: { id: roleId },
    include: { permissions: true },
  });

  if (!existingRole) {
    throw new Error("Role not found");
  }

  //  Normalize name (if provided)
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

  //  Validate permissions (if provided)
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

  //  Update Role
  const updatedRole = await prisma.role.update({
    where: { id: roleId },
    data: {
      ...(normalizedName && { name: normalizedName }),
      ...(description !== undefined && { description }),

      ...(permissionIds && {
        permissions: {
          deleteMany: {}, // remove old permissions
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
},

deleteRole: async (_, { roleId }, context) => {
  //  Authorization
  if (!context.user || context.user.role !== "SUPER_ADMIN") {
    throw new Error("Only SUPER_ADMIN can delete roles");
  }

  //  Check role exists
  const existingRole = await prisma.role.findUnique({
    where: { id: roleId },
    include: {
      admins: true,
    },
  });

  if (!existingRole) {
    throw new Error("Role not found");
  }

  //  Prevent deletion if assigned to any admin
  if (existingRole.admins.length > 0) {
    throw new Error("Cannot delete role assigned to admins");
  }

  //  Delete role (RolePermission will auto-delete if cascade set,
  // otherwise delete manually)
  await prisma.rolePermission.deleteMany({
    where: { roleId },
  });

  await prisma.role.delete({
    where: { id: roleId },
  });

  return "Role deleted successfully";
},

assignPermissionsToRole: async (_, { roleId, permissionIds }, context) => {
  if (!context.user || context.user.role !== "SUPER_ADMIN") {
    throw new Error("Only SUPER_ADMIN can assign permissions");
  }

  //  Check if role exists
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new Error("Role not found");

  //  Validate all permission IDs
  const permissions = await prisma.permission.findMany({
    where: { id: { in: permissionIds } },
  });

  if (permissions.length !== permissionIds.length) {
    throw new Error("One or more permission IDs are invalid");
  }

  //  Create role-permission relations (skip duplicates)
  await prisma.rolePermission.createMany({
    data: permissionIds.map((permissionId) => ({
      roleId,
      permissionId,
    })),
    skipDuplicates: true,
  });

  //  Fetch the updated role with permissions
  const updatedRole = await prisma.role.findUnique({
    where: { id: roleId },
    include: {
      permissions: {
        include: { permission: true }, // maps through RolePermission
      },
    },
  });

  //  Map to return only permissions
  return {
    id: updatedRole.id,
    name: updatedRole.name,
    description: updatedRole.description,
    permissions: updatedRole.permissions.map((rp) => rp.permission),
  };
},




    // ================= CREATE ADMIN =================
    createAdmin: async (_, args, context) => {
      if (!context.user || context.user.role !== "SUPER_ADMIN")
        throw new Error("Only SUPER_ADMIN can create admins");

      return createAdminService(args);
    },

    updateAdmin: async (_, { adminId, name, email, roleId }, context) => {
  // Authorization
  if (!context.user || context.user.role !== "SUPER_ADMIN") {
    throw new Error("Only SUPER_ADMIN can update admins");
  }

  //  Check admin exists
  const existingAdmin = await prisma.admin.findUnique({
    where: { id: adminId },
    include: { role: true },
  });

  if (!existingAdmin) {
    throw new Error("Admin not found");
  }

  // Prevent editing SUPER_ADMIN
  if (existingAdmin.role.name === "SUPER_ADMIN") {
    throw new Error("Cannot update SUPER_ADMIN");
  }

  //  Email duplicate check
  if (email) {
    const duplicate = await prisma.admin.findUnique({
      where: { email },
    });

    if (duplicate && duplicate.id !== adminId) {
      throw new Error("Email already in use");
    }
  }

  //  Validate role if provided
  if (roleId) {
    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new Error("Invalid role");
    }
  }

  //  Update admin
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
},

deleteAdmin: async (_, { adminId }, context) => {
  if (!context.user || context.user.role !== "SUPER_ADMIN") {
    throw new Error("Only SUPER_ADMIN can delete admins");
  }

  //  Check admin exists
  const existingAdmin = await prisma.admin.findUnique({
    where: { id: adminId },
    include: { role: true },
  });

  if (!existingAdmin) {
    throw new Error("Admin not found");
  }

  //  Prevent deleting SUPER_ADMIN
  if (existingAdmin.role.name === "SUPER_ADMIN") {
    throw new Error("Cannot delete SUPER_ADMIN");
  }

  //  Delete
  await prisma.admin.delete({
    where: { id: adminId },
  });

  return "Admin deleted successfully";
},



    // ================= ADD ASTROLOGER =================
    addAstrologer: async (_, args, context) => {
      if (!context.user || !["SUPER_ADMIN", "MANAGER"].includes(context.user.role))
        throw new Error("Not authorized");

      return addAstrologerService(args);
    },

    updateAstrologer: async (_, { astrologerId, data }, context) => {
      if (!context.user || !["SUPER_ADMIN", "MANAGER"].includes(context.user.role))
        throw new Error("Not authorized");

      // Verify astrologer exists
      const existing = await prisma.astrologer.findUnique({ where: { id: astrologerId } });
      if (!existing) throw new Error("Astrologer not found");

      // Update fields
      return prisma.astrologer.update({
        where: { id: astrologerId },
        data,
      });
    },

    deleteAstrologer: async (_, { astrologerId }, context) => {
      if (!context.user || !["SUPER_ADMIN", "MANAGER"].includes(context.user.role))
        throw new Error("Not authorized");

      // Verify astrologer exists
      const existing = await prisma.astrologer.findUnique({ where: { id: astrologerId } });
      if (!existing) throw new Error("Astrologer not found");

      await prisma.astrologer.delete({ where: { id: astrologerId } });

      return true; 
    },
  updateUser: async (_, { userId, data }, context) => {
  if (!context.user || context.user.role !== "ADMIN") {
    throw new Error("Admin only");
  }

  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existingUser || existingUser.isDeleted) {
    throw new Error("User not found");
  }

  // Prevent updating to duplicate mobile
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
},

updateUser: async (_, { userId, data }, context) => {
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
},
  
  deleteUser: async (_, { userId }, context) => {
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
},

    // ================= APPROVE / REJECT / VERIFY =================
    verifyDocument: async (_, { documentId, status, remarks }, context) => {
      if (!context.user || context.user.role !== "ADMIN") throw new Error("Admin only");

      return prisma.astrologerDocument.update({
        where: { id: Number(documentId) },
        data: { status, remarks, verifiedBy: context.user.id, verifiedAt: new Date() },
      });
    },

    scheduleInterview: async (_, args, context) => {
      if (!context.user || context.user.role !== "ADMIN") throw new Error("Admin only");

      await prisma.astrologer.update({
        where: { id: args.astrologerId },
        data: { approvalStatus: "INTERVIEW" },
      });

      return prisma.interview.create({
        data: {
          astrologerId: args.astrologerId,
          roundNumber: args.roundNumber,
          interviewerName: args.interviewerName,
          scheduledAt: new Date(args.scheduledAt),
        },
      });
    },

    rejectAstrologer: async (_, { astrologerId, stage, reason }, context) => {
      if (!context.user || context.user.role !== "ADMIN") throw new Error("Admin only");

      await prisma.astrologerRejectionHistory.create({
        data: { astrologerId, stage, reason, rejectedBy: context.user.id },
      });

      await prisma.astrologer.update({
        where: { id: astrologerId },
        data: { approvalStatus: "REJECTED" },
      });

      return true;
    },

    approveAstrologer: async (_, { astrologerId }, context) => {
      if (!context.user || context.user.role !== "ADMIN") throw new Error("Admin only");

      await prisma.astrologer.update({
        where: { id: astrologerId },
        data: { approvalStatus: "APPROVED" },
      });

      return true;
    },
  },
};
