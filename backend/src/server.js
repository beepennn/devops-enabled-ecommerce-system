const env = require("./config/env");
const app = require("./app");

const {
  pool,
  testDatabaseConnection,
} = require("./config/db");

let server;

async function startServer() {
  try {
    const databaseInfo = await testDatabaseConnection();

    console.log(
      `Connected to PostgreSQL database "${databaseInfo.database}" as "${databaseInfo.user}"`
    );

    server = app.listen(env.PORT, () => {
      console.log(
        `API server running at http://localhost:${env.PORT}`
      );
    });
  } catch (error) {
    console.error(
      "Unable to connect to PostgreSQL. Server startup aborted."
    );

    console.error(error.message);

    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`${signal} received. Starting graceful shutdown...`);

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }

    await pool.end();

    console.log("Database pool closed");
    console.log("Graceful shutdown completed");

    process.exit(0);
  } catch (error) {
    console.error("Graceful shutdown failed:", error);
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

startServer();