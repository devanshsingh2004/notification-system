import prisma from "../config/prisma.js";
import notificationQueue from "../services/queueService.js";
import connection from "../config/redis.js";
import rateLimiter from "../middleware/rateLimiter.js";

export default async function (app, opts) {

  // CREATE NOTIFICATION (POST)
  app.post(
    "/",
    {
      preHandler: [app.authenticate, rateLimiter],
    },
    async (request, reply) => {
      const { type, payload } = request.body;

      //  Basic validation
      if (!type || !payload) {
        return reply.code(400).send({
          message: "type and payload are required",
        });
      }

      //  Allowed types
      const allowedTypes = ["EMAIL", "SMS", "PUSH"];
      if (!allowedTypes.includes(type)) {
        return reply.code(400).send({
          message: "Invalid notification type",
        });
      }

      const idempotencyKey = request.headers["idempotency-key"];

      if (!idempotencyKey) {
        return reply.code(400).send({
          message: "Idempotency key required",
        });
      }

      //  Scoped idempotency key (user-specific)
      const redisKey = `idempotency:${request.user.id}:${idempotencyKey}`;

      try {
        //  Atomic set (prevents duplicates)
        const isSet = await connection.set(
          redisKey,
          "processing",
          "NX",
          "EX",
          300
        );

        if (!isSet) {
          return reply.code(409).send({
            message: "Duplicate request detected",
          });
        }

        //  Ensure user exists
        let user = await prisma.user.findUnique({
          where: { id: request.user.id },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              id: request.user.id,
              email: request.user.email,
            },
          });
        }

        //  Save notification
        const notification = await prisma.notification.create({
          data: {
            userId: user.id,
            type,
            payload,
            status: "QUEUED",
          },
        });

        //  Push job to queue
        await notificationQueue.add(
          "send-notification",
          {
            notificationId: notification.id,
          },
          {
            attempts: 3,
            backoff: {
              type: "exponential",
              delay: 2000,
            },
            removeOnComplete: true,
            removeOnFail: false,
          }
        );

        return {
          message: "Notification queued",
          notificationId: notification.id,
          status: "QUEUED",
        };

      } catch (error) {
        // release idempotency key on failure
        await connection.del(redisKey);

        console.error("Error creating notification:", error);

        return reply.code(500).send({
          message: "Internal Server Error",
        });
      }
    }
  );

  // GET NOTIFICATION STATUS
  app.get(
    "/:id",
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params;

      try {
        const notification = await prisma.notification.findUnique({
          where: { id },
        });

        if (!notification) {
          return reply.code(404).send({
            message: "Notification not found",
          });
        }

        // Ensure user owns this notification
        if (notification.userId !== request.user.id) {
          return reply.code(403).send({
            message: "Forbidden",
          });
        }

        return {
          id: notification.id,
          status: notification.status,
          type: notification.type,
          attempts: notification.attempts,
        };

      } catch (error) {
        console.error("Error fetching notification:", error);

        return reply.code(500).send({
          message: "Internal Server Error",
        });
      }
    }
  );
}