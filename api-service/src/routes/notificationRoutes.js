import prisma from "../config/prisma.js";
import notificationQueue from "../services/queueService.js";
import connection from "../config/redis.js";
import rateLimiter from "../middleware/rateLimiter.js";

export default async function (app, opts) {

  // CREATE NOTIFICATION
  app.post(
    "/",
    {
      schema: {
        body: {
          type: "object",
          required: ["type", "payload"],
          properties: {
            type: {
              type: "string",
              enum: ["EMAIL", "SMS", "PUSH"],
            },
            payload: {
              type: "object",
            },
          },
        },
        headers: {
          type: "object",
          required: ["idempotency-key"],
          properties: {
            "idempotency-key": { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
              notificationId: { type: "string" },
              status: { type: "string" },
            },
          },
        },
      },
      preHandler: [app.authenticate, rateLimiter],
    },
    async (request, reply) => {

      const { type, payload } = request.body;

      const idempotencyKey = request.headers["idempotency-key"];
      const redisKey = `idempotency:${request.user.id}:${idempotencyKey}`;

      try {
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

        const notification = await prisma.notification.create({
          data: {
            userId: user.id,
            type,
            payload,
            status: "QUEUED",
          },
        });

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
        await connection.del(redisKey);

        return reply.code(500).send({
          message: "Internal Server Error",
        });
      }
    }
  );


  // GET NOTIFICATION
  app.get(
    "/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              status: { type: "string" },
              type: { type: "string" },
              attempts: { type: "number" },
            },
          },
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {

      const { id } = request.params;

      const notification = await prisma.notification.findUnique({
        where: { id },
      });

      if (!notification) {
        return reply.code(404).send({
          message: "Notification not found",
        });
      }

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
    }
  );
}
