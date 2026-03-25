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

// Redis logs
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

    console.log(" Processing:", notificationId);
    console.log(" Raw DB payload:", notification.payload);

    // Update → PROCESSING
    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: "PROCESSING" },
    });

    try {
      switch (notification.type) {
        case "EMAIL": {
          console.log(" Preparing email...");

          //  NORMALIZE PAYLOAD (handles both formats)
          const emailPayload = {
            to:
              notification.payload.email ||
              notification.payload.to ||
              null,
            subject: notification.payload.subject || "No Subject",
            text:
              notification.payload.message ||
              notification.payload.text ||
              null,
          };

          console.log(
            " FINAL EMAIL PAYLOAD:",
            JSON.stringify(emailPayload, null, 2)
          );

          //  Safety check (prevents SES crash)
          if (!emailPayload.to || !emailPayload.text) {
            throw new Error(
              "Invalid email payload (missing to/text)"
            );
          }

          await sendEmail(emailPayload);
          break;
        }

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
  console.log(" Worker ready");
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
