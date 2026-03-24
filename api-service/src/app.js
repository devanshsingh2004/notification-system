import dotenv from "dotenv";
dotenv.config();

import notificationRoutes from "./routes/notificationRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";

const app = Fastify({ logger: true });

// Register plugins
await app.register(cors);

await app.register(jwt, {
  secret: process.env.JWT_SECRET,
});

await app.register(cookie, {
  secret: "supersecretcookie",
});

// Auth middleware
app.decorate("authenticate", async function (request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ message: "Unauthorized" });
  }
});

// Health route
app.get("/health", async () => {
  return { status: "OK" };
});

// Register auth routes 
await app.register(authRoutes, {
  prefix: "/api/v1/auth",
});

// Register notification routes
await app.register(notificationRoutes, {
  prefix: "/api/v1/notifications",
});

export default app;