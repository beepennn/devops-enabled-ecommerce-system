const { pool } =
  require("../src/config/db");

describe("Test database infrastructure", () => {
  test("connects to the isolated test database", async () => {
    const result = await pool.query(`
      SELECT
        current_database() AS database,
        current_user AS user
    `);

    expect(
      result.rows[0].database
    ).toBe("ecommerce_test_db");

    expect(
      result.rows[0].user
    ).toBe("ecommerce_test_user");
  });

  test("database starts with no users", async () => {
    const result =
      await pool.query(`
        SELECT COUNT(*)::INTEGER AS count
        FROM users
      `);

    expect(
      result.rows[0].count
    ).toBe(0);
  });
});