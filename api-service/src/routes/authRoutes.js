export default async function (app, opts) {

  // LOGIN
  app.post("/login", {
    schema: {
      body: {
        type: "object",
        required: ["email"],
        properties: {
          email: { type: "string", format: "email" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            message: { type: "string" },
            accessToken: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {

    const { email } = request.body;

    const user = {
      id: 1,
      email,
    };

    const accessToken = app.jwt.sign(user, {
      expiresIn: "15m",
    });

    const refreshToken = app.jwt.sign(user, {
      expiresIn: "7d",
    });

    reply.setCookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: false, // true in production
      sameSite: "lax",
      path: "/",
    });

    return {
      message: "Login successful",
      accessToken,
    };
  });


  // REFRESH
  app.post("/refresh", {
    schema: {
      response: {
        200: {
          type: "object",
          properties: {
            accessToken: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {

    try {
      const refreshToken = request.cookies?.refreshToken;

      if (!refreshToken) {
        return reply.code(401).send({ message: "No refresh token" });
      }

      const decoded = app.jwt.verify(refreshToken);

      const newAccessToken = app.jwt.sign(
        {
          id: decoded.id,
          email: decoded.email,
        },
        { expiresIn: "15m" }
      );

      return {
        accessToken: newAccessToken,
      };

    } catch (err) {
      return reply.code(401).send({ message: "Invalid or expired refresh token" });
    }
  });


  // LOGOUT
  app.post("/logout", {
    schema: {
      response: {
        200: {
          type: "object",
          properties: {
            message: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {

    reply.clearCookie("refreshToken", {
      path: "/",
    });

    return {
      message: "Logged out successfully",
    };
  });

}
