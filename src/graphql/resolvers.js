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
import GraphQLJSON from "graphql-type-json";
import { generateSlug } from "../utils/slugify.js";
import { generateAccessToken, generateRefreshToken } from "../config/jwt.js";

const prisma = new PrismaClient();
import fs from "fs";
import path from "path";

const handleUpload = async (file) => {
  try {
    const { createReadStream, filename, mimetype } = await file;
    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "application/pdf",
    ];
    if (!allowedTypes.includes(mimetype)) {
      throw new Error("Invalid file type");
    }

    const UPLOAD_ROOT = path.join(process.cwd(), "uploads");
    const DOCUMENTS_DIR = path.join(UPLOAD_ROOT, "documents");

    console.log("Upload Root:", UPLOAD_ROOT);
    console.log("Documents Dir:", DOCUMENTS_DIR);

    if (!fs.existsSync(DOCUMENTS_DIR)) {
      fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
      console.log("Created documents directory");
    }

    const ext = path.extname(filename) || ".jpg";
    const newFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;

    const uploadPath = path.join(DOCUMENTS_DIR, newFileName);
    console.log("Saving file to:", uploadPath);

    const stream = createReadStream();
    const out = fs.createWriteStream(uploadPath);

    let size = 0;
    const MAX_SIZE = 5 * 1024 * 1024;

    await new Promise((resolve, reject) => {
      stream.on("data", (chunk) => {
        size += chunk.length;
        if (size > MAX_SIZE) {
          stream.destroy();
          out.destroy();
          fs.unlink(uploadPath, () => {});
          reject(new Error("File too large (max 5MB)"));
        }
      });

      stream.pipe(out);

      out.on("finish", resolve);
      out.on("error", reject);
      stream.on("error", reject);
    });

    const publicUrl = `/adminAuth/uploads/documents/${newFileName}`;

    console.log("Upload Success:", publicUrl);
    console.log("=== UPLOAD END ===");

    return {
      url: publicUrl,
      filename: newFileName,
      mimetype,
    };
  } catch (error) {
    console.error(" Upload Error:", error.message);
    console.error(error.stack);
    throw new Error(error.message || "Upload failed");
  }
};
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

async function checkPermission(context, requiredPermission) {
  const staff = context.user;

  console.log("STAFF OBJECT:", staff); // 👈 here

  if (!staff || !staff.id) {
    throw new Error("Unauthorized");
  }

  // SUPER ADMIN CHECK
  console.log("ROLE:", staff.role); // 👈 here

  if (staff.role?.slug === "super-admin") {
    return true;
  }

  const roleId = staff.roleId || staff.role?.id;

  console.log("ROLE ID:", roleId); // 👈 here
  console.log("REQUIRED:", requiredPermission); // 👈 here

  if (!roleId) {
    throw new Error("Unauthorized: Role missing");
  }

  const rolePerms = await context.prisma.rolePermission.findMany({
    where: { roleId },
    include: { permission: true },
  });

  const staffPerms = await context.prisma.staffPermission.findMany({
    where: { staffId: staff.id },
    include: { permission: true },
  });

  const allPermissions = [
    ...rolePerms.map((r) => r.permission.name),
    ...staffPerms.map((s) => s.permission.name),
  ];

  console.log("ALL PERMS:", allPermissions); // 👈 MOST IMPORTANT

  if (!allPermissions.includes(requiredPermission)) {
    throw new Error("Unauthorized: Missing permission");
  }

  return true;
}

// generate auto permission
const generateCRUDPermissions = async (module, prismaInstance) => {
  const actions = ["create", "read", "update", "delete"];

  for (const action of actions) {
    const name = `${module.slug}.${action}`;

    const permission = await prismaInstance.permission.upsert({
      where: { name },
      update: {},
      create: {
        name,
        type: "SYSTEM",
      },
    });

    const existingLink = await prismaInstance.modulePermission.findFirst({
      where: {
        moduleId: module.id,
        permissionId: permission.id,
      },
    });

    if (!existingLink) {
      await prismaInstance.modulePermission.create({
        data: {
          moduleId: module.id,
          permissionId: permission.id,
        },
      });
    }
  }
};

export const resolvers = {
  JSON: GraphQLJSON,
  Upload: GraphQLUpload,
  Query: {
    getUsersListBySearch: async (_, { searchInput }) => {
      try {
        const {
          query,
          mobile,
          filterType,
          startDate,
          endDate,
          page = 1,
          limit = 10,
        } = searchInput;

        const safePage = Math.max(page, 1);
        const safeLimit = Math.min(limit, 50);
        const skip = (safePage - 1) * safeLimit;

        const where = {};

        // ---------------- TEXT SEARCH ----------------
        if (query) {
          where.OR = [
            {
              name: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              mobile: {
                contains: query,
              },
            },
          ];
        }

        // ---------------- MOBILE FILTER ----------------
        if (mobile) {
          where.mobile = {
            contains: mobile,
          };
        }

        // ---------------- DATE FILTER ----------------
        if (filterType) {
          const now = new Date();
          let start, end;

          switch (filterType) {
            case "TODAY":
              start = new Date(now.setHours(0, 0, 0, 0));
              end = new Date();
              break;

            case "WEEK":
              start = new Date();
              start.setDate(start.getDate() - 7);
              end = new Date();
              break;

            case "MONTH":
              start = new Date();
              start.setMonth(start.getMonth() - 1);
              end = new Date();
              break;

            case "YEAR":
              start = new Date();
              start.setFullYear(start.getFullYear() - 1);
              end = new Date();
              break;

            case "CUSTOM":
              start = startDate ? new Date(startDate) : undefined;
              end = endDate ? new Date(endDate) : undefined;
              break;
          }

          where.createdAt = {};

          if (start) where.createdAt.gte = start;
          if (end) where.createdAt.lte = end;
        }

        // ---------------- FETCH USERS ----------------
        const [users, totalCount] = await Promise.all([
          prisma.user.findMany({
            where,
            skip,
            take: safeLimit,
            orderBy: {
              createdAt: "desc",
            },

            include: {
              wallet: true,
            },
          }),

          prisma.user.count({ where }),
        ]);

        // ---------------- FINAL RESPONSE ----------------
        const enrichedUsers = users.map((user) => ({
          ...user,

          userCoins: user.wallet?.balanceCoins || 0,
          lockedCoins: user.wallet?.lockedCoins || 0,
        }));

        return {
          data: enrichedUsers,
          totalCount,
          currentPage: safePage,
          totalPages: Math.ceil(totalCount / safeLimit),
        };
      } catch (error) {
        console.error("getUsersListBySearch error:", error);
        throw new Error("Failed to fetch users");
      }
    },

    getAstrologerListBySearch: async (_, { searchInput }, context) => {
      const { prisma } = context;
      await checkPermission(context, "astrologer.read");
      try {
        if (!context) throw new Error("Not authorized");

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

    getAstrologerEarnings: async (_, { searchInput }) => {
      try {
        const {
          query,
          email,
          contactNo,
          filterType,
          startDate,
          endDate,
          page = 1,
          limit = 10,
        } = searchInput;

        // ---------------- PAGINATION ----------------

        const safePage = Math.max(page, 1);

        const safeLimit = Math.min(limit, 50);

        const skip = (safePage - 1) * safeLimit;

        // ---------------- WHERE ----------------

        const where = {};

        // ---------------- SEARCH FILTER ----------------

        const andConditions = [];

        if (query) {
          andConditions.push({
            OR: [
              {
                name: {
                  contains: query,
                  mode: "insensitive",
                },
              },

              {
                email: {
                  contains: query,
                  mode: "insensitive",
                },
              },

              {
                contactNo: {
                  contains: query,
                },
              },
            ],
          });
        }

        if (email) {
          andConditions.push({
            email: {
              contains: email,
              mode: "insensitive",
            },
          });
        }

        if (contactNo) {
          andConditions.push({
            contactNo: {
              contains: contactNo,
            },
          });
        }

        if (andConditions.length > 0) {
          where.astrologer = {
            AND: andConditions,
          };
        }

        // ---------------- DATE FILTER ----------------

        if (filterType) {
          const now = new Date();

          let start;
          let end;

          switch (filterType) {
            case "TODAY":
              start = new Date(now.setHours(0, 0, 0, 0));
              end = new Date();
              break;

            case "WEEK":
              start = new Date();
              start.setDate(start.getDate() - 7);
              end = new Date();
              break;

            case "MONTH":
              start = new Date();
              start.setMonth(start.getMonth() - 1);
              end = new Date();
              break;

            case "YEAR":
              start = new Date();
              start.setFullYear(start.getFullYear() - 1);
              end = new Date();
              break;

            case "CUSTOM":
              start = startDate ? new Date(startDate) : undefined;
              end = endDate ? new Date(endDate) : undefined;
              break;
          }

          where.createdAt = {};

          if (start) {
            where.createdAt.gte = start;
          }

          if (end) {
            where.createdAt.lte = end;
          }
        }

        // ---------------- FETCH WALLET DATA ----------------

        const [wallets, totalCount] = await Promise.all([
          prisma.astrologerWallet.findMany({
            where,

            include: {
              astrologer: true,

              transactions: {
                include: {
                  session: true,
                },
              },
            },

            orderBy: {
              createdAt: "desc",
            },

            skip,

            take: safeLimit,
          }),

          prisma.astrologerWallet.count({
            where,
          }),
        ]);

        // ---------------- DATE HELPERS ----------------

        const todayStart = new Date();

        todayStart.setHours(0, 0, 0, 0);

        const monthStart = new Date();

        monthStart.setDate(1);

        monthStart.setHours(0, 0, 0, 0);

        // ---------------- RESPONSE ----------------

        const enrichedData = wallets.map((wallet) => {
          const transactions = wallet.transactions || [];

          // ---------------- TOTAL SESSION EARNINGS ----------------

          const totalSessionEarnings = transactions.reduce((sum, tx) => {
            return sum + Number(tx.amount || 0);
          }, 0);

          // ---------------- TODAY EARNINGS ----------------

          const todayEarnings = transactions
            .filter((tx) => {
              return new Date(tx.createdAt) >= todayStart;
            })
            .reduce((sum, tx) => {
              return sum + Number(tx.amount || 0);
            }, 0);

          // ---------------- MONTHLY EARNINGS ----------------

          const monthlyEarnings = transactions
            .filter((tx) => {
              return new Date(tx.createdAt) >= monthStart;
            })
            .reduce((sum, tx) => {
              return sum + Number(tx.amount || 0);
            }, 0);

          return {
            astrologerId: wallet.astrologer?.id,

            astrologerName: wallet.astrologer?.name || "",

            email: wallet.astrologer?.email || "",

            contactNo: wallet.astrologer?.contactNo || "",

            balanceCoins: wallet.balanceCoins || 0,

            totalEarned: wallet.totalEarned || 0,

            totalWithdrawn: wallet.totalWithdrawn || 0,

            totalSessionEarnings,

            monthlyEarnings,

            todayEarnings,

            createdAt: wallet.createdAt,
          };
        });

        // ---------------- RETURN ----------------

        return {
          data: enrichedData,

          totalCount,

          currentPage: safePage,

          totalPages: Math.ceil(totalCount / safeLimit),
        };
      } catch (error) {
        console.error("getAstrologerEarnings error:", error);

        throw new Error("Failed to fetch astrologer earnings");
      }
    },
    // -------------------- RESOLVER --------------------

getUsersChatHistory: async (_, { searchInput }, { prisma }) => {
  try {
    const {
      query,
      mobile,
      astrologerName,
      status,
      filterType,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = searchInput;

    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(limit, 50);

    const skip = (safePage - 1) * safeLimit;

    // ---------------- WHERE CONDITION ----------------

    const where = {
      type: "CHAT", // ONLY CHAT DATA
    };

    // ---------------- USER SEARCH FILTER ----------------

    const userFilters = [];

    if (query) {
      userFilters.push(
        {
          name: {
            contains: query,
            mode: "insensitive",
          },
        },
        {
          mobile: {
            contains: query,
          },
        }
      );
    }

    if (mobile) {
      userFilters.push({
        mobile: {
          contains: mobile,
        },
      });
    }

    if (userFilters.length > 0) {
      where.user = {
        OR: userFilters,
      };
    }

    // ---------------- ASTROLOGER FILTER ----------------

    if (astrologerName) {
      where.astrologer = {
        name: {
          contains: astrologerName,
          mode: "insensitive",
        },
      };
    }

    // ---------------- STATUS FILTER ----------------

    if (status) {
      where.status = status;
    }

    // ---------------- DATE FILTER ----------------

    let start;
    let end;

    if (filterType) {
      switch (filterType) {
        case "TODAY":
          start = new Date();
          start.setHours(0, 0, 0, 0);

          end = new Date();
          break;

        case "WEEK":
          start = new Date();
          start.setDate(start.getDate() - 7);

          end = new Date();
          break;

        case "MONTH":
          start = new Date();
          start.setMonth(start.getMonth() - 1);

          end = new Date();
          break;

        case "YEAR":
          start = new Date();
          start.setFullYear(start.getFullYear() - 1);

          end = new Date();
          break;

        case "CUSTOM":
          start = startDate ? new Date(startDate) : undefined;
          end = endDate ? new Date(endDate) : undefined;
          break;
      }
    }

    if (start || end) {
      where.createdAt = {};

      if (start) {
        where.createdAt.gte = start;
      }

      if (end) {
        where.createdAt.lte = end;
      }
    }

    // ---------------- FETCH DATA ----------------

    const [sessions, totalCount, aggregate] = await Promise.all([
      prisma.session.findMany({
        where,

        include: {
          user: {
            select: {
              id: true,
              name: true,
              mobile: true,
              countryCode: true,
            },
          },

          astrologer: {
            select: {
              id: true,
              name: true,
              displayName: true,
            },
          },
        },

        orderBy: {
          createdAt: "desc",
        },

        skip,
        take: safeLimit,
      }),

      prisma.session.count({
        where,
      }),

      prisma.session.aggregate({
        where,

        _sum: {
          coinsDeducted: true,
          coinsEarned: true,
          commission: true,
        },
      }),
    ]);

    // ---------------- FORMAT RESPONSE ----------------

    const formattedData = sessions.map((session) => ({
      sessionId: session.id,

      userId: session.user?.id || null,
      userName: session.user?.name || "",
      mobile: session.user?.mobile || "",

      astrologerId: session.astrologer?.id || null,
      astrologerName:
        session.astrologer?.displayName ||
        session.astrologer?.name ||
        "",

      type: session.type,
      status: session.status,

      ratePerMin: session.ratePerMin || 0,

      durationSec: session.durationSec || 0,

      coinsDeducted: session.coinsDeducted || 0,

      coinsEarned: session.coinsEarned || 0,

      commission: session.commission || 0,

      startedAt: session.startedAt,
      endedAt: session.endedAt,

      createdAt: session.createdAt,
    }));

    // ---------------- RESPONSE ----------------

    return {
      data: formattedData,

      totalCount,

      currentPage: safePage,

      totalPages: Math.ceil(totalCount / safeLimit),

      totalCoinsDeducted:
        aggregate?._sum?.coinsDeducted || 0,

      totalCoinsEarned:
        aggregate?._sum?.coinsEarned || 0,

      totalCommission:
        aggregate?._sum?.commission || 0,
    };
  } catch (error) {
    console.error("getUsersChatHistory error:", error);

    throw new Error("Failed to fetch users chat history");
  }
},

getUserCallHistory: async (_, { searchInput }, { prisma }) => {
  try {
    const {
      query,
      mobile,
      astrologerName,
      status,
      filterType,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = searchInput;

    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(limit, 50);

    const skip = (safePage - 1) * safeLimit;

    // ---------------- WHERE CONDITION ----------------

    const where = {
      type: "CALL", // ONLY CALL DATA
    };

    // ---------------- USER SEARCH FILTER ----------------

    const userFilters = [];

    if (query) {
      userFilters.push(
        {
          name: {
            contains: query,
            mode: "insensitive",
          },
        },
        {
          mobile: {
            contains: query,
          },
        }
      );
    }

    if (mobile) {
      userFilters.push({
        mobile: {
          contains: mobile,
        },
      });
    }

    if (userFilters.length > 0) {
      where.user = {
        OR: userFilters,
      };
    }

    // ---------------- ASTROLOGER FILTER ----------------

    if (astrologerName) {
      where.astrologer = {
        name: {
          contains: astrologerName,
          mode: "insensitive",
        },
      };
    }

    // ---------------- STATUS FILTER ----------------

    if (status) {
      where.status = status;
    }

    // ---------------- DATE FILTER ----------------

    let start;
    let end;

    if (filterType) {
      switch (filterType) {
        case "TODAY":
          start = new Date();
          start.setHours(0, 0, 0, 0);

          end = new Date();
          break;

        case "WEEK":
          start = new Date();
          start.setDate(start.getDate() - 7);

          end = new Date();
          break;

        case "MONTH":
          start = new Date();
          start.setMonth(start.getMonth() - 1);

          end = new Date();
          break;

        case "YEAR":
          start = new Date();
          start.setFullYear(start.getFullYear() - 1);

          end = new Date();
          break;

        case "CUSTOM":
          start = startDate ? new Date(startDate) : undefined;
          end = endDate ? new Date(endDate) : undefined;
          break;
      }
    }

    if (start || end) {
      where.createdAt = {};

      if (start) {
        where.createdAt.gte = start;
      }

      if (end) {
        where.createdAt.lte = end;
      }
    }

    // ---------------- FETCH DATA ----------------

    const [sessions, totalCount, aggregate] = await Promise.all([
      prisma.session.findMany({
        where,

        include: {
          user: {
            select: {
              id: true,
              name: true,
              mobile: true,
              countryCode: true,
            },
          },

          astrologer: {
            select: {
              id: true,
              name: true,
              displayName: true,
            },
          },
        },

        orderBy: {
          createdAt: "desc",
        },

        skip,
        take: safeLimit,
      }),

      prisma.session.count({
        where,
      }),

      prisma.session.aggregate({
        where,

        _sum: {
          coinsDeducted: true,
          coinsEarned: true,
          commission: true,
        },
      }),
    ]);

    // ---------------- FORMAT RESPONSE ----------------

    const formattedData = sessions.map((session) => ({
      sessionId: session.id,

      userId: session.user?.id || null,
      userName: session.user?.name || "",
      mobile: session.user?.mobile || "",

      astrologerId: session.astrologer?.id || null,
      astrologerName:
        session.astrologer?.displayName ||
        session.astrologer?.name ||
        "",

      type: session.type,
      status: session.status,

      ratePerMin: session.ratePerMin || 0,

      durationSec: session.durationSec || 0,

      coinsDeducted: session.coinsDeducted || 0,

      coinsEarned: session.coinsEarned || 0,

      commission: session.commission || 0,

      startedAt: session.startedAt,
      endedAt: session.endedAt,

      createdAt: session.createdAt,
    }));

    // ---------------- RESPONSE ----------------

    return {
      data: formattedData,

      totalCount,

      currentPage: safePage,

      totalPages: Math.ceil(totalCount / safeLimit),

      totalCoinsDeducted:
        aggregate?._sum?.coinsDeducted || 0,

      totalCoinsEarned:
        aggregate?._sum?.coinsEarned || 0,

      totalCommission:
        aggregate?._sum?.commission || 0,
    };
  } catch (error) {
    console.error("getUserCallHistory error:", error);

    throw new Error("Failed to fetch user call history");
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
      await checkPermission(context, "walletpackages.read");

      return prisma.rechargePack.findMany({
        orderBy: { createdAt: "desc" },
      });
    },
    getUserWalletTransactions: async (
      _,
      {
        page = 1,
        limit = 20,
        type,
        amount,
        mobile,
        filterType,
        startDate,
        endDate,
      },
    ) => {
      try {
        const skip = (page - 1) * limit;

        // Only USER transactions
        const whereClause = {
          userWalletId: {
            not: null,
          },
        };

        // Transaction type filter
        if (type) {
          whereClause.type = type.toUpperCase();
        }

        // Amount filter
        if (amount) {
          whereClause.amount = Number(amount);
        }

        // Mobile filter
        if (mobile) {
          whereClause.userWallet = {
            user: {
              mobile: {
                contains: mobile,
              },
            },
          };
        }

        // =========================
        // DATE FILTERS
        // =========================

        const now = new Date();

        // Weekly filter
        if (filterType === "WEEK") {
          const weekStart = new Date();
          weekStart.setDate(now.getDate() - 7);

          whereClause.createdAt = {
            gte: weekStart,
            lte: now,
          };
        }

        // Monthly filter
        if (filterType === "MONTH") {
          const monthStart = new Date();
          monthStart.setMonth(now.getMonth() - 1);

          whereClause.createdAt = {
            gte: monthStart,
            lte: now,
          };
        }

        // Yearly filter
        if (filterType === "YEAR") {
          const yearStart = new Date();
          yearStart.setFullYear(now.getFullYear() - 1);

          whereClause.createdAt = {
            gte: yearStart,
            lte: now,
          };
        }

        // Custom date filter
        if (filterType === "CUSTOM" && startDate && endDate) {
          whereClause.createdAt = {
            gte: new Date(startDate),
            lte: new Date(endDate),
          };
        }

        const [data, totalCount] = await Promise.all([
          prisma.walletTransaction.findMany({
            where: whereClause,

            include: {
              userWallet: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      mobile: true,
                    },
                  },
                },
              },
            },

            orderBy: {
              createdAt: "desc",
            },

            skip,
            take: limit,
          }),

          prisma.walletTransaction.count({
            where: whereClause,
          }),
        ]);

        return {
          data,
          totalCount,
        };
      } catch (err) {
        console.error("getUserWalletTransactions error:", err);
        throw new Error("Failed to fetch transactions");
      }
    },

    getAstrologerWalletTransactions: async (
      _,
      {
        page = 1,
        limit = 20,
        type,
        amount,
        contactNo,
        filterType,
        startDate,
        endDate,
      },
    ) => {
      try {
        const skip = (page - 1) * limit;

        // =========================
        // BASE FILTER (ONLY ASTROLOGER)
        // =========================
        const whereClause = {
          astrologerWalletId: {
            not: null,
          },
        };

        // =========================
        // TYPE FILTER (ENUM SAFE)
        // =========================
        if (type) {
          whereClause.type = type.toUpperCase();
        }

        // =========================
        // AMOUNT FILTER
        // =========================
        if (amount) {
          whereClause.amount = Number(amount);
        }

        // =========================
        // PHONE NUMBER FILTER
        // =========================
        if (contactNo) {
          whereClause.astrologerWallet = {
            astrologer: {
              contactNo: {
                contains: contactNo,
              },
            },
          };
        }

        // =========================
        // DATE FILTERS
        // =========================
        const now = new Date();

        // WEEK
        if (filterType === "WEEK") {
          const weekStart = new Date();
          weekStart.setDate(now.getDate() - 7);

          whereClause.createdAt = {
            gte: weekStart,
            lte: now,
          };
        }

        // MONTH
        if (filterType === "MONTH") {
          const monthStart = new Date();
          monthStart.setMonth(now.getMonth() - 1);

          whereClause.createdAt = {
            gte: monthStart,
            lte: now,
          };
        }

        // YEAR
        if (filterType === "YEAR") {
          const yearStart = new Date();
          yearStart.setFullYear(now.getFullYear() - 1);

          whereClause.createdAt = {
            gte: yearStart,
            lte: now,
          };
        }

        // CUSTOM DATE
        if (filterType === "CUSTOM" && startDate && endDate) {
          whereClause.createdAt = {
            gte: new Date(startDate),
            lte: new Date(endDate),
          };
        }

        // =========================
        // QUERY DATA
        // =========================
        const [data, totalCount] = await Promise.all([
          prisma.walletTransaction.findMany({
            where: whereClause,

            include: {
              astrologerWallet: {
                include: {
                  astrologer: {
                    select: {
                      id: true,
                      name: true,
                      displayName: true,
                      contactNo: true,
                      email: true,
                    },
                  },
                },
              },
            },

            orderBy: {
              createdAt: "desc",
            },

            skip,
            take: limit,
          }),

          prisma.walletTransaction.count({
            where: whereClause,
          }),
        ]);

        return {
          data,
          totalCount,
        };
      } catch (err) {
        console.error("getAstrologerWalletTransactions error:", err);
        throw new Error("Failed to fetch astrologer wallet transactions");
      }
    },

    getAllWalletTransactions: async (
      _,
      {
        page = 1,
        limit = 20,
        type,
        amount,
        contactNo,
        filterType,
        startDate,
        endDate,
        source,
      },
    ) => {
      try {
        const skip = (page - 1) * limit;

        const whereClause = {};

        // ======================
        // SOURCE FILTER (USER / ASTROLOGER / ALL)
        // ======================
        if (source === "USER") {
          whereClause.userWalletId = { not: null };
        }

        if (source === "ASTROLOGER") {
          whereClause.astrologerWalletId = { not: null };
        }

        // ======================
        // TYPE FILTER
        // ======================
        if (type) {
          whereClause.type = type.toUpperCase();
        }

        // ======================
        // AMOUNT FILTER
        // ======================
        if (amount) {
          whereClause.amount = Number(amount);
        }

        // ======================
        // PHONE FILTER (USER + ASTROLOGER)
        // ======================
        if (contactNo) {
          whereClause.OR = [
            {
              userWallet: {
                user: {
                  contactNo: {
                    contains: contactNo,
                  },
                },
              },
            },
            {
              astrologerWallet: {
                astrologer: {
                  contactNo: {
                    contains: contactNo,
                  },
                },
              },
            },
          ];
        }

        // ======================
        // DATE FILTERS
        // ======================
        const now = new Date();

        if (filterType === "WEEK") {
          const weekStart = new Date();
          weekStart.setDate(now.getDate() - 7);

          whereClause.createdAt = { gte: weekStart, lte: now };
        }

        if (filterType === "MONTH") {
          const monthStart = new Date();
          monthStart.setMonth(now.getMonth() - 1);

          whereClause.createdAt = { gte: monthStart, lte: now };
        }

        if (filterType === "YEAR") {
          const yearStart = new Date();
          yearStart.setFullYear(now.getFullYear() - 1);

          whereClause.createdAt = { gte: yearStart, lte: now };
        }

        if (filterType === "CUSTOM" && startDate && endDate) {
          whereClause.createdAt = {
            gte: new Date(startDate),
            lte: new Date(endDate),
          };
        }

        // ======================
        // FETCH DATA
        // ======================
        const [data, totalCount] = await Promise.all([
          prisma.walletTransaction.findMany({
            where: whereClause,

            include: {
              userWallet: {
                include: {
                  user: true,
                },
              },
              astrologerWallet: {
                include: {
                  astrologer: true,
                },
              },
            },

            orderBy: {
              createdAt: "desc",
            },

            skip,
            take: limit,
          }),

          prisma.walletTransaction.count({
            where: whereClause,
          }),
        ]);

        // ======================
        // ADD SOURCE FIELD
        // ======================
        const formattedData = data.map((tx) => ({
          ...tx,
          source: tx.userWalletId ? "USER" : "ASTROLOGER",
        }));

        return {
          data: formattedData,
          totalCount,
        };
      } catch (err) {
        console.error("getAllWalletTransactions error:", err);
        throw new Error("Failed to fetch wallet transactions");
      }
    },
    getUserReviews: async (_, { searchInput }, { prisma }) => {
  try {
    const {
      query,
      userName,
      astrologerName,
      rating,
      filterType,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = searchInput;

    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(limit, 50);

    const skip = (safePage - 1) * safeLimit;

    // ---------------- WHERE CONDITION ----------------

    const where = {};

    // ---------------- SEARCH FILTER ----------------

    const orFilters = [];

    if (query) {
      orFilters.push(
        {
          userName: {
            contains: query,
            mode: "insensitive",
          },
        },
        {
          astroName: {
            contains: query,
            mode: "insensitive",
          },
        },
        {
          comment: {
            contains: query,
            mode: "insensitive",
          },
        }
      );
    }

    if (orFilters.length > 0) {
      where.OR = orFilters;
    }

    // ---------------- USER FILTER ----------------

    if (userName) {
      where.userName = {
        contains: userName,
        mode: "insensitive",
      };
    }

    // ---------------- ASTROLOGER FILTER ----------------

    if (astrologerName) {
      where.astroName = {
        contains: astrologerName,
        mode: "insensitive",
      };
    }

    // ---------------- RATING FILTER ----------------

    if (rating) {
      where.rating = Number(rating);
    }

    // ---------------- DATE FILTER ----------------

    let start;
    let end;

    if (filterType) {
      switch (filterType) {
        case "TODAY":
          start = new Date();
          start.setHours(0, 0, 0, 0);

          end = new Date();
          break;

        case "WEEK":
          start = new Date();
          start.setDate(start.getDate() - 7);

          end = new Date();
          break;

        case "MONTH":
          start = new Date();
          start.setMonth(start.getMonth() - 1);

          end = new Date();
          break;

        case "YEAR":
          start = new Date();
          start.setFullYear(start.getFullYear() - 1);

          end = new Date();
          break;

        case "CUSTOM":
          start = startDate ? new Date(startDate) : undefined;
          end = endDate ? new Date(endDate) : undefined;
          break;
      }
    }

    if (start || end) {
      where.createdAt = {};

      if (start) {
        where.createdAt.gte = start;
      }

      if (end) {
        where.createdAt.lte = end;
      }
    }

    // ---------------- FETCH DATA ----------------

    const [reviews, totalCount, aggregate] = await Promise.all([
      prisma.review.findMany({
        where,

        include: {
          user: {
            select: {
              id: true,
              name: true,
              mobile: true,
            },
          },

          astrologer: {
            select: {
              id: true,
              name: true,
              displayName: true,
            },
          },

          session: {
            select: {
              id: true,
              type: true,
              status: true,
            },
          },
        },

        orderBy: {
          createdAt: "desc",
        },

        skip,
        take: safeLimit,
      }),

      prisma.review.count({
        where,
      }),

      prisma.review.aggregate({
        where,

        _avg: {
          rating: true,
        },
      }),
    ]);

    // ---------------- FORMAT RESPONSE ----------------

    const formattedData = reviews.map((review) => ({
      reviewId: review.id,

      sessionId: review.session?.id || null,

      userId: review.user?.id || null,
      userName: review.userName || review.user?.name || "",
      mobile: review.user?.mobile || "",

      astrologerId: review.astrologer?.id || null,

      astrologerName:
        review.astroName ||
        review.astrologer?.displayName ||
        review.astrologer?.name ||
        "",

      sessionType: review.session?.type || "",

      sessionStatus: review.session?.status || "",

      rating: review.rating,

      comment: review.comment || "",

      createdAt: review.createdAt,
    }));

    // ---------------- RESPONSE ----------------

    return {
      data: formattedData,

      totalCount,

      currentPage: safePage,

      totalPages: Math.ceil(totalCount / safeLimit),

      averageRating:
        aggregate?._avg?.rating || 0,
    };
  } catch (error) {
    console.error("getUserReviews error:", error);

    throw new Error("Failed to fetch user reviews");
  }
},

getFraudFlags: async (_, { searchInput }, { prisma }) => {
  try {
    const {
      query,
      page = 1,
      limit = 10,
    } = searchInput || {};

    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(limit, 50);

    const skip = (safePage - 1) * safeLimit;

    const where = {};

    if (query) {
      where.keyword = {
        contains: query,
        mode: "insensitive",
      };
    }

    const [flags, totalCount] = await Promise.all([
      prisma.fraudFlag.findMany({
        where,

        orderBy: {
          createdAt: "desc",
        },

        skip,
        take: safeLimit,
      }),

      prisma.fraudFlag.count({
        where,
      }),
    ]);

    return {
      data: flags,

      totalCount,

      currentPage: safePage,

      totalPages: Math.ceil(
        totalCount / safeLimit
      ),
    };
  } catch (error) {
    console.error(
      "getFraudFlags error:",
      error
    );

    throw new Error(
      "Failed to fetch fraud flags"
    );
  }
},

getFraudLogs: async (
  _,
  { searchInput },
  { prisma }
) => {
  try {
    const {
      query,
      status,
      filterType,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = searchInput || {};

    const safePage = Math.max(page, 1);

    const safeLimit = Math.min(limit, 50);

    const skip =
      (safePage - 1) * safeLimit;

    const where = {};

    // ---------------- SEARCH ----------------

    if (query) {
      where.OR = [
        {
          senderName: {
            contains: query,
            mode: "insensitive",
          },
        },

        {
          receiverName: {
            contains: query,
            mode: "insensitive",
          },
        },

        {
          orderId: {
            contains: query,
            mode: "insensitive",
          },
        },

        {
          message: {
            contains: query,
            mode: "insensitive",
          },
        },
      ];
    }

    // ---------------- STATUS ----------------

    if (status) {
      where.status = status;
    }

    // ---------------- DATE FILTER ----------------

    let start;
    let end;

    if (filterType) {
      switch (filterType) {
        case "TODAY":
          start = new Date();
          start.setHours(0, 0, 0, 0);

          end = new Date();
          break;

        case "WEEK":
          start = new Date();
          start.setDate(
            start.getDate() - 7
          );

          end = new Date();
          break;

        case "MONTH":
          start = new Date();
          start.setMonth(
            start.getMonth() - 1
          );

          end = new Date();
          break;

        case "YEAR":
          start = new Date();
          start.setFullYear(
            start.getFullYear() - 1
          );

          end = new Date();
          break;

        case "CUSTOM":
          start = startDate
            ? new Date(startDate)
            : undefined;

          end = endDate
            ? new Date(endDate)
            : undefined;

          break;
      }
    }

    if (start || end) {
      where.createdAt = {};

      if (start) {
        where.createdAt.gte = start;
      }

      if (end) {
        where.createdAt.lte = end;
      }
    }

    // ---------------- FETCH ----------------

    const [logs, totalCount] =
      await Promise.all([
        prisma.fraudLog.findMany({
          where,

          orderBy: {
            createdAt: "desc",
          },

          skip,
          take: safeLimit,
        }),

        prisma.fraudLog.count({
          where,
        }),
      ]);

    return {
      data: logs,

      totalCount,

      currentPage: safePage,

      totalPages: Math.ceil(
        totalCount / safeLimit
      ),
    };
  } catch (error) {
    console.error(
      "getFraudLogs error:",
      error
    );

    throw new Error(
      "Failed to fetch fraud logs"
    );
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
      const { prisma } = context;
      await checkPermission(context, "roles.read");
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
      const { prisma } = context;
      await checkPermission(context, "permissions.read");

      const skip = (page - 1) * limit;

      const where = {
        isDeleted: false,
        ...(type && { type }),
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
    getDepartments: async (_, { page = 1, limit = 10 }, context) => {
      const skip = (page - 1) * limit;
      const { prisma } = context;
      await checkPermission(context, "departments.read");

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

      //  SUPER ADMIN BYPASS (CRITICAL FIX)
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
      const { prisma } = context;
      await checkPermission(context, "coupons.read");

      try {
        return await prisma.coupon.findMany({
          orderBy: { createdAt: "desc" },
        });
      } catch (error) {
        throw error;
      }
    },

    // dhwani services
    getServices: async (_, __, context) => {
      const { prisma } = context;

      await checkPermission(context, "all-services.read");

      return prisma.service.findMany({
        orderBy: { createdAt: "desc" },
      });
    },

    getCategories: async (_, __, context) => {
      if (!context || !context.prisma) {
        throw new Error("Context not available");
      }

      return context.prisma.category.findMany({
        orderBy: { createdAt: "desc" },
      });
    },

    // gifts
    getGifts: async (_, __, context) => {
      const { prisma } = context;

      await checkPermission(context, "gifts.read");

      return prisma.gift.findMany({
        orderBy: { createdAt: "desc" },
      });
    },

    // Testimonial
    testimonials: async (_, __, context) => {
      await checkPermission(context, "testimonials.read");

      return await context.prisma.testimonial.findMany({
        orderBy: { createdAt: "desc" },
      });
    },

    testimonial: async (_, { id }, context) => {
      await checkPermission(context, "testimonials.read");

      return await context.prisma.testimonial.findUnique({
        where: { id },
      });
    },

    // FAQs
    faqs: async (_, __, context) => {
      await checkPermission(context, "faqs.read");

      return context.prisma.faq.findMany({
        orderBy: { createdAt: "desc" },
      });
    },

    faq: async (_, { id }, context) => {
      await checkPermission(context, "faqs.read");

      return context.prisma.faq.findUnique({
        where: { id },
      });
    },

    // banners
    getBanners: async (_, __, context) => {
      4;
      const { prisma } = context;
      await checkPermission(context, "banners.read");

      return await prisma.banner.findMany({
        orderBy: { sortorder: "asc" },
      });
    },

    // hiring astrologer

    getInterviewers: async (_, __, { prisma }) => {
      return prisma.staff.findMany({
        where: {
          role: {
            slug: "interviewer",
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });
    },

    getPendingApplications: async (_, __, { prisma }) => {
      return await prisma.astrologerApplication.findMany({
        where: {
          status: "PENDING",
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    },

    getApplications: (_, { status }, { prisma }) => {
      return prisma.astrologerApplication.findMany({
        where: status ? { applicationStatus: status } : {},
      });
    },

    // pricing config
    getFinalPrice: async (_, { astrologerId }, { prisma, userId }) => {
      const config = await prisma.pricingConfig.findFirst();
      await prisma.userOfferUsage.upsert({
        where: { userId },
        update: {
          visitCount: { increment: 1 },
        },
        create: {
          userId,
          visitCount: 1,
        },
      });

      const userUsage = await prisma.userOfferUsage.findUnique({
        where: { userId },
      });

      const visitCount = userUsage?.visitCount || 0;

      // 🧠 decision engine
      if (visitCount === 0 && config?.isFirstOfferEnabled) {
        return {
          chatPrice: config.firstChatPrice,
          callPrice: config.firstCallPrice,
          isOfferApplied: true,
        };
      }

      if (visitCount === 1 && config?.isSecondOfferEnabled) {
        return {
          chatPrice: config.secondChatPrice,
          callPrice: config.secondCallPrice,
          isOfferApplied: true,
        };
      }

      // fallback → original astrologer price
      const chat = await prisma.astrologerPricing.findFirst({
        where: { astrologerId, type: "CHAT", isActive: true },
      });

      const call = await prisma.astrologerPricing.findFirst({
        where: { astrologerId, type: "CALL", isActive: true },
      });

      return {
        chatPrice: chat?.price || 0,
        callPrice: call?.price || 0,
        isOfferApplied: false,
      };
    },

    getPricingConfig: async (_, __, { prisma }) => {
      return await prisma.pricingConfig.findFirst();
    },

    getAdminPreviewPrice: async (_, __, { prisma }) => {
      const config = await prisma.pricingConfig.findFirst();

      return {
        chatPrice: config?.isFirstOfferEnabled ? config.firstChatPrice : 50, // fallback

        callPrice: config?.isFirstOfferEnabled ? config.firstCallPrice : 100,

        isOfferApplied: config?.isFirstOfferEnabled || false,
      };
    },

    getOfferAnalytics: async (_, __, { prisma }) => {
      const totalUsers = await prisma.userOfferUsage.count();

      const firstUsed = await prisma.userOfferUsage.count({
        where: { usedFirst: true },
      });

      const secondUsed = await prisma.userOfferUsage.count({
        where: { usedSecond: true },
      });

      return {
        totalUsers,
        firstUsed,
        secondUsed,
      };
    },

    getMyInterviews: async (_, __, { prisma, userId }) => {
      return prisma.astrologerApplication.findMany({
        where: {
          interviewerId: userId,
          interviewStatus: "SCHEDULED",
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    },

    // get application for add astrologer
    getApplicationById: async (_, { id }) => {
      return await prisma.astrologerApplication.findUnique({
        where: { id },
        include: {
          kycDetail: true,
        },
      });
    },
  },

  // *******************************************************************************************************************************

  Mutation: {
    // upload image
    uploadImage: async (_, { file }, context) => {
      try {
        if (!context.user) {
          throw new Error("Unauthorized");
        }

        return await handleUpload(file);
      } catch (error) {
        console.error("uploadImage error:", error);
        throw new Error(error.message || "Upload failed");
      }
    },

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
      const { prisma } = context;

      try {
        console.log("addAstrologer called", {
          requestedBy: context?.user?.id,
          role: context?.user?.role,
          data,
          timestamp: new Date().toISOString(),
        });
        await checkPermission(context, "astrologer.create");

        const astrologer = await prisma.astrologer.create({
          data: {
            name: data.astroname,
            displayName: data.displayName,
            gender: data.gender,
            email: data.email,
            contactNo: String(data.phoneNumber),
            password: data.password,
            experience: Number(data.experience),
            about: data.about,

            languages: data.languages,
            skills: data.expertise,
            problems: data.problems,

            tags: data.tags,
            vtags: data.vtags,

            pricing: {
              create: data.pricing
                .filter((p) => p.isActive)
                .map((p) => ({
                  type: p.type,
                  price: Number(p.price),
                  offerPrice: p.offerPrice ? Number(p.offerPrice) : null,
                  commissionPercent: Number(p.commissionPercent),
                  isActive: p.isActive,
                })),
            },

            addresses: {
              create: {
                street: data.address?.street || "",
                city: data.address?.city || "",
                state: data.address?.state || "",
                country: data.address?.country || "",
                pincode: data.address?.pincode || "",
              },
            },

            // FIX: Only create documents if present
            documents: data.documents
              ? {
                  create: [
                    ...(data.documents?.aadhaar
                      ? [
                          {
                            documentType: "AADHAAR",
                            documentUrl: data.documents.aadhaar,
                          },
                        ]
                      : []),

                    ...(data.documents?.panCard
                      ? [
                          {
                            documentType: "PAN",
                            documentUrl: data.documents.panCard,
                          },
                        ]
                      : []),

                    ...(data.documents?.passbook
                      ? [
                          {
                            documentType: "PASSBOOK",
                            documentUrl: data.documents.passbook,
                          },
                        ]
                      : []),

                    ...(data.documents?.profilePic
                      ? [
                          {
                            documentType: "PROFILE",
                            documentUrl: data.documents.profilePic,
                          },
                        ]
                      : []),
                  ],
                }
              : undefined,

            // FIX: Move bankDetails → KYC
            kycDetail: data.bankDetails
              ? {
                  create: {
                    accountHolderName: data.bankDetails.accountHolderName,
                    accountNumber: data.bankDetails.accountNumber,
                    bankName: data.bankDetails.bankName,
                    ifsc: data.bankDetails.ifscCode,
                    panNumber: data.bankDetails.panCardNumber,
                    branchName: data.bankDetails.branchName,

                    ...(data.applicationId && {
                      application: {
                        connect: { id: data.applicationId },
                      },
                    }),
                  },
                }
              : undefined,

            // optional audit
            // createdBy: context.user.id,
          },
        });

        return {
          success: true,
          message: "Astrologer added successfully",
          data: astrologer,
        };
      } catch (error) {
        console.error("AddAstrologer Error:", error.message);
        throw new Error(error.message || "Failed to add astrologer");
      }
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
        console.log("UUUUUUUUUUUUUUUUUUUUUUUUUUUUUU", context.user);
        if (
          !context.user ||
          !["SUPER_ADMIN", "MANAGER"].includes(context.user.role?.name)
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
        if (!context.user || context.user.role?.name !== "ADMIN") {
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

    // ================= SCHEDULE INTERVIEW =================

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
    approveAstrologer: async (_, { id }) => {
      const app = await prisma.astrologerApplication.findUnique({
        where: { id },
        include: { kyc: true },
      });

      if (!app) throw new Error("Application not found");

      //  create final astrologer
      const astrologer = await prisma.astrologer.create({
        data: {
          name: app.name,
          email: app.email,
          contactNo: app.phoneNumber,
          experience: app.experience,
          languages: app.languages,
          skills: app.skills,
          profilePic: app.kyc?.profileImage,
          approvalStatus: "APPROVED",
        },
      });

      // update application
      await prisma.astrologerApplication.update({
        where: { id },
        data: { approvalStatus: "APPROVED" },
      });

      return astrologer;
    },

    // Recharge packages ===============================

    createRechargePack: async (_, { input }, context) => {
      const { prisma } = context;
      await checkPermission(context, "walletpackages.create");

      try {
        const pack = await prisma.rechargePack.create({
          data: {
            name: input.name,
            description: input.description,
            price: input.price,
            coins: input.coins,
            talktime: input.talktime,
            validityDays: input.validityDays,
            isActive: input.isActive ?? true,
          },
        });

        return pack;
      } catch (error) {
        throw error;
      }
    },

    deleteRechargePack: async (_, { id }, context) => {
      const { prisma } = context;
      await checkPermission(context, "walletpackages.delete");

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
      const { prisma } = context;
      await checkPermission(context, "walletpackages.update");

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
      const { prisma } = context;
      await checkPermission(context, "coupons.create");

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
      const { prisma } = context;
      await checkPermission(context, "coupons.delete");

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
      const { prisma } = context;
      await checkPermission(context, "coupons.update");

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
      const { prisma } = context;

      try {
        await checkPermission(context, "modules.create");

        const normalizedName = name.trim();
        const normalizedSlug = slug.trim().toLowerCase();
        const normalizedSection = section.trim().toLowerCase();

        const module = await prisma.$transaction(async (tx) => {
          const newModule = await tx.module.create({
            data: {
              name: normalizedName,
              slug: normalizedSlug,
              description,
              section: normalizedSection,
            },
          });

          await generateCRUDPermissions(newModule, tx);

          return newModule;
        });

        return module;
      } catch (error) {
        console.error("CREATE MODULE ERROR 👉", error);

        if (error.code === "P2002") {
          throw new Error("Module with same slug already exists");
        }

        throw new Error(error.message || "Failed to create module");
      }
    },

    updateModule: async (
      _,
      { id, name, slug, description, section, isActive },
      context,
    ) => {
      const { prisma } = context;
      try {
        await checkPermission(context, "modules.edit");

        const moduleExists = await prisma.module.findUnique({
          where: { id },
        });

        if (!moduleExists) {
          throw new Error("Module not found");
        }

        //  normalize values if provided
        const normalizedSlug = slug?.trim().toLowerCase();
        const normalizedSection = section?.trim().toLowerCase();

        //  check slug uniqueness (if changed)
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
      const { prisma } = context;
      await checkPermission(context, "modules.delete");

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
      const { prisma } = context;
      try {
        await checkPermission(context, "roles.create");
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

    updateRole: async (
      _,
      { roleId, name, slug, description, isActive },
      context,
    ) => {
      const { prisma } = context;
      await checkPermission(context, "roles.edit");

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
      const { prisma } = context;
      try {
        await checkPermission(context, "roles.delete");
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
          error: "",
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
      const { prisma } = context;
      await checkPermission(context, "permissions.create");

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
      const { prisma } = context;
      await checkPermission(context, "permissions.update");

      const existing = await prisma.permission.findUnique({
        where: { id: permissionId },
      });

      // SYSTEM ko edit nahi karne dena
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
      const { prisma } = context;
      await checkPermission(context, "permissions.delete");

      const existing = await prisma.permission.findUnique({
        where: { id: permissionId },
      });

      //  SYSTEM delete block
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
      const { prisma } = context;
      await checkPermission(context, "departments.create");
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
      const { prisma } = context;
      await checkPermission(context, "departments.edit");
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
      const { prisma } = context;
      await checkPermission(context, "departments.delete");
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
      console.log("CTX USERRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR:", context.user);
      const { prisma } = context;
      try {
        await checkPermission(context, "staff.create");

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
      const { prisma } = context;
      try {
        await checkPermission(context, "staff.edit");
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
      const { prisma } = context;
      try {
        await checkPermission(context, "staff.delete");
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

    // dhwani services

    createCategory: async (_, { input }, context) => {
      await checkPermission(context, "categories.create");

      const { prisma } = context;

      const name = input.name.trim().toLowerCase();

      const existing = await prisma.category.findFirst({
        where: { name },
      });

      if (existing) return existing;

      return prisma.category.create({
        data: {
          name,
          slug: name.replace(/\s+/g, "-"),
        },
      });
    },

    createService: async (_, { input }, context) => {
      const { prisma } = context;
      await checkPermission(context, "all-services.create");

      return prisma.service.create({
        data: {
          name: input.name,
          slug: input.slug,
          type: input.type,
          categoryId: input.type === "CATEGORY" ? input.categoryId : null,
          image: input.image,
          description: input.description,
          longText: input.longText,
          price: input.price,
        },
      });
    },

    deleteService: async (_, { id }, context) => {
      const { prisma } = context;

      await checkPermission(context, "all-services.delete");

      const service = await prisma.service.findUnique({
        where: { id },
      });

      if (!service) {
        throw new Error("Service not found");
      }

      await prisma.service.delete({
        where: { id },
      });

      return true;
    },

    updateService: async (_, { id, input }, context) => {
      const { prisma } = context;

      await checkPermission(context, "all-services.update");

      const existing = await prisma.service.findUnique({
        where: { id },
      });

      if (!existing) throw new Error("Service not found");

      const updated = await prisma.service.update({
        where: { id },
        data: {
          name: input.name,
          slug: input.slug,
          type: input.type,

          //  FIXED
          categoryId: input.type === "CATEGORY" ? input.categoryId : null,

          image: input.image,
          description: input.description,
          longText: input.longText,
          price: input.price,
        },
      });

      return updated;
    },

    // gifts
    createGift: async (_, { input }, context) => {
      await checkPermission(context, "gifts.create");

      return await context.prisma.gift.create({
        data: {
          name: input.name,
          amount: input.amount,
          image: input.image,
          status: input.status,
        },
      });
    },

    updateGift: async (_, { id, input }, context) => {
      await checkPermission(context, "gifts.update"); //  FIXED

      return await context.prisma.gift.update({
        where: { id },
        data: {
          name: input.name,
          amount: input.amount,
          status: input.status,
          ...(input.image && { image: input.image }),
        },
      });
    },
    deleteGift: async (_, { id }, context) => {
      await checkPermission(context, "gifts.delete"); //  FIXED

      await context.prisma.gift.delete({
        where: { id },
      });

      return true;
    },

    // Testimonials
    createTestimonial: async (_, { input }, context) => {
      await checkPermission(context, "testimonials.create");

      // optional validation (good for interviews)
      if (input.rating < 1 || input.rating > 5) {
        throw new Error("Rating must be between 1 and 5");
      }

      return await context.prisma.testimonial.create({
        data: {
          name: input.name,
          address: input.address,
          content: input.content,
          image: input.image,
          rating: input.rating,
        },
      });
    },

    updateTestimonial: async (_, { id, input }, context) => {
      await checkPermission(context, "testimonials.update");

      return await context.prisma.testimonial.update({
        where: { id },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.address && { address: input.address }),
          ...(input.content && { content: input.content }),
          ...(input.image && { image: input.image }),
          ...(input.rating && { rating: input.rating }),
        },
      });
    },

    deleteTestimonial: async (_, { id }, context) => {
      await checkPermission(context, "testimonials.delete");

      await context.prisma.testimonial.delete({
        where: { id },
      });

      return "Testimonial deleted successfully";
    },

    // FAQs
    createFaq: async (_, { input }, context) => {
      await checkPermission(context, "faqs.create");

      return context.prisma.faq.create({
        data: {
          question: input.question,
          answer: input.answer,
        },
      });
    },

    updateFaq: async (_, { id, input }, context) => {
      await checkPermission(context, "faqs.update");

      return context.prisma.faq.update({
        where: { id },
        data: {
          ...(input.question && { question: input.question }),
          ...(input.answer && { answer: input.answer }),
        },
      });
    },

    deleteFaq: async (_, { id }, context) => {
      await checkPermission(context, "faqs.delete");

      await context.prisma.faq.delete({
        where: { id },
      });

      return "FAQ deleted";
    },

    // banners
    createBanner: async (_, { input }, context) => {
      const { prisma } = context;
      await checkPermission(context, "banners.create");

      return await prisma.banner.create({
        data: {
          heading: input.heading,
          subheading: input.subheading,
          slug: input.slug,
          sortorder: input.sortorder,
          bannerlink: input.bannerlink,
          language: input.language,
          imageUrl: input.imageUrl,
        },
      });
    },

    updateBanner: async (_, { id, input }, context) => {
      const { prisma } = context;
      await checkPermission(context, "banners.update");

      return await prisma.banner.update({
        where: { id },
        data: {
          ...input,
        },
      });
    },

    deleteBanner: async (_, { id }, context) => {
      const { prisma } = context;
      await checkPermission(context, "banners.delete");

      await prisma.banner.delete({
        where: { id },
      });

      return true;
    },

    // hiring astrologer
    scheduleInterview: async (
      _,
      { astrologerId, interviewerId, interviewDate, interviewTime, round },
      { prisma },
    ) => {
      return prisma.astrologerApplication.update({
        where: { id: astrologerId },
        data: {
          interviewerId,
          interviewDate: new Date(interviewDate).toISOString(), // ISO fix
          interviewTime,
          round,
          interviewStatus: "SCHEDULED",

          interviewScheduledAt: new Date(),
        },
      });
    },
    updateInterviewResult: async (
      _,
      { astrologerId, status, remarks },
      { prisma },
    ) => {
      return prisma.astrologerApplication.update({
        where: { id: astrologerId },
        data: {
          interviewStatus: status,
          interviewRemarks: remarks,
          interviewTakenAt: new Date(),
        },
      });
    },

    updateDocumentStatus: async (_, { astrologerId, status }, { prisma }) => {
      return prisma.astrologerApplication.update({
        where: { id: astrologerId },
        data: { documentStatus: status },
      });
    },

    updateApprovalStatus: async (_, { astrologerId, status }, { prisma }) => {
      return prisma.astrologerApplication.update({
        where: { id: astrologerId },
        data: { approvalStatus: status },
      });
    },

    approveAstrologer: async (_, { id }, { prisma, user }) => {
      const application = await prisma.astrologerApplication.findUnique({
        where: { id },
      });

      if (!application) throw new Error("Application not found");

      // role check (important)
      if (user.role !== "ADMIN") {
        throw new Error("Not authorized");
      }

      const result = await prisma.$transaction([
        prisma.astrologer.create({
          data: {
            name: application.name,
            email: application.email,
            phoneNumber: application.phoneNumber,
            gender: application.gender,
            languages: application.languages,
            skills: application.skills,
            experience: application.experience,
            about: application.about,
            applicationId: application.id,
            approvedById: user.id,
          },
        }),

        prisma.astrologerApplication.update({
          where: { id },
          data: {
            approvalStatus: "APPROVED",
            applicationStatus: "APPROVED",
          },
        }),
      ]);

      return result[1]; // updated application
    },

    // pricng config
    updatePricingConfig: async (_, args, { prisma }) => {
      const existing = await prisma.pricingConfig.findFirst();

      if (existing) {
        return await prisma.pricingConfig.update({
          where: { id: existing.id },
          data: args,
        });
      }

      return await prisma.pricingConfig.create({
        data: args,
      });
    },

    markOfferUsed: async (_, __, { prisma, userId }) => {
      await prisma.userOfferUsage.upsert({
        where: { userId },
        update: {
          hasUsedFirstOffer: true,
          usedAt: new Date(),
        },
        create: {
          userId,
          hasUsedFirstOffer: true,
          usedAt: new Date(),
        },
      });

      return true;
    },

    // docs and image verify
    saveAndVerifyKyc: async (_, args, context) => {
      if (!context.user) throw new Error("Unauthorized");

      const { astrologerId, input } = args;

      const kyc = await prisma.kycDetail.upsert({
        where: {
          astrologerApplicationId: astrologerId,
        },
        update: {
          ...input,
        },
        create: {
          astrologerApplicationId: astrologerId,
          ...input,
        },
      });

      await prisma.astrologerApplication.update({
        where: { id: astrologerId },
        data: {
          documentStatus: input.status,
        },
      });

      return kyc;
    },

    rejectKyc: async (_, { astrologerId }, context) => {
      if (!context.user) throw new Error("Unauthorized");

      const kyc = await prisma.kycDetail.update({
        where: { astrologerApplicationId: astrologerId },
        data: { status: "REJECTED" },
      });

      await prisma.astrologerApplication.update({
        where: { id: astrologerId },
        data: { documentStatus: "REJECTED" },
      });

      return kyc;
    },

    createFraudFlag: async (
  _,
  { keyword },
  { prisma }
) => {
  try {
    const cleanKeyword =
      keyword.trim().toLowerCase();

    if (!cleanKeyword) {
      throw new Error(
        "Keyword is required"
      );
    }

    const existing =
      await prisma.fraudFlag.findUnique({
        where: {
          keyword: cleanKeyword,
        },
      });

    if (existing) {
      throw new Error(
        "Keyword already exists"
      );
    }

    const fraudFlag =
      await prisma.fraudFlag.create({
        data: {
          keyword: cleanKeyword,
        },
      });

    return fraudFlag;
  } catch (error) {
    console.error(
      "createFraudFlag error:",
      error
    );

    throw new Error(
      error.message ||
        "Failed to create fraud flag"
    );
  }
},
deleteFraudFlag: async (
  _,
  { id },
  { prisma }
) => {
  try {
    await prisma.fraudFlag.delete({
      where: {
        id,
      },
    });

    return true;
  } catch (error) {
    console.error(
      "deleteFraudFlag error:",
      error
    );

    throw new Error(
      "Failed to delete fraud flag"
    );
  }
},

updateFraudLogStatus: async (
  _,
  { id, status },
  { prisma }
) => {
  try {
    const fraudLog =
      await prisma.fraudLog.update({
        where: {
          id,
        },

        data: {
          status,
        },
      });

    return fraudLog;
  } catch (error) {
    console.error(
      "updateFraudLogStatus error:",
      error
    );

    throw new Error(
      "Failed to update fraud log status"
    );
  }
},
  },
};
