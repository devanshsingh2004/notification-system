export default async function (app, opts) {

  // LOGIN
  app.post("/login", async (request, reply) => {
    const { email } = request.body;

    if (!email) {
      return reply.code(400).send({ message: "Email required" });
    }

    // Dummy user (DB later)
    const user = { id: 1, email };

    // Access Token (short-lived)
    const accessToken = app.jwt.sign(user, {
      expiresIn: "15m",
    });

    // Refresh Token (long-lived)
    const refreshToken = app.jwt.sign(user, {
      expiresIn: "7d",
    });

    // Store refresh token in HTTP-only cookie
    reply.setCookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: false, // true in production (HTTPS)
      path: "/",
    });

    return { accessToken };
  });


  //  REFRESH TOKEN
  app.post("/refresh", async (request, reply) => {
    try {
      const { refreshToken } = request.cookies;

      if (!refreshToken) {
        return reply.code(401).send({ message: "No refresh token" });
      }

      const decoded = app.jwt.verify(refreshToken);

      const newAccessToken = app.jwt.sign(
        { id: decoded.id, email: decoded.email },
        { expiresIn: "15m" }
      );

      return { accessToken: newAccessToken };

    } catch (err) {
      return reply.code(401).send({ message: "Invalid refresh token" });
    }
  });


  //  LOGOUT
  app.post("/logout", async (request, reply) => {
    reply.clearCookie("refreshToken");
    return { message: "Logged out successfully" };
  });

}