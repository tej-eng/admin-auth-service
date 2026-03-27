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

app.use(
  cors({
    origin: true, // 🔥 allow all origins (for dev)
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.options("*", cors());
  app.use(express.json());
  app.use(cookieParser());
  app.use(rateLimiter);

  // ✅ static folder
  app.use("/uploads", express.static("uploads"));

  // ✅ REST upload
  app.use("/api", uploadRoutes);

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [ApolloServerPluginLandingPageLocalDefault()],
  });

  await server.start();

  // 🔥 MUST be before /graphql

  app.use(
    "/graphql",
    expressMiddleware(server, {
      context: async ({ req, res }) => {
        let user = null;

        const authHeader = req.headers["authorization"];

        if (authHeader?.startsWith("Bearer ")) {
          const token = authHeader.replace("Bearer ", "");

          try {
            const decoded = verifyAccessToken(token);

            if (decoded?.type === "staff") {
              user = await prisma.staff.findUnique({
                where: { id: decoded.id },
                include: { role: true },
              });
            }
          } catch (err) {
            user = null;
          }
        }

        return { req, res, user, prisma };
      },
    })
  );

  const PORT = process.env.PORT || 4001;

  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}/graphql`);
  });
}

startServer();