import dotenv from "dotenv";
dotenv.config();

import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";

import path from "path";
import { fileURLToPath } from "url";

import notificationRoutes from "./routes/notificationRoutes.js";
import authRoutes from "./routes/authRoutes.js";

const app = Fastify({ logger: true });

//  Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//  Register plugins
await app.register(cors);

await app.register(jwt, {
  secret: process.env.JWT_SECRET,
});

await app.register(cookie, {
  secret: "supersecretcookie",
});

//  Serve frontend (IMPORTANT)
await app.register(fastifyStatic, {
  root: path.join(__dirname, "../public"),
  prefix: "/", // serve at root
});

//  Auth middleware
app.decorate("authenticate", async function (request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ message: "Unauthorized" });
  }
});

//  Health route
app.get("/health", async () => {
  return { status: "OK" };
});

//  Root route → load frontend
app.get("/", async (request, reply) => {
  return reply.sendFile("index.html");
});

//  Routes
await app.register(authRoutes, {
  prefix: "/api/v1/auth",
});

await app.register(notificationRoutes, {
  prefix: "/api/v1/notifications",
});

export default app;
