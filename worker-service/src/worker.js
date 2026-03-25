import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { PrismaClient } from "@prisma/client";

import { sendEmail } from "./providers/emailProvider.js";
import { sendSMS } from "./providers/smsProvider.js";
import { sendPush } from "./providers/pushProvider.js";

const prisma = new PrismaClient();

// Redis connection
const connection = new Redis({
  host: "127.0.0.1",
  port: 6379,
  maxRetriesPerRequest: null,
});

// Debug Redis
connection.on("connect", () => {
  console.log(" Connected to Redis");
});

connection.on("error", (err) => {
  console.error(" Redis error:", err);
});

console.log(" Worker starting...");

const worker = new Worker(
  "notification-queue",
  async (job) => {
    console.log(" Job received:", job.id, job.data);

    const { notificationId } = job.data;

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new Error("Notification not found");
    }

    console.log("Processing:", notificationId);

    // Update → PROCESSING
    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: "PROCESSING" },
    });

    try {
      switch (notification.type) {
        case "EMAIL":
          console.log(" Sending email...");

          //   map payload correctly
          await sendEmail({
            to: notification.payload.email,
            subject: notification.payload.subject,
            text: notification.payload.message,
          });

          break;

        case "SMS":
          console.log(" Sending SMS...");
          await sendSMS(notification.payload);
          break;

        case "PUSH":
          console.log(" Sending Push...");
          await sendPush(notification.payload);
          break;

        default:
          throw new Error("Invalid notification type");
      }

      // Success
      await prisma.notification.update({
        where: { id: notificationId },
        data: { status: "SENT" },
      });

      console.log(" Sent:", notificationId);

    } catch (error) {
      console.error(" Error:", error.message);

      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: "FAILED",
          attempts: { increment: 1 },
        },
      });

      throw error;
    }
  },
  { connection }
);

// Worker lifecycle logs
worker.on("ready", () => {
  console.log(" Worker is ready and waiting for jobs...");
});

worker.on("active", (job) => {
  console.log(` Job ${job.id} started`);
});

worker.on("completed", (job) => {
  console.log(` Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.log(` Job ${job.id} failed: ${err.message}`);
});

worker.on("error", (err) => {
  console.error(" Worker error:", err);
});
