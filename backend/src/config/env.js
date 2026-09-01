const { z } = require("zod");
require("dotenv").config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(5000),

  DB_HOST: z.string().min(1),

  DB_PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(5432),

  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),

  DB_SSL: z
    .string()
    .default("false")
    .transform((value) => value === "true"),

  FRONTEND_URL: z
    .string()
    .url()
    .default("http://localhost:5173"),

  JWT_ACCESS_SECRET: z
    .string()
    .min(32),

  JWT_ACCESS_EXPIRES_IN: z
    .string()
    .default("15m"),

  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce
    .number()
    .int()
    .positive()
    .default(7),

  BCRYPT_ROUNDS: z.coerce
    .number()
    .int()
    .min(10)
    .max(14)
    .default(12),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("Invalid environment configuration:");

  console.error(
    result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }))
  );

  process.exit(1);
}

module.exports = result.data;