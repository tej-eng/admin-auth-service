// src/server.js
import "dotenv/config"; // loads .env automatically
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";

import typeDefs from "./graphql/typeDefs.js";
import { resolvers } from "./graphql/resolvers.js";
import auth from "./middleware/auth.js";
import rateLimiter from "./middleware/rateLimiter.js";
import { verifyAccessToken } from "./config/jwt.js";

async function startServer() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());
  app.use(rateLimiter);

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

        if (authHeader?.startsWith("Bearer ")) {
          const token = authHeader.replace("Bearer ", "");
          try {
            user = verifyAccessToken(token);
          } catch (err) {
            user = null;
          }
        }

        // fallback to auth middleware if needed
        if (!user) user = auth(req);

        return { req, res, user };
      },
    })
  );

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/graphql`);
  });
}

startServer();
