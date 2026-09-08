const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const dotenv = require("dotenv");

module.exports = async () => {
  dotenv.config({
    path: path.resolve(
      process.cwd(),
      ".env.test"
    ),
  });

  console.log(
    "\nPreparing isolated PostgreSQL test database..."
  );

  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl:
      process.env.DB_SSL === "true"
        ? { rejectUnauthorized: false }
        : false,
  });

  await client.connect();

  try {
    /*
     * Completely rebuild the public schema.
     *
     * This guarantees that every `npm test`
     * begins from the migrations rather than
     * depending on whatever happened during
     * a previous test run.
     */
    await client.query(`
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
    `);

    const migrationsDirectory =
      path.resolve(
        process.cwd(),
        "../database/migrations"
      );

    const migrationFiles = fs
      .readdirSync(migrationsDirectory)
      .filter((file) =>
        file.endsWith(".sql")
      )
      .sort();

    if (migrationFiles.length === 0) {
      throw new Error(
        "No database migrations were found."
      );
    }

    for (const file of migrationFiles) {
      console.log(
        `Applying migration: ${file}`
      );

      const sql = fs.readFileSync(
        path.join(
          migrationsDirectory,
          file
        ),
        "utf8"
      );

      await client.query(sql);
    }

    console.log(
      "Test database prepared successfully.\n"
    );
  } finally {
    await client.end();
  }
};