const { pool } =
  require("../../src/config/db");

/**
 * Deletes application data while preserving
 * the database schema.
 *
 * Tests should never depend on data created
 * by previous tests.
 */
async function resetTestDatabase() {
  await pool.query(`
    TRUNCATE TABLE
      audit_logs,
      refresh_tokens,
      deliveries,
      payments,
      order_items,
      orders,
      cart_items,
      carts,
      inventory,
      product_images,
      products,
      categories,
      addresses,
      users
    RESTART IDENTITY CASCADE;
  `);
}

async function closeTestDatabase() {
  await pool.end();
}

module.exports = {
  resetTestDatabase,
  closeTestDatabase,
};