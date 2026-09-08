const request = require("supertest");
const bcrypt = require("bcryptjs");

const app = require("../src/app");
const { pool } = require("../src/config/db");

const validUser = {
  firstName: "Bipin",
  lastName: "Lamsal",
  email: "bipin.test@example.com",
  password: "StrongPass123",
};

describe("Authentication API", () => {
  // ==========================================================
  // REGISTRATION
  // ==========================================================

  test("registers a new customer successfully", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send(validUser);

    expect(response.statusCode).toBe(201);

    expect(response.body.status).toBe("success");

    expect(response.body.data.user).toMatchObject({
      firstName: "Bipin",
      lastName: "Lamsal",
      email: "bipin.test@example.com",
      role: "CUSTOMER",
    });

    expect(
      response.body.data.accessToken
    ).toEqual(expect.any(String));

    const cookies =
      response.headers["set-cookie"];

    expect(cookies).toBeDefined();

    expect(
      cookies.some((cookie) =>
        cookie.includes("refreshToken=")
      )
    ).toBe(true);

    expect(
      cookies.some((cookie) =>
        cookie.includes("HttpOnly")
      )
    ).toBe(true);
  });


  test("stores passwords as bcrypt hashes", async () => {
    await request(app)
      .post("/api/auth/register")
      .send(validUser);

    const result = await pool.query(
      `
        SELECT password_hash
        FROM users
        WHERE email = $1
      `,
      [validUser.email]
    );

    expect(result.rowCount).toBe(1);

    const storedHash =
      result.rows[0].password_hash;

    expect(storedHash).not.toBe(
      validUser.password
    );

    const matches = await bcrypt.compare(
      validUser.password,
      storedHash
    );

    expect(matches).toBe(true);
  });


  test("automatically creates a shopping cart during registration", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send(validUser);

    const userId =
      response.body.data.user.id;

    const result = await pool.query(
      `
        SELECT id
        FROM carts
        WHERE user_id = $1
      `,
      [userId]
    );

    expect(result.rowCount).toBe(1);
  });


  test("rejects duplicate email registration", async () => {
    await request(app)
      .post("/api/auth/register")
      .send(validUser);

    const response = await request(app)
      .post("/api/auth/register")
      .send({
        ...validUser,
        email: "BIPIN.TEST@example.com",
      });

    expect(response.statusCode).toBe(409);

    expect(response.body).toMatchObject({
      status: "error",
      message:
        "An account with this email already exists",
    });
  });


  test("rejects weak registration passwords", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        ...validUser,
        password: "weak",
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.status).toBe("error");

    const result = await pool.query(
      "SELECT COUNT(*)::INTEGER AS count FROM users"
    );

    expect(result.rows[0].count).toBe(0);
  });


  test("does not allow public registration to assign ADMIN role", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        ...validUser,
        role: "ADMIN",
      });

    expect(response.statusCode).toBe(201);

    expect(
      response.body.data.user.role
    ).toBe("CUSTOMER");

    const result = await pool.query(
      `
        SELECT role
        FROM users
        WHERE email = $1
      `,
      [validUser.email]
    );

    expect(
      result.rows[0].role
    ).toBe("CUSTOMER");
  });


  // ==========================================================
  // LOGIN
  // ==========================================================

  test("logs in a registered user successfully", async () => {
    await request(app)
      .post("/api/auth/register")
      .send(validUser);

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: validUser.email,
        password: validUser.password,
      });

    expect(response.statusCode).toBe(200);

    expect(response.body.status).toBe(
      "success"
    );

    expect(
      response.body.data.accessToken
    ).toEqual(expect.any(String));

    expect(
      response.body.data.user.email
    ).toBe(validUser.email);
  });


  test("rejects login with an incorrect password", async () => {
    await request(app)
      .post("/api/auth/register")
      .send(validUser);

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: validUser.email,
        password: "IncorrectPassword123",
      });

    expect(response.statusCode).toBe(401);

    expect(response.body).toMatchObject({
      status: "error",
      message: "Invalid email or password",
    });
  });


  // ==========================================================
  // AUTHENTICATED USER
  // ==========================================================

  test("returns authenticated user from /me", async () => {
    const registration = await request(app)
      .post("/api/auth/register")
      .send(validUser);

    const accessToken =
      registration.body.data.accessToken;

    const response = await request(app)
      .get("/api/auth/me")
      .set(
        "Authorization",
        `Bearer ${accessToken}`
      );

    expect(response.statusCode).toBe(200);

    expect(response.body.data.user).toMatchObject({
      email: validUser.email,
      role: "CUSTOMER",
    });
  });


  test("rejects /me without an access token", async () => {
    const response = await request(app)
      .get("/api/auth/me");

    expect(response.statusCode).toBe(401);

    expect(response.body.status).toBe(
      "error"
    );
  });


  // ==========================================================
  // REFRESH TOKEN
  // ==========================================================

  test("rotates refresh tokens", async () => {
    const agent = request.agent(app);

    await agent
      .post("/api/auth/register")
      .send(validUser);

    let result = await pool.query(`
      SELECT
        COUNT(*) FILTER (
          WHERE revoked_at IS NULL
        )::INTEGER AS active_count,

        COUNT(*) FILTER (
          WHERE revoked_at IS NOT NULL
        )::INTEGER AS revoked_count

      FROM refresh_tokens
    `);

    expect(
      result.rows[0].active_count
    ).toBe(1);

    expect(
      result.rows[0].revoked_count
    ).toBe(0);

    const refreshResponse = await agent
      .post("/api/auth/refresh");

    expect(
      refreshResponse.statusCode
    ).toBe(200);

    expect(
      refreshResponse.body.data.accessToken
    ).toEqual(expect.any(String));

    result = await pool.query(`
      SELECT
        COUNT(*) FILTER (
          WHERE revoked_at IS NULL
        )::INTEGER AS active_count,

        COUNT(*) FILTER (
          WHERE revoked_at IS NOT NULL
        )::INTEGER AS revoked_count

      FROM refresh_tokens
    `);

    expect(
      result.rows[0].active_count
    ).toBe(1);

    expect(
      result.rows[0].revoked_count
    ).toBe(1);
  });


  // ==========================================================
  // LOGOUT
  // ==========================================================

  test("revokes refresh token during logout", async () => {
    const agent = request.agent(app);

    await agent
      .post("/api/auth/register")
      .send(validUser);

    const response = await agent
      .post("/api/auth/logout");

    expect(response.statusCode).toBe(200);

    expect(response.body).toMatchObject({
      status: "success",
      message: "Logged out successfully",
    });

    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (
          WHERE revoked_at IS NULL
        )::INTEGER AS active_count,

        COUNT(*) FILTER (
          WHERE revoked_at IS NOT NULL
        )::INTEGER AS revoked_count

      FROM refresh_tokens
    `);

    expect(
      result.rows[0].active_count
    ).toBe(0);

    expect(
      result.rows[0].revoked_count
    ).toBe(1);
  });
});