// src/__tests__/auth.test.js
import "dotenv/config";
import request from "supertest";
import express from "express";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

import typeDefs from "../graphql/typeDefs.js";
import { resolvers } from "../graphql/resolvers.js";
import redis from "../config/redis.js";
const { DocumentType, DocumentStatus } = require("@prisma/client"); 

const prisma = new PrismaClient();
let app;
let server;

let adminToken;
let superAdminToken;
let astrologerId;
let documentId;
let interviewId;
let superRoleId;
let adminRoleId;

beforeAll(async () => {
  // Clean DB
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "Address",
      "ExperiencePlatform",
      "Interview",
      "AstrologerDocument",
      "AstrologerRejectionHistory",
      "Astrologer",
      "User",
      "Admin",
      "Role"
    RESTART IDENTITY CASCADE;
  `);
 await prisma.$transaction([
    prisma.admin.deleteMany(),
  ]);
  await prisma.rolePermission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.permission.deleteMany();
  // Express + Apollo
  app = express();
  app.use(express.json());
  server = new ApolloServer({ typeDefs, resolvers });
  await server.start();
  app.use(
    "/graphql",
    expressMiddleware(server, {
      context: async ({ req }) => {
        let user = null;
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith("Bearer ")) {
          try {
            user = jwt.verify(authHeader.replace("Bearer ", ""), process.env.JWT_SECRET);
          } catch {}
        }
        return { user, req };
      },
    })
  );

  // Roles
  const superRole = await prisma.role.create({ data: { name: "SUPER_ADMIN" } });
  const adminRole = await prisma.role.create({ data: { name: "ADMIN" } });
  superRoleId = superRole.id;
  adminRoleId = adminRole.id;

  // Admins
  const superAdmin = await prisma.admin.create({
    data: {
      name: "Super Admin",
      email: "super@test.com",
      password: await bcrypt.hash("superpassword", 10),
      phoneNo: "9999999990",
      role: { connect: { id: superRole.id } },
    },
  });

  const admin = await prisma.admin.create({
    data: {
      name: "Admin User",
      email: "admin@test.com",
      password: await bcrypt.hash("adminpassword", 10),
      phoneNo: "9999999991",
      role: { connect: { id: adminRole.id } },
    },
  });

  superAdminToken = jwt.sign({ id: superAdmin.id, role: "SUPER_ADMIN" }, process.env.JWT_SECRET);
  adminToken = jwt.sign({ id: admin.id, role: "ADMIN" }, process.env.JWT_SECRET);
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
  await server.stop();
});

describe("Admin GraphQL Resolvers - Queries", () => {
  test("getUsersDetails - admin access", async () => {
    const res = await request(app)
      .post("/graphql")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        query: `
          query {
            getUsersDetails(page:1, limit:5) {
              data { id name }
              totalCount
              currentPage
              totalPages
            }
          }
        `,
      });
    expect(res.body.errors).toBeUndefined();
    expect(Array.isArray(res.body.data.getUsersDetails.data)).toBe(true);
  });

  test("getUsersDetails - non admin fails", async () => {
    const res = await request(app)
      .post("/graphql")
      .send({ query: `query { getUsersDetails(page:1, limit:5){ data { id } } }` });
    expect(res.body.errors[0].message).toBe("Admin only");
  });

 it("getUsersListBySearch - should return paginated and filtered users", async () => {
  const timestamp = Date.now();

  // 1️ Create test users
  await Promise.all([
    prisma.user.create({
      data: {
        name: "Test User One",
        mobile: `99999${timestamp}01`,
      },
    }),
    prisma.user.create({
      data: {
        name: "Test User Two",
        mobile: `99999${timestamp}02`,
      },
    }),
    prisma.user.create({
      data: {
        name: "Another Person",
        mobile: `88888${timestamp}03`,
      },
    }),
  ]);

  // 2️ Call Query (Admin required)
  const res = await request(app)
    .post("/graphql")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      query: `
        query {
          getUsersListBySearch(
            searchInput: {
              query: "Test",
              page: 1,
              limit: 2
            }
          ) {
            data {
              id
              name
              mobile
            }
            totalCount
            currentPage
            totalPages
          }
        }
      `,
    });

  expect(res.body.errors).toBeUndefined();

  const response = res.body.data.getUsersListBySearch;

  expect(response.data.length).toBeLessThanOrEqual(2);
  expect(response.currentPage).toBe(1);

  // Should only return users containing "Test"
  response.data.forEach(user => {
    expect(user.name).toContain("Test");
  });

  expect(response.totalCount).toBeGreaterThanOrEqual(2);
});

it("deleteUser - ADMIN can soft delete user", async () => {
  const user = await prisma.user.create({
    data: {
      name: "Delete Me",
      mobile: `77777${Date.now()}`,
    },
  });

  const res = await request(app)
    .post("/graphql")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      query: `
        mutation {
          deleteUser(userId: "${user.id}")
        }
      `,
    });

  expect(res.body.errors).toBeUndefined();
  expect(res.body.data.deleteUser)
    .toBe("User deleted successfully");

  // Verify in DB
  const deletedUser = await prisma.user.findUnique({
    where: { id: user.id },
  });

  expect(deletedUser.isDeleted).toBe(true);
  expect(deletedUser.isActive).toBe(false);
});
it("updateUser - ADMIN can update user", async () => {
  const user = await prisma.user.create({
    data: {
      name: "Old Name",
      mobile: `77777${Date.now()}`,
    },
  });

  const res = await request(app)
    .post("/graphql")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      query: `
        mutation {
          updateUser(
            userId: "${user.id}",
            data: {
              name: "Updated Name",
              occupation: "Engineer"
            }
          ) {
            id
            name
            occupation
          }
        }
      `,
    });

  expect(res.body.errors).toBeUndefined();
  expect(res.body.data.updateUser.name).toBe("Updated Name");
  expect(res.body.data.updateUser.occupation).toBe("Engineer");
});

 it("deleteUser - should fail without admin token", async () => {
  const user = await prisma.user.create({
    data: {
      name: "Normal User",
      mobile: `88888${Date.now()}`,
    },
  });

  const res = await request(app)
    .post("/graphql")
    .send({
      query: `
        mutation {
          deleteUser(userId: "${user.id}")
        }
      `,
    });

  expect(res.body.errors).toBeDefined();
  expect(res.body.errors[0].message).toBe("Admin only");
});

});



describe("Admin GraphQL Resolvers - Mutations", () => {
 test("loginAdmin - success", async () => {
  const res = await request(app)
    .post("/graphql")
    .send({
      query: `
        mutation {
          loginAdmin(email: "admin@test.com", password: "adminpassword") {
            admin {
              id
              name
              email
            }
            accessToken
            refreshToken
          }
        }
      `,
    });

  expect(res.body.errors).toBeUndefined();

  const loginData = res.body.data.loginAdmin;

  expect(loginData).toBeDefined();
  expect(loginData.accessToken).toBeTruthy();
  expect(loginData.refreshToken).toBeTruthy();
  expect(loginData.admin.email).toBe("admin@test.com");
});

test("logoutAdmin - success", async () => {
  // Step 1: Login to get access token
  const loginRes = await request(app)
    .post("/graphql")
    .send({
      query: `
        mutation {
          loginAdmin(email: "admin@test.com", password: "adminpassword") {
            accessToken
          }
        }
      `,
    });

  expect(loginRes.body.errors).toBeUndefined();

  const token = loginRes.body.data.loginAdmin.accessToken;
  expect(token).toBeTruthy();

  // Step 2: Call logout with token
  const res = await request(app)
    .post("/graphql")
    .set("Authorization", `Bearer ${token}`) // IMPORTANT
    .send({
      query: `
        mutation {
          logoutAdmin
        }
      `,
    });

  expect(res.body.errors).toBeUndefined();
  expect(res.body.data.logoutAdmin).toBe(
    "Admin logged out successfully"
  );
});
  test("createPermission - SUPER_ADMIN can create permission", async () => {
  const res = await request(app)
    .post("/graphql")
    .set("Authorization", `Bearer ${superAdminToken}`)
    .send({
      query: `
        mutation {
          createPermission(
            name: "create_reports"
            description: "Can create reports"
          ) {
            id
            name
            description
          }
        }
      `,
    });

  expect(res.body.errors).toBeUndefined();
  expect(res.body.data.createPermission.name).toBe("CREATE_REPORTS");
  expect(res.body.data.createPermission.description).toBe("Can create reports");
});

it("updatePermission - SUPER_ADMIN can update permission", async () => {
  // 1️ Create permission
  const permRes = await request(app)
    .post("/graphql")
    .send({
      query: `
        mutation {
          createPermission(
            name: "UPDATE_PERMISSION_TEST"
            description: "Old description"
          ) {
            id
          }
        }
      `,
    })
    .set("Authorization", `Bearer ${superAdminToken}`);

  const permissionId = permRes.body.data.createPermission.id;

  // 2️ Update permission
  const updateRes = await request(app)
    .post("/graphql")
    .send({
      query: `
        mutation {
          updatePermission(
            permissionId: "${permissionId}"
            name: "UPDATED_PERMISSION_TEST"
            description: "New description"
          ) {
            id
            name
            description
          }
        }
      `,
    })
    .set("Authorization", `Bearer ${superAdminToken}`);

  expect(updateRes.body.errors).toBeUndefined();
  expect(updateRes.body.data.updatePermission.name).toBe("UPDATED_PERMISSION_TEST");
  expect(updateRes.body.data.updatePermission.description).toBe("New description");
});
it("updatePermission - should fail for duplicate name", async () => {
  // Create two permissions
  const perm1 = await request(app)
    .post("/graphql")
    .send({
      query: `
        mutation {
          createPermission(
            name: "DUPLICATE_TEST_ONE"
            description: "Test"
          ) { id }
        }
      `,
    })
    .set("Authorization", `Bearer ${superAdminToken}`);

  const perm2 = await request(app)
    .post("/graphql")
    .send({
      query: `
        mutation {
          createPermission(
            name: "DUPLICATE_TEST_TWO"
            description: "Test"
          ) { id }
        }
      `,
    })
    .set("Authorization", `Bearer ${superAdminToken}`);

  const permissionId = perm2.body.data.createPermission.id;

  // Try renaming second to first
  const res = await request(app)
    .post("/graphql")
    .send({
      query: `
        mutation {
          updatePermission(
            permissionId: "${permissionId}"
            name: "DUPLICATE_TEST_ONE"
          ) {
            id
          }
        }
      `,
    })
    .set("Authorization", `Bearer ${superAdminToken}`);

  expect(res.body.errors).toBeDefined();
  expect(res.body.errors[0].message).toBe("Permission name already exists");
});

it("updatePermission - should fail for non SUPER_ADMIN", async () => {
  const res = await request(app)
    .post("/graphql")
    .send({
      query: `
        mutation {
          updatePermission(
            permissionId: "fake-id"
            name: "FAIL_TEST"
          ) {
            id
          }
        }
      `,
    })
    .set("Authorization", `Bearer ${adminToken}`);

  expect(res.body.errors).toBeDefined();
  expect(res.body.errors[0].message).toBe(
    "Only SUPER_ADMIN can update permissions"
  );
});
it("deletePermission - SUPER_ADMIN can delete permission", async () => {
  const permRes = await request(app)
    .post("/graphql")
    .send({
      query: `
        mutation {
          createPermission(
            name: "DELETE_PERMISSION_TEST"
            description: "To be deleted"
          ) {
            id
          }
        }
      `,
    })
    .set("Authorization", `Bearer ${superAdminToken}`);

  const permissionId = permRes.body.data.createPermission.id;

  const deleteRes = await request(app)
    .post("/graphql")
    .send({
      query: `
        mutation {
          deletePermission(permissionId: "${permissionId}")
        }
      `,
    })
    .set("Authorization", `Bearer ${superAdminToken}`);

  expect(deleteRes.body.errors).toBeUndefined();
  expect(deleteRes.body.data.deletePermission).toBe(
    "Permission deleted successfully"
  );
});


test("createPermission - should fail for non SUPER_ADMIN", async () => {
  const res = await request(app)
    .post("/graphql")
    .set("Authorization", `Bearer ${adminToken}`) 
    .send({
      query: `
        mutation {
          createPermission(name: "DELETE_USER") {
            id
          }
        }
      `,
    });

  expect(res.body.errors).toBeDefined();
  expect(res.body.errors[0].message).toBe(
    "Only SUPER_ADMIN can create permissions"
  );
});

it("deletePermission - should fail if assigned to role", async () => {
  // 1️ Create permission
  const permRes = await request(app)
    .post("/graphql")
    .send({
      query: `
        mutation {
          createPermission(
            name: "ASSIGNED_PERMISSION_TEST"
            description: "Assigned"
          ) {
            id
          }
        }
      `,
    })
    .set("Authorization", `Bearer ${superAdminToken}`);

  const permissionId = permRes.body.data.createPermission.id;

  // 2️ Create role with that permission
  await request(app)
    .post("/graphql")
    .send({
      query: `
        mutation {
          createRole(
            name: "ROLE_WITH_PERMISSION"
            description: "Role"
            permissionIds: ["${permissionId}"]
          ) {
            id
          }
        }
      `,
    })
    .set("Authorization", `Bearer ${superAdminToken}`);

  // 3️ Try deleting permission
  const deleteRes = await request(app)
    .post("/graphql")
    .send({
      query: `
        mutation {
          deletePermission(permissionId: "${permissionId}")
        }
      `,
    })
    .set("Authorization", `Bearer ${superAdminToken}`);

  expect(deleteRes.body.errors).toBeDefined();
  expect(deleteRes.body.errors[0].message).toBe(
    "Cannot delete permission assigned to roles"
  );
});

it("deletePermission - should fail for non SUPER_ADMIN", async () => {
  const res = await request(app)
    .post("/graphql")
    .send({
      query: `
        mutation {
          deletePermission(permissionId: "fake-id")
        }
      `,
    })
    .set("Authorization", `Bearer ${adminToken}`);

  expect(res.body.errors).toBeDefined();
  expect(res.body.errors[0].message).toBe(
    "Only SUPER_ADMIN can delete permissions"
  );
});

it("getPermissions - SUPER_ADMIN access", async () => {
  const res = await request(app)
    .post("/graphql")
    .send({
      query: `
        query {
          getPermissions {
            id
            name
          }
        }
      `,
    })
    .set("Authorization", `Bearer ${superAdminToken}`);

  expect(res.body.errors).toBeUndefined();
  expect(res.body.data.getPermissions).toBeDefined();
  expect(Array.isArray(res.body.data.getPermissions)).toBe(true);
});

it("createRole - SUPER_ADMIN can create role", async () => {
  // 1️ First create a permission (required for role creation)
  const permissionRes = await request(app)
    .post("/graphql")
    .send({
      query: `
        mutation {
          createPermission(
            name: "MANAGE_USERS"
            description: "Can manage users"
          ) {
            id
            name
          }
        }
      `,
    })
    .set("Authorization", `Bearer ${superAdminToken}`);

  expect(permissionRes.body.errors).toBeUndefined();
  const permissionId = permissionRes.body.data.createPermission.id;

  // 2️ Create role with permission
  const res = await request(app)
    .post("/graphql")
    .send({
      query: `
        mutation {
          createRole(
            name: "MANAGER_ROLE"
            description: "Manager Role"
            permissionIds: ["${permissionId}"]
          ) {
            id
            name
            description
            permissions {
              id
              name
            }
          }
        }
      `,
    })
    .set("Authorization", `Bearer ${superAdminToken}`);

  // 3️ Assertions
  expect(res.body.errors).toBeUndefined();

  expect(res.body.data.createRole.name).toBe("MANAGER_ROLE");
  expect(res.body.data.createRole.description).toBe("Manager Role");

  expect(res.body.data.createRole.permissions).toHaveLength(1);
  expect(res.body.data.createRole.permissions[0].name).toBe("MANAGE_USERS");
});




it("createRole - should fail for non SUPER_ADMIN", async () => {
  const res = await request(app)
    .post("/graphql")
    .send({
      query: `
        mutation {
          createRole(
            name: "TEST_ROLE"
            description: "Test Role"
          ) {
            id
            name
          }
        }
      `,
    })
    .set("Authorization", `Bearer ${adminToken}`); // normal admin

  expect(res.body.errors).toBeDefined();
  expect(res.body.errors[0].message).toBe(
    "Only SUPER_ADMIN can create roles"
  );
});

it("updateRole - SUPER_ADMIN can update role", async () => {
  // 1️ Create first permission
  const perm1 = await request(app)
    .post("/graphql")
    .send({
      query: `
        mutation {
          createPermission(
            name: "UPDATE_TEST_PERMISSION"
            description: "Update Test Permission"
          ) {
            id
            name
          }
        }
      `,
    })
    .set("Authorization", `Bearer ${superAdminToken}`);

  const permissionId = perm1.body.data.createPermission.id;

  // 2️ Create role
  const roleRes = await request(app)
    .post("/graphql")
    .send({
      query: `
        mutation {
          createRole(
            name: "UPDATE_TEST_ROLE"
            description: "Old Description"
          ) {
            id
            name
          }
        }
      `,
    })
    .set("Authorization", `Bearer ${superAdminToken}`);

  const roleId = roleRes.body.data.createRole.id;

  // 3️ Update role
  const updateRes = await request(app)
    .post("/graphql")
    .send({
      query: `
        mutation {
          updateRole(
            roleId: "${roleId}"
            name: "UPDATED_ROLE"
            description: "New Description"
            permissionIds: ["${permissionId}"]
          ) {
            id
            name
            description
            permissions {
              id
              name
            }
          }
        }
      `,
    })
    .set("Authorization", `Bearer ${superAdminToken}`);

  expect(updateRes.body.errors).toBeUndefined();
  expect(updateRes.body.data.updateRole.name).toBe("UPDATED_ROLE");
  expect(updateRes.body.data.updateRole.description).toBe("New Description");
  expect(updateRes.body.data.updateRole.permissions).toHaveLength(1);
});

it("updateRole - should fail for non SUPER_ADMIN", async () => {
  const res = await request(app)
    .post("/graphql")
    .send({
      query: `
        mutation {
          updateRole(
            roleId: "fake-id"
            name: "FAIL_ROLE"
          ) {
            id
          }
        }
      `,
    })
    .set("Authorization", `Bearer ${adminToken}`);

  expect(res.body.errors).toBeDefined();
  expect(res.body.errors[0].message).toBe(
    "Only SUPER_ADMIN can update roles"
  );
});

it("updateRole - should fail for invalid permission ID", async () => {
  // Create role first
  const roleRes = await request(app)
    .post("/graphql")
    .send({
      query: `
        mutation {
          createRole(
            name: "INVALID_PERMISSION_ROLE"
            description: "Test"
          ) {
            id
          }
        }
      `,
    })
    .set("Authorization", `Bearer ${superAdminToken}`);

  const roleId = roleRes.body.data.createRole.id;

  // Try updating with invalid permission ID
  const res = await request(app)
    .post("/graphql")
    .send({
      query: `
        mutation {
          updateRole(
            roleId: "${roleId}"
            permissionIds: ["invalid-id-123"]
          ) {
            id
          }
        }
      `,
    })
    .set("Authorization", `Bearer ${superAdminToken}`);

  expect(res.body.errors).toBeDefined();
  expect(res.body.errors[0].message).toBe(
    "One or more permission IDs are invalid"
  );
});

it("deleteRole - SUPER_ADMIN can delete role", async () => {
  // 1️ Create role
  const roleRes = await request(app)
    .post("/graphql")
    .send({
      query: `
        mutation {
          createRole(
            name: "DELETE_TEST_ROLE"
            description: "To be deleted"
          ) {
            id
          }
        }
      `,
    })
    .set("Authorization", `Bearer ${superAdminToken}`);

  const roleId = roleRes.body.data.createRole.id;

  // 2️ Delete role
  const deleteRes = await request(app)
    .post("/graphql")
    .send({
      query: `
        mutation {
          deleteRole(roleId: "${roleId}")
        }
      `,
    })
    .set("Authorization", `Bearer ${superAdminToken}`);

  expect(deleteRes.body.errors).toBeUndefined();
  expect(deleteRes.body.data.deleteRole).toBe(
    "Role deleted successfully"
  );
});

it("deleteRole - should fail for non SUPER_ADMIN", async () => {
  const res = await request(app)
    .post("/graphql")
    .send({
      query: `
        mutation {
          deleteRole(roleId: "fake-id")
        }
      `,
    })
    .set("Authorization", `Bearer ${adminToken}`);

  expect(res.body.errors).toBeDefined();
  expect(res.body.errors[0].message).toBe(
    "Only SUPER_ADMIN can delete roles"
  );
});

it("deleteRole - should fail if role assigned to admin", async () => {
  // 1️ Create role
  const roleRes = await request(app)
    .post("/graphql")
    .send({
      query: `
        mutation {
          createRole(
            name: "ASSIGNED_ROLE"
            description: "Assigned Role"
          ) {
            id
          }
        }
      `,
    })
    .set("Authorization", `Bearer ${superAdminToken}`);

  const roleId = roleRes.body.data.createRole.id;

  // 2️ Create admin WITH ROLE
const adminRes = await request(app)
  .post("/graphql")
  .send({
    query: `
      mutation {
        createAdmin(
          name: "Assigned Admin"
          email: "assignedadmin${Date.now()}@test.com"
          phoneNo: "9876543210"
          password: "password123"
          roleId: "${roleId}"
        ) {
          id
          role {
            id
          }
        }
      }
    `,
  })
  .set("Authorization", `Bearer ${superAdminToken}`);


  expect(adminRes.body.errors).toBeUndefined();
  expect(adminRes.body.data.createAdmin.role.id).toBe(roleId);

  // 3️ Attempt delete
  const deleteRes = await request(app)
    .post("/graphql")
    .send({
      query: `
        mutation {
          deleteRole(roleId: "${roleId}")
        }
      `,
    })
    .set("Authorization", `Bearer ${superAdminToken}`);

  expect(deleteRes.body.errors).toBeDefined();
  expect(deleteRes.body.errors[0].message).toBe(
    "Cannot delete role assigned to admins"
  );
});

it("getRoles - SUPER_ADMIN can fetch roles", async () => {
  const res = await request(app)
    .post("/graphql")
    .send({
      query: `
        query {
          getRoles {
            id
            name
            description
            permissions {
              id
              name
            }
          }
        }
      `,
    })
    .set("Authorization", `Bearer ${superAdminToken}`);

  expect(res.body.errors).toBeUndefined();
  expect(Array.isArray(res.body.data.getRoles)).toBe(true);
});
it("getRoles - should fail for non SUPER_ADMIN", async () => {
  const res = await request(app)
    .post("/graphql")
    .send({
      query: `
        query {
          getRoles {
            id
            name
          }
        }
      `,
    })
    .set("Authorization", `Bearer ${adminToken}`);

  expect(res.body.errors).toBeDefined();
  expect(res.body.errors[0].message).toBe(
    "Only SUPER_ADMIN can view roles"
  );
});

it("assignPermissionsToRole - SUPER_ADMIN can assign permissions to a role", async () => {
  // 1️⃣ Create a permission
  const permission = await prisma.permission.create({
    data: {
      name: "TEST_PERMISSION",
      description: "Permission for testing",
    },
  });

  // 2️⃣ Create a role
  const role = await prisma.role.create({
    data: {
      name: "TEST_ROLE",
      description: "Role for testing",
    },
  });

  // 3️⃣ Call the mutation
  const res = await request(app)
    .post("/graphql")
    .set("Authorization", `Bearer ${superAdminToken}`)
    .send({
      query: `
        mutation {
          assignPermissionsToRole(
            roleId: "${role.id}",
            permissionIds: ["${permission.id}"]
          ) {
            id
            name
            description
            permissions {
              id
              name
            }
          }
        }
      `,
    });

  // 4️⃣ Assertions
  expect(res.body.errors).toBeUndefined();
  expect(res.body.data.assignPermissionsToRole.id).toBe(role.id);
  expect(res.body.data.assignPermissionsToRole.permissions).toHaveLength(1);
  expect(res.body.data.assignPermissionsToRole.permissions[0].id).toBe(permission.id);
  expect(res.body.data.assignPermissionsToRole.permissions[0].name).toBe("TEST_PERMISSION");
});

it("assignPermissionsToRole - should fail if non SUPER_ADMIN tries", async () => {
  const res = await request(app)
    .post("/graphql")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      query: `
        mutation {
          assignPermissionsToRole(
            roleId: "fake-role-id",
            permissionIds: ["fake-permission-id"]
          ) {
            id
            name
          }
        }
      `,
    });

  expect(res.body.errors).toBeDefined();
  expect(res.body.errors[0].message).toBe("Only SUPER_ADMIN can assign permissions");
});

it("assignPermissionsToRole - should fail if role not found", async () => {
  const res = await request(app)
    .post("/graphql")
    .set("Authorization", `Bearer ${superAdminToken}`)
    .send({
      query: `
        mutation {
          assignPermissionsToRole(
            roleId: "nonexistent-role-id",
            permissionIds: ["nonexistent-permission-id"]
          ) {
            id
            name
          }
        }
      `,
    });

  expect(res.body.errors).toBeDefined();
  expect(res.body.errors[0].message).toBe("Role not found");
});

it("assignPermissionsToRole - should fail if permission IDs invalid", async () => {
  const roleName = `TEST_ROLE_${Date.now()}`; // unique per test
  const role = await prisma.role.create({
    data: { name: roleName, description: "Role for testing" },
  });

  const fakePermissionIds = ["invalid-id-1", "invalid-id-2"];

  const res = await request(app)
    .post("/graphql")
    .send({
      query: `
        mutation {
          assignPermissionsToRole(roleId: "${role.id}", permissionIds: ["${fakePermissionIds.join('","')}"]) {
            id
            name
            permissions { id name }
          }
        }
      `,
    })
    .set("Authorization", `Bearer ${superAdminToken}`);

  // Expect an error
  expect(res.body.errors).toBeDefined();
  expect(res.body.errors[0].message).toBe("One or more permission IDs are invalid");
});



  test("createAdmin - only SUPER_ADMIN can create", async () => {
  const res = await request(app)
    .post("/graphql")
    .set("Authorization", `Bearer ${superAdminToken}`)
    .send({
      query: `
        mutation {
          createAdmin(
            name:"New Admin"
            email:"newadmin@test.com"
            phoneNo:"9999999992"
            password:"newadminpassword"
            roleId:"${adminRoleId}"
          ) {
            id
            name
            email
          }
        }
      `,
    });

  expect(res.body.errors).toBeUndefined();
  expect(res.body.data.createAdmin.name).toBe("New Admin");
});

it("updateAdmin - SUPER_ADMIN success", async () => {
  const adminRole = await prisma.role.findFirst({
    where: { name: "ADMIN" },
  });

  const admin = await prisma.admin.create({
    data: {
      name: "Old Name",
      email: "oldadmin@test.com",
      password: "hashedpassword",
      roleId: adminRole.id,
      phoneNo: "9998887777",
    },
  });

  const res = await request(app)
    .post("/graphql")
    .send({
      query: `
        mutation {
          updateAdmin(
            adminId: "${admin.id}"
            name: "Updated Name"
          ) {
            id
            name
          }
        }
      `,
    })
    .set("Authorization", `Bearer ${superAdminToken}`);

  expect(res.body.errors).toBeUndefined();
  expect(res.body.data.updateAdmin.name).toBe("Updated Name");
});

it("deleteAdmin - SUPER_ADMIN can delete admin", async () => {
  // 1️ Get an existing ADMIN role ID
  const adminRole = await prisma.role.findUnique({
    where: { name: "ADMIN" }, // make sure your schema has a role named 'ADMIN'
  });

  if (!adminRole) {
    throw new Error("ADMIN role not found. Please create it first.");
  }

  //  Create a temporary admin
  const admin = await prisma.admin.create({
    data: {
      name: "Temp Admin",
      email: "tempadmin@test.com",
      phoneNo: "9999999999",
      password: "hashedpassword",
      roleId: adminRole.id,
    },
  });

  // Attempt delete as SUPER_ADMIN
  const res = await request(app)
    .post("/graphql")
    .set("Authorization", `Bearer ${superAdminToken}`)
    .send({
      query: `
        mutation {
          deleteAdmin(adminId: "${admin.id}")
        }
      `,
    });

  expect(res.body.errors).toBeUndefined();
  expect(res.body.data.deleteAdmin).toBe("Admin deleted successfully");

  // Verify admin is deleted from DB
  const deletedAdmin = await prisma.admin.findUnique({
    where: { id: admin.id },
  });
  expect(deletedAdmin).toBeNull();
});






test("getAdmins - SUPER_ADMIN access", async () => {
  for (let i = 0; i < 5; i++) {
    await prisma.admin.create({
      data: {
        name: `Admin ${i}`,
        email: `admin_unique_${i}@test.com`,
        phoneNo: `88888888${i}${i}`, // unique
        password: "hashedpassword",
        role: {
          connect: { id: adminRoleId },
        },
      },
    });
  }

  const res = await resolvers.Query.getAdmins(
    {},
    { page: 1, limit: 10 },
    { user: { role: "SUPER_ADMIN" } }
  );
  expect(res.data.length).toBeGreaterThan(0);
  expect(res.totalCount).toBeGreaterThan(0);
  expect(res.currentPage).toBe(1);
});


 test("addAstrologer - authorized roles", async () => {
  const res = await request(app)
    .post("/graphql")
    .set("Authorization", `Bearer ${superAdminToken}`)
    .send({
      query: `
        mutation {
          addAstrologer(
            name:"Astro Test"
            email:"astro@test.com"
            contactNo:"9999999993"
            gender:MALE
            dateOfBirth:"1990-01-01"
            languages:["English"]
            skills:["Vedic"]
            experience:5
            about:"Test astrologer"
          ) {
            id
            name
            email
          }
        }
      `,
    });

  expect(res.body.errors).toBeUndefined();
  astrologerId = res.body.data.addAstrologer.id;
});
it("updateAstrologer - SUPER_ADMIN or MANAGER can update astrologer", async () => {
  // 1️ Create an astrologer to update
  const astrologer = await prisma.astrologer.create({
    data: {
      name: "Old Name",
      email: "oldastro@test.com",
      contactNo: "9999999999",
      dateOfBirth: new Date("1990-01-01"), // <-- fix here
      gender: "MALE",
      languages: ["English"],
      skills: ["Vedic Astrology"],
      experience: 5,
      about: "Old about info",
      profilePic: "https://dummyimage.com/100x100",
    },
  });

  // 2️ Update astrologer
  const res = await request(app)
    .post("/graphql")
    .set("Authorization", `Bearer ${superAdminToken}`)
    .send({
      query: `
        mutation {
          updateAstrologer(
            astrologerId: "${astrologer.id}"
            data: {
              name: "New Name"
              experience: 10
              about: "Updated info"
            }
          ) {
            id
            name
            experience
            about
          }
        }
      `,
    });

  expect(res.body.errors).toBeUndefined();
  expect(res.body.data.updateAstrologer.name).toBe("New Name");
  expect(res.body.data.updateAstrologer.experience).toBe(10);
  expect(res.body.data.updateAstrologer.about).toBe("Updated info");
});

it("deleteAstrologer - SUPER_ADMIN or MANAGER can delete astrologer", async () => {
  //  Create an astrologer to delete
  const astrologer = await prisma.astrologer.create({
    data: {
      name: "Delete Me",
      email: "deleteastro@test.com",
      contactNo: "8888888888",
      dateOfBirth: new Date("1990-01-01"),
      gender: "FEMALE",
      languages: ["English"],
      skills: ["Vedic Astrology"],
      experience: 3,
      about: "To be deleted",
      profilePic: "https://dummyimage.com/100x100",
    },
  });

  //  Call deleteAstrologer mutation
  const res = await request(app)
    .post("/graphql")
    .set("Authorization", `Bearer ${superAdminToken}`)
    .send({
      query: `
        mutation {
          deleteAstrologer(astrologerId: "${astrologer.id}")
        }
      `,
    });

  //  Assertions
  expect(res.body.errors).toBeUndefined();
  expect(res.body.data.deleteAstrologer).toBe(true);

  //  Verify astrologer is removed from DB
  const deletedAstrologer = await prisma.astrologer.findUnique({
    where: { id: astrologer.id },
  });
  expect(deletedAstrologer).toBeNull();
});

it("getAstrologerListBySearch - should return astrologers sorted and filtered correctly", async () => {
  // 1️⃣ Create multiple astrologers for testing
  const astrologers = await Promise.all([
    prisma.astrologer.create({
      data: {
        name: "Astro One",
        email: `astro1_${Date.now()}@test.com`,
        contactNo: "1111111111",
        dateOfBirth: new Date("1980-01-01"),
        gender: "MALE",
        languages: ["English"],
        skills: ["Vedic Astrology"],
        experience: 10,
        about: "Experienced astrologer",
        profilePic: "https://dummyimage.com/100x100",
      },
    }),
    prisma.astrologer.create({
      data: {
        name: "Astro Two",
        email: `astro2_${Date.now()}@test.com`,
        contactNo: "2222222222",
        dateOfBirth: new Date("1990-01-01"),
        gender: "FEMALE",
        languages: ["Hindi"],
        skills: ["Palmistry"],
        experience: 5,
        about: "Moderate experience",
        profilePic: "https://dummyimage.com/100x100",
      },
    }),
    prisma.astrologer.create({
      data: {
        name: "Astro Three",
        email: `astro3_${Date.now()}@test.com`,
        contactNo: "3333333333",
        dateOfBirth: new Date("1995-01-01"),
        gender: "MALE",
        languages: ["English", "Hindi"],
        skills: ["Vedic Astrology", "Numerology"],
        experience: 2,
        about: "Junior astrologer",
        profilePic: "https://dummyimage.com/100x100",
      },
    }),
  ]);

  // 2️⃣ Call getAstrologerListBySearch query
const res = await request(app)
  .post("/graphql")
  .set("Authorization", `Bearer ${adminToken}`) 
  .send({
    query: `
      query {
        getAstrologerListBySearch(
          searchInput: {
            query: "Astro",
            sortField: EXPERIENCE,
            sortOrder: DESC,
            page: 1,
            limit: 10
          }
        ) {
          data {
            id
            name
            experience
          }
          totalCount
          currentPage
          totalPages
        }
      }
    `,
  });

expect(res.body.errors).toBeUndefined();

const list = res.body.data.getAstrologerListBySearch.data;

expect(list.length).toBeGreaterThan(0);

for (let i = 1; i < list.length; i++) {
  expect(list[i - 1].experience)
    .toBeGreaterThanOrEqual(list[i].experience);
}
  // Optional: check specific astrologers exist
  const astroNames = list.map(a => a.name);
  expect(astroNames).toContain("Astro One");
  expect(astroNames).toContain("Astro Two");
  expect(astroNames).toContain("Astro Three");
});



  test("approveAstrologer - admin only", async () => {
    const res = await request(app)
      .post("/graphql")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ query: `mutation { approveAstrologer(astrologerId:"${astrologerId}") }` });
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.approveAstrologer).toBe(true);
  });

  test("rejectAstrologer - admin only", async () => {
    const res = await request(app)
      .post("/graphql")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        query: `mutation { rejectAstrologer(astrologerId:"${astrologerId}", stage:"INTERVIEW", reason:"Not qualified") }`,
      });
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.rejectAstrologer).toBe(true);
  });

// test("verifyDocument - admin only", async () => {
//   const doc = await prisma.astrologerDocument.create({
//     data: {
//       astrologerId,                
//       documentType: DocumentType.ID,      
//       status: DocumentStatus.PENDING,    
//       documentUrl: "https://example.com/dummy.pdf",
//     },
//   });

//   documentId = doc.id; // save for mutation

//   const res = await request(app)
//     .post("/graphql")
//     .set("Authorization", `Bearer ${adminToken}`)
//     .send({
//       query: `
//         mutation {
//           verifyDocument(
//             documentId: "${doc.id}",
//             status: APPROVED,
//             remarks: "Verified"
//           ) {
//             id
//             status
//             remarks
//           }
//         }
//       `,
//     });

//   expect(res.body.errors).toBeUndefined();
//   expect(res.body.data.verifyDocument.status).toBe("APPROVED");
//   expect(res.body.data.verifyDocument.remarks).toBe("Verified");
// });

  test("scheduleInterview - admin only", async () => {
    const res = await request(app)
      .post("/graphql")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        query: `mutation { scheduleInterview(astrologerId:"${astrologerId}", roundNumber:1, interviewerName:"Admin User", scheduledAt:"2026-02-21T10:00:00.000Z") { id roundNumber interviewerName } }`,
      });

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.scheduleInterview.roundNumber).toBe(1);
    interviewId = res.body.data.scheduleInterview.id;
  });

 test("getRegisteredAstrologers - admin access", async () => {
  await prisma.astrologer.create({
  data: {
    profilePic: "https://example.com/profile1.jpg",
    name: "Astro One",
    email: "astro1@test.com",
    contactNo: "9999999901",
    gender: "MALE",
    dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
    languages: ["English"],
    skills: ["Vedic"],
    experience: 5,
    about: "Test astrologer 1",
    approvalStatus: "APPROVED",

    addresses: {
      create: [
        {
          street: "Street 1",
          city: "City 1",
          state: "Uttar Pradesh",
          country: "India",
          pincode: "226001"
        }
      ]
    },

    experiences: {
      create: [
        {
          platformName: "Platform 1",
          yearsWorked: 3   // ✅ MUST MATCH SCHEMA
        }
      ]
    }
  }
});


  const res = await request(app)
    .post("/graphql")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      query: `
        query {
          getRegisteredAstrologers(page:1, limit:10) {
            id
            name
            profilePic
          }
        }
      `,
    });

  expect(res.body.errors).toBeUndefined();
  expect(res.body.data.getRegisteredAstrologers.length).toBeGreaterThan(0);
});

test("getApprovedAstrologers - admin access", async () => {
  // Create approved astrologer
  await prisma.astrologer.create({
    data: {
      profilePic: "https://example.com/profile1.jpg",
      name: "Approved Astro",
      email: "approved@test.com",
      contactNo: "9999999901",
      gender: "MALE",
      dateOfBirth: new Date("1990-01-01"),
      languages: ["English"],
      skills: ["Vedic"],
      experience: 5,
      about: "Approved astrologer",
      approvalStatus: "APPROVED",

      addresses: {
        create: [
          {
            street: "Street 1",
            city: "City 1",
            state: "UP",
            country: "India",
            pincode: "226001",
          },
        ],
      },

      experiences: {
        create: [
          {
            platformName: "Platform 1",
            yearsWorked: 3,
          },
        ],
      },
    },
  });

  const res = await resolvers.Query.getApprovedAstrologers(
    {},
    { page: 1, limit: 10 },
    { user: { role: "ADMIN" } }
  );

  expect(res.data.length).toBeGreaterThan(0);
  expect(res.totalCount).toBeGreaterThan(0);
  expect(res.currentPage).toBe(1);
  expect(res.totalPages).toBeGreaterThan(0);
});

test("getApprovedAstrologers - non admin fails", async () => {
  await expect(
    resolvers.Query.getApprovedAstrologers(
      {},
      { page: 1, limit: 10 },
      { user: { role: "SUPER_ADMIN" } }
    )
  ).rejects.toThrow("Admin only");
});

test("getApprovedAstrologers - no user fails", async () => {
  await expect(
    resolvers.Query.getApprovedAstrologers(
      {},
      { page: 1, limit: 10 },
      {}
    )
  ).rejects.toThrow("Admin only");
});

 test("getPendingAstrologers - admin access", async () => {
    const res = await request(app)
      .post("/graphql")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ query: `query { getPendingAstrologers { data { id name } totalCount } }` });
    expect(res.body.errors).toBeUndefined();
  });

  

});
