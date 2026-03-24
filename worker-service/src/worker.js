import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { PrismaClient } from "@prisma/client";

import { sendEmail } from "./providers/emailProvider.js";
import { sendSMS } from "./providers/smsProvider.js";
import { sendPush } from "./providers/pushProvider.js";

const prisma = new PrismaClient();

const connection = new Redis({
  host: "127.0.0.1",
  port: 6379,
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  "notification-queue",
  async (job) => {
    const { notificationId } = job.data;

    console.log("Processing:", notificationId);

    // Get notification from DB
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new Error("Notification not found");
    }

    // Update status → PROCESSING
    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: "PROCESSING" },
    });

    try {
      // CORE LOGIC
      switch (notification.type) {
        case "EMAIL":
          await sendEmail(notification.payload);
          break;

        case "SMS":
          await sendSMS(notification.payload);
          break;

        case "PUSH":
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

      console.log("Sent:", notificationId);

    } catch (error) {
      console.log("Error:", error.message);

      //  Failure
      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: "FAILED",
          attempts: { increment: 1 },
        },
      });

      throw error; // triggers retry
    }
  },
  { connection }
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job) => {
  console.log(`Job ${job.id} failed after retries`);
});