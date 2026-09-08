const { pool } = require("../config/db");
const AppError = require("../utils/AppError");

function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function mapCategory(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,

    parentId: row.parent_id,

    parent:
      row.parent_name
        ? {
            id: row.parent_id,
            name: row.parent_name,
          }
        : null,

    isActive: row.is_active,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getCategories() {
  const result = await pool.query(`
    SELECT
      c.id,
      c.name,
      c.slug,
      c.description,
      c.parent_id,
      c.is_active,
      c.created_at,
      c.updated_at,
      p.name AS parent_name
    FROM categories c

    LEFT JOIN categories p
      ON p.id = c.parent_id

    WHERE c.is_active = TRUE

    ORDER BY
      c.name ASC
  `);

  return result.rows.map(mapCategory);
}

async function getCategoryById(id) {
  const result = await pool.query(
    `
      SELECT
        c.id,
        c.name,
        c.slug,
        c.description,
        c.parent_id,
        c.is_active,
        c.created_at,
        c.updated_at,
        p.name AS parent_name
      FROM categories c

      LEFT JOIN categories p
        ON p.id = c.parent_id

      WHERE c.id = $1
        AND c.is_active = TRUE

      LIMIT 1
    `,
    [id]
  );

  if (result.rowCount === 0) {
    throw new AppError(
      "Category not found",
      404
    );
  }

  return mapCategory(result.rows[0]);
}

async function validateParent(parentId) {
  if (!parentId) {
    return;
  }

  const result = await pool.query(
    `
      SELECT id
      FROM categories
      WHERE id = $1
        AND is_active = TRUE
    `,
    [parentId]
  );

  if (result.rowCount === 0) {
    throw new AppError(
      "Parent category does not exist",
      400
    );
  }
}

async function wouldCreateCycle(
  categoryId,
  parentId
) {
  if (!parentId) {
    return false;
  }

  if (categoryId === parentId) {
    return true;
  }

  const result = await pool.query(
    `
      WITH RECURSIVE descendants AS (
        SELECT id
        FROM categories
        WHERE parent_id = $1

        UNION ALL

        SELECT c.id
        FROM categories c

        INNER JOIN descendants d
          ON c.parent_id = d.id
      )

      SELECT 1
      FROM descendants
      WHERE id = $2
      LIMIT 1
    `,
    [categoryId, parentId]
  );

  return result.rowCount > 0;
}

async function createCategory(data) {
  await validateParent(data.parentId);

  const slug =
    data.slug || generateSlug(data.name);

  try {
    const result = await pool.query(
      `
        INSERT INTO categories (
          name,
          slug,
          description,
          parent_id
        )

        VALUES ($1, $2, $3, $4)

        RETURNING *
      `,
      [
        data.name,
        slug,
        data.description || null,
        data.parentId || null,
      ]
    );

    return mapCategory(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      throw new AppError(
        "Category name or slug already exists",
        409
      );
    }

    throw error;
  }
}

async function updateCategory(id, data) {
  const existingResult =
    await pool.query(
      `
        SELECT *
        FROM categories
        WHERE id = $1
        LIMIT 1
      `,
      [id]
    );

  if (existingResult.rowCount === 0) {
    throw new AppError(
      "Category not found",
      404
    );
  }

  const existing =
    existingResult.rows[0];

  if (
    data.parentId !== undefined
  ) {
    await validateParent(
      data.parentId
    );

    const cycle =
      await wouldCreateCycle(
        id,
        data.parentId
      );

    if (cycle) {
      throw new AppError(
        "Category hierarchy would create a circular relationship",
        400
      );
    }
  }

  const name =
    data.name ?? existing.name;

  const slug =
    data.slug ??
    (
      data.name
        ? generateSlug(data.name)
        : existing.slug
    );

  const description =
    data.description !== undefined
      ? data.description
      : existing.description;

  const parentId =
    data.parentId !== undefined
      ? data.parentId
      : existing.parent_id;

  const isActive =
    data.isActive !== undefined
      ? data.isActive
      : existing.is_active;

  try {
    const result = await pool.query(
      `
        UPDATE categories

        SET
          name = $1,
          slug = $2,
          description = $3,
          parent_id = $4,
          is_active = $5

        WHERE id = $6

        RETURNING *
      `,
      [
        name,
        slug,
        description,
        parentId,
        isActive,
        id,
      ]
    );

    return mapCategory(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      throw new AppError(
        "Category name or slug already exists",
        409
      );
    }

    throw error;
  }
}

async function deactivateCategory(id) {
  const result = await pool.query(
    `
      UPDATE categories

      SET is_active = FALSE

      WHERE id = $1
        AND is_active = TRUE

      RETURNING id
    `,
    [id]
  );

  if (result.rowCount === 0) {
    throw new AppError(
      "Category not found or already inactive",
      404
    );
  }
}

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deactivateCategory,
};