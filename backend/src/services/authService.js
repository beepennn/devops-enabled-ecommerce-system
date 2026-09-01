const bcrypt = require("bcryptjs");

const { pool } = require("../config/db");
const env = require("../config/env");

const AppError = require("../utils/AppError");

const {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} = require("../utils/tokens");

function sanitizeUser(user) {
  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    emailVerified: user.email_verified,
    createdAt: user.created_at,
  };
}

async function createTokenPair(user, requestInfo = {}) {
  const accessToken = generateAccessToken(user);

  const refreshToken = generateRefreshToken();
  const tokenHash = hashRefreshToken(refreshToken);

  const expiresAt = new Date();

  expiresAt.setDate(
    expiresAt.getDate() +
      env.REFRESH_TOKEN_EXPIRES_DAYS
  );

  await pool.query(
    `
      INSERT INTO refresh_tokens (
        user_id,
        token_hash,
        user_agent,
        ip_address,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5)
    `,
    [
      user.id,
      tokenHash,
      requestInfo.userAgent || null,
      requestInfo.ip || null,
      expiresAt,
    ]
  );

  return {
    accessToken,
    refreshToken,
  };
}

async function registerUser(data, requestInfo) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `
        SELECT id
        FROM users
        WHERE LOWER(email) = LOWER($1)
      `,
      [data.email]
    );

    if (existing.rowCount > 0) {
      throw new AppError(
        "An account with this email already exists",
        409
      );
    }

    const passwordHash = await bcrypt.hash(
      data.password,
      env.BCRYPT_ROUNDS
    );

    const result = await client.query(
      `
        INSERT INTO users (
          first_name,
          last_name,
          email,
          password_hash,
          role
        )
        VALUES ($1, $2, $3, $4, 'CUSTOMER')
        RETURNING
          id,
          first_name,
          last_name,
          email,
          phone,
          role,
          email_verified,
          created_at
      `,
      [
        data.firstName,
        data.lastName,
        data.email,
        passwordHash,
      ]
    );

    const user = result.rows[0];

    await client.query(
      `
        INSERT INTO carts (user_id)
        VALUES ($1)
      `,
      [user.id]
    );

    await client.query("COMMIT");

    const tokens = await createTokenPair(
      user,
      requestInfo
    );

    return {
      user: sanitizeUser(user),
      ...tokens,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function loginUser(data, requestInfo) {
  const result = await pool.query(
    `
      SELECT *
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
    `,
    [data.email]
  );

  if (result.rowCount === 0) {
    throw new AppError(
      "Invalid email or password",
      401
    );
  }

  const user = result.rows[0];

  if (!user.is_active) {
    throw new AppError(
      "This account has been disabled",
      403
    );
  }

  const passwordMatches = await bcrypt.compare(
    data.password,
    user.password_hash
  );

  if (!passwordMatches) {
    throw new AppError(
      "Invalid email or password",
      401
    );
  }

  await pool.query(
    `
      UPDATE users
      SET last_login_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `,
    [user.id]
  );

  const tokens = await createTokenPair(
    user,
    requestInfo
  );

  return {
    user: sanitizeUser(user),
    ...tokens,
  };
}

async function refreshSession(
  refreshToken,
  requestInfo
) {
  if (!refreshToken) {
    throw new AppError(
      "Refresh token is required",
      401
    );
  }

  const tokenHash =
    hashRefreshToken(refreshToken);

  const result = await pool.query(
    `
      SELECT
        rt.id AS refresh_token_id,
        rt.user_id,
        rt.expires_at,
        rt.revoked_at,
        u.*
      FROM refresh_tokens rt
      JOIN users u
        ON u.id = rt.user_id
      WHERE rt.token_hash = $1
      LIMIT 1
    `,
    [tokenHash]
  );

  if (result.rowCount === 0) {
    throw new AppError(
      "Invalid refresh token",
      401
    );
  }

  const session = result.rows[0];

  if (session.revoked_at) {
    throw new AppError(
      "Refresh token has been revoked",
      401
    );
  }

  if (
    new Date(session.expires_at) <= new Date()
  ) {
    throw new AppError(
      "Refresh token has expired",
      401
    );
  }

  if (!session.is_active) {
    throw new AppError(
      "This account has been disabled",
      403
    );
  }

  // Token rotation:
  // revoke the old refresh token.
  await pool.query(
    `
      UPDATE refresh_tokens
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `,
    [session.refresh_token_id]
  );

  const tokens = await createTokenPair(
    session,
    requestInfo
  );

  return {
    user: sanitizeUser(session),
    ...tokens,
  };
}

async function logoutUser(refreshToken) {
  if (!refreshToken) {
    return;
  }

  const tokenHash =
    hashRefreshToken(refreshToken);

  await pool.query(
    `
      UPDATE refresh_tokens
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE token_hash = $1
        AND revoked_at IS NULL
    `,
    [tokenHash]
  );
}

async function getUserById(userId) {
  const result = await pool.query(
    `
      SELECT
        id,
        first_name,
        last_name,
        email,
        phone,
        role,
        email_verified,
        created_at
      FROM users
      WHERE id = $1
        AND is_active = TRUE
    `,
    [userId]
  );

  if (result.rowCount === 0) {
    throw new AppError(
      "User not found",
      404
    );
  }

  return sanitizeUser(result.rows[0]);
}

module.exports = {
  registerUser,
  loginUser,
  refreshSession,
  logoutUser,
  getUserById,
};