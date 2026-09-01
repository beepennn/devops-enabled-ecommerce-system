const express = require("express");
const cors = require("cors");

const { pool } = require("./config/db");

const app = express();

app.disable("x-powered-by");

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).json({
    name: "DevOps-Enabled E-Commerce API",
    status: "running",
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "success",
    service: "ecommerce-api",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/health/database", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        current_database() AS database,
        current_user AS user,
        NOW() AS server_time
    `);

    res.status(200).json({
      status: "success",
      database: "connected",
      details: result.rows[0],
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    res.status(503).json({
      status: "error",
      database: "unavailable",
    });
  }
});

module.exports = app;