const { Pool } = require("pg");
const env = require("./env");

const pool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,

  max: 10,

  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,

  ssl: env.DB_SSL
    ? {
        rejectUnauthorized: false,
      }
    : false,
});

pool.on("connect", () => {
  console.log("PostgreSQL client connected");
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error);
});

async function testDatabaseConnection() {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT
        current_database() AS database,
        current_user AS user,
        NOW() AS connected_at
    `);

    return result.rows[0];
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  testDatabaseConnection,
};