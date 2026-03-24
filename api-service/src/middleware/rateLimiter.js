import connection from "../config/redis.js";

export default async function rateLimiter(request, reply) {
  const userId = request.user.id;

  const key = `rate-limit:${userId}`;

  const count = await connection.incr(key);

  if (count === 1) {
    await connection.expire(key, 60); // 60 sec window
  }

  if (count > 10) {
    return reply.code(429).send({
      message: "Too many requests",
    });
  }
}