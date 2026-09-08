const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser =
  require("cookie-parser");

const env = require("./config/env");
const { pool } = require("./config/db");

const authRoutes =
  require("./routes/authRoutes");

const {
  notFound,
  errorHandler,
} = require("./middleware/errorMiddleware");

const app = express();

const categoryRoutes =
  require("./routes/categoryRoutes");

app.disable("x-powered-by");

app.use(helmet());

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json({
  limit: "1mb",
}));

app.use(cookieParser());

app.get("/", (req, res) => {
  res.status(200).json({
    name:
      "DevOps-Enabled E-Commerce API",
    status: "running",
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "success",
    service: "ecommerce-api",
    timestamp:
      new Date().toISOString(),
  });
});

app.get(
  "/api/health/database",
  async (req, res) => {
    try {
      const result =
        await pool.query(`
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
      console.error(
        "Database health check failed:",
        error
      );

      res.status(503).json({
        status: "error",
        database: "unavailable",
      });
    }
  }
);

/* API routes */
app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/categories",
  categoryRoutes
);

/* Keep these last */
app.use(notFound);
app.use(errorHandler);

module.exports = app;