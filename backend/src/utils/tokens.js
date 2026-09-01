const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const env = require("../config/env");

function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email,
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
      issuer: "devops-ecommerce-api",
      audience: "devops-ecommerce-client",
    }
  );
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString("hex");
}

function hashRefreshToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function verifyAccessToken(token) {
  return jwt.verify(
    token,
    env.JWT_ACCESS_SECRET,
    {
      issuer: "devops-ecommerce-api",
      audience: "devops-ecommerce-client",
    }
  );
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  verifyAccessToken,
};