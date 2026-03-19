// src/server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";

import { PrismaClient } from "@prisma/client";
import typeDefs from "./graphql/typeDefs.js";
import { resolvers } from "./graphql/resolvers.js";
import rateLimiter from "./middleware/rateLimiter.js";
import { verifyAccessToken } from "./config/jwt.js";
import uploadRoutes from "./routes/upload.js";

const prisma = new PrismaClient();

async function startServer() {
  const app = express();

  // ✅ CORS
  app.use(
    cors({
      origin: "http://localhost:3001",
      credentials: true,
    }),
  );

  app.use(express.json());
  app.use(cookieParser());
  app.use(rateLimiter);

  app.use("/uploads", express.static("uploads"));
  app.use("/api", uploadRoutes);

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [ApolloServerPluginLandingPageLocalDefault()],
  });

  await server.start();

  app.use(
    "/graphql",
    expressMiddleware(server, {
      context: async ({ req, res }) => {
        let user = null;

        const authHeader = req.headers["authorization"];

        console.log("HEADERS:", req.headers); // 🔥 debug
        console.log("AUTH HEADER:", req.headers.authorization);
        if (authHeader?.startsWith("Bearer ")) {
          const token = authHeader.replace("Bearer ", "");

          try {
            const decoded = verifyAccessToken(token);

            console.log("DECODED TOKEN:", decoded);

            if (decoded?.type === "staff") {
              user = await prisma.staff.findUnique({
                where: { id: decoded.id },
                include: { role: true },
              });
            }

            console.log("CONTEXT USER:", user);
          } catch (err) {
            console.log("JWT ERROR:", err.message);
            user = null;
          }
        } else {
          console.log("No Authorization Header");
        }

        return { req, res, user };
      },
    }),
  );

  const PORT = process.env.PORT || 4001;

  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}/graphql`);
  });
}

startServer();
