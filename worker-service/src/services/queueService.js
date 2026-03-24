import { Queue } from "bullmq";
import connection from "../config/redis.js";

const notificationQueue = new Queue("notification-queue", {
  connection,
});

export default notificationQueue;