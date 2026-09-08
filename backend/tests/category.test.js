const request = require("supertest");

const app = require("../src/app");
const { pool } = require("../src/config/db");
const {
  generateAccessToken,
} = require("../src/utils/tokens");

/*
 * Creates a user directly in the test database.
 *
 * We do this instead of registering through /api/auth/register
 * because these tests are focused on category authorization,
 * not authentication behavior.
 */
async function createTestUser(role = "CUSTOMER") {
  const email =
    `${role.toLowerCase()}-${Date.now()}-${Math.random()}@example.com`;

  const result = await pool.query(
    `
      INSERT INTO users (
        first_name,
        last_name,
        email,
        password_hash,
        role
      )
      VALUES ($1, $2, $3, $4, $5)

      RETURNING
        id,
        email,
        role
    `,
    [
      "Test",
      "User",
      email,
      "not-used-in-category-tests",
      role,
    ]
  );

  return result.rows[0];
}

async function createAdminToken() {
  const admin =
    await createTestUser("ADMIN");

  return generateAccessToken(admin);
}

async function createCustomerToken() {
  const customer =
    await createTestUser("CUSTOMER");

  return generateAccessToken(customer);
}

describe("Category API", () => {
  // ==========================================================
  // PUBLIC CATEGORY ACCESS
  // ==========================================================

  test("returns an empty category list initially", async () => {
    const response = await request(app)
      .get("/api/categories");

    expect(response.statusCode).toBe(200);

    expect(response.body).toMatchObject({
      status: "success",
      results: 0,
      data: {
        categories: [],
      },
    });
  });


  test("allows public users to retrieve active categories", async () => {
    await pool.query(`
      INSERT INTO categories (
        name,
        slug,
        description
      )
      VALUES (
        'Electronics',
        'electronics',
        'Electronic products'
      )
    `);

    const response = await request(app)
      .get("/api/categories");

    expect(response.statusCode).toBe(200);

    expect(response.body.results).toBe(1);

    expect(
      response.body.data.categories[0]
    ).toMatchObject({
      name: "Electronics",
      slug: "electronics",
      isActive: true,
    });
  });


  test("retrieves a category by ID", async () => {
    const result = await pool.query(`
      INSERT INTO categories (
        name,
        slug
      )
      VALUES (
        'Electronics',
        'electronics'
      )
      RETURNING id
    `);

    const categoryId =
      result.rows[0].id;

    const response = await request(app)
      .get(`/api/categories/${categoryId}`);

    expect(response.statusCode).toBe(200);

    expect(
      response.body.data.category
    ).toMatchObject({
      id: categoryId,
      name: "Electronics",
      slug: "electronics",
    });
  });


  test("returns 404 for a nonexistent category", async () => {
    const response = await request(app)
      .get(
        "/api/categories/11111111-1111-4111-8111-111111111111"
      );

    expect(response.statusCode).toBe(404);

    expect(response.body).toMatchObject({
      status: "error",
      message: "Category not found",
    });
  });


  test("rejects malformed category IDs", async () => {
    const response = await request(app)
      .get("/api/categories/not-a-uuid");

    expect(response.statusCode).toBe(400);

    expect(response.body.status).toBe(
      "error"
    );
  });


  // ==========================================================
  // CATEGORY CREATION
  // ==========================================================

  test("allows an ADMIN to create a category", async () => {
    const token =
      await createAdminToken();

    const response = await request(app)
      .post("/api/categories")
      .set(
        "Authorization",
        `Bearer ${token}`
      )
      .send({
        name: "Electronics",
        description:
          "Electronic devices and accessories",
      });

    expect(response.statusCode).toBe(201);

    expect(
      response.body.data.category
    ).toMatchObject({
      name: "Electronics",
      slug: "electronics",
      description:
        "Electronic devices and accessories",
      isActive: true,
    });
  });


  test("automatically generates a slug from category name", async () => {
    const token =
      await createAdminToken();

    const response = await request(app)
      .post("/api/categories")
      .set(
        "Authorization",
        `Bearer ${token}`
      )
      .send({
        name: "Mobile Phones",
      });

    expect(response.statusCode).toBe(201);

    expect(
      response.body.data.category.slug
    ).toBe("mobile-phones");
  });


  test("allows an administrator to provide a custom slug", async () => {
    const token =
      await createAdminToken();

    const response = await request(app)
      .post("/api/categories")
      .set(
        "Authorization",
        `Bearer ${token}`
      )
      .send({
        name: "Mobile Phones",
        slug: "smartphones",
      });

    expect(response.statusCode).toBe(201);

    expect(
      response.body.data.category.slug
    ).toBe("smartphones");
  });


  test("rejects duplicate category names", async () => {
    const token =
      await createAdminToken();

    await request(app)
      .post("/api/categories")
      .set(
        "Authorization",
        `Bearer ${token}`
      )
      .send({
        name: "Electronics",
      });

    const response = await request(app)
      .post("/api/categories")
      .set(
        "Authorization",
        `Bearer ${token}`
      )
      .send({
        name: "electronics",
      });

    expect(response.statusCode).toBe(409);

    expect(response.body).toMatchObject({
      status: "error",
      message:
        "Category name or slug already exists",
    });
  });


  test("requires authentication to create a category", async () => {
    const response = await request(app)
      .post("/api/categories")
      .send({
        name: "Electronics",
      });

    expect(response.statusCode).toBe(401);
  });


  test("prevents CUSTOMER users from creating categories", async () => {
    const token =
      await createCustomerToken();

    const response = await request(app)
      .post("/api/categories")
      .set(
        "Authorization",
        `Bearer ${token}`
      )
      .send({
        name: "Electronics",
      });

    expect(response.statusCode).toBe(403);
  });


  // ==========================================================
  // PARENT / CHILD CATEGORIES
  // ==========================================================

  test("creates a subcategory with a valid parent", async () => {
    const token =
      await createAdminToken();

    const parentResponse =
      await request(app)
        .post("/api/categories")
        .set(
          "Authorization",
          `Bearer ${token}`
        )
        .send({
          name: "Electronics",
        });

    const parentId =
      parentResponse.body.data.category.id;

    const childResponse =
      await request(app)
        .post("/api/categories")
        .set(
          "Authorization",
          `Bearer ${token}`
        )
        .send({
          name: "Laptops",
          parentId,
        });

    expect(
      childResponse.statusCode
    ).toBe(201);

    expect(
      childResponse.body.data.category.parentId
    ).toBe(parentId);
  });


  test("rejects a nonexistent parent category", async () => {
    const token =
      await createAdminToken();

    const response = await request(app)
      .post("/api/categories")
      .set(
        "Authorization",
        `Bearer ${token}`
      )
      .send({
        name: "Laptops",
        parentId:
          "11111111-1111-4111-8111-111111111111",
      });

    expect(response.statusCode).toBe(400);

    expect(response.body).toMatchObject({
      status: "error",
      message:
        "Parent category does not exist",
    });
  });


  test("prevents circular category relationships", async () => {
    const token =
      await createAdminToken();

    const electronics =
      await request(app)
        .post("/api/categories")
        .set(
          "Authorization",
          `Bearer ${token}`
        )
        .send({
          name: "Electronics",
        });

    const electronicsId =
      electronics.body.data.category.id;

    const laptops =
      await request(app)
        .post("/api/categories")
        .set(
          "Authorization",
          `Bearer ${token}`
        )
        .send({
          name: "Laptops",
          parentId: electronicsId,
        });

    const laptopsId =
      laptops.body.data.category.id;

    const response = await request(app)
      .patch(
        `/api/categories/${electronicsId}`
      )
      .set(
        "Authorization",
        `Bearer ${token}`
      )
      .send({
        parentId: laptopsId,
      });

    expect(response.statusCode).toBe(400);

    expect(response.body).toMatchObject({
      status: "error",
      message:
        "Category hierarchy would create a circular relationship",
    });
  });


  test("prevents a category from becoming its own parent", async () => {
    const token =
      await createAdminToken();

    const created = await request(app)
      .post("/api/categories")
      .set(
        "Authorization",
        `Bearer ${token}`
      )
      .send({
        name: "Electronics",
      });

    const id =
      created.body.data.category.id;

    const response = await request(app)
      .patch(`/api/categories/${id}`)
      .set(
        "Authorization",
        `Bearer ${token}`
      )
      .send({
        parentId: id,
      });

    expect(response.statusCode).toBe(400);
  });


  // ==========================================================
  // UPDATES
  // ==========================================================

  test("allows an ADMIN to update a category", async () => {
    const token =
      await createAdminToken();

    const created = await request(app)
      .post("/api/categories")
      .set(
        "Authorization",
        `Bearer ${token}`
      )
      .send({
        name: "Electronics",
      });

    const id =
      created.body.data.category.id;

    const response = await request(app)
      .patch(`/api/categories/${id}`)
      .set(
        "Authorization",
        `Bearer ${token}`
      )
      .send({
        description:
          "Computers, phones and accessories",
      });

    expect(response.statusCode).toBe(200);

    expect(
      response.body.data.category.description
    ).toBe(
      "Computers, phones and accessories"
    );
  });


  test("updates the generated slug when category name changes", async () => {
    const token =
      await createAdminToken();

    const created = await request(app)
      .post("/api/categories")
      .set(
        "Authorization",
        `Bearer ${token}`
      )
      .send({
        name: "Phones",
      });

    const id =
      created.body.data.category.id;

    const response = await request(app)
      .patch(`/api/categories/${id}`)
      .set(
        "Authorization",
        `Bearer ${token}`
      )
      .send({
        name: "Mobile Phones",
      });

    expect(response.statusCode).toBe(200);

    expect(
      response.body.data.category.slug
    ).toBe("mobile-phones");
  });


  test("rejects empty category updates", async () => {
    const token =
      await createAdminToken();

    const created = await request(app)
      .post("/api/categories")
      .set(
        "Authorization",
        `Bearer ${token}`
      )
      .send({
        name: "Electronics",
      });

    const id =
      created.body.data.category.id;

    const response = await request(app)
      .patch(`/api/categories/${id}`)
      .set(
        "Authorization",
        `Bearer ${token}`
      )
      .send({});

    expect(response.statusCode).toBe(400);
  });


  // ==========================================================
  // SOFT DELETE
  // ==========================================================

  test("allows an ADMIN to deactivate a category", async () => {
    const token =
      await createAdminToken();

    const created = await request(app)
      .post("/api/categories")
      .set(
        "Authorization",
        `Bearer ${token}`
      )
      .send({
        name: "Electronics",
      });

    const id =
      created.body.data.category.id;

    const response = await request(app)
      .delete(`/api/categories/${id}`)
      .set(
        "Authorization",
        `Bearer ${token}`
      );

    expect(response.statusCode).toBe(200);

    expect(response.body).toMatchObject({
      status: "success",
      message:
        "Category deactivated successfully",
    });

    const result = await pool.query(
      `
        SELECT is_active
        FROM categories
        WHERE id = $1
      `,
      [id]
    );

    expect(
      result.rows[0].is_active
    ).toBe(false);
  });


  test("hides inactive categories from public listing", async () => {
    const token =
      await createAdminToken();

    const created = await request(app)
      .post("/api/categories")
      .set(
        "Authorization",
        `Bearer ${token}`
      )
      .send({
        name: "Electronics",
      });

    const id =
      created.body.data.category.id;

    await request(app)
      .delete(`/api/categories/${id}`)
      .set(
        "Authorization",
        `Bearer ${token}`
      );

    const response = await request(app)
      .get("/api/categories");

    expect(response.statusCode).toBe(200);

    expect(response.body.results).toBe(0);
  });


  test("prevents CUSTOMER users from deleting categories", async () => {
    const adminToken =
      await createAdminToken();

    const created = await request(app)
      .post("/api/categories")
      .set(
        "Authorization",
        `Bearer ${adminToken}`
      )
      .send({
        name: "Electronics",
      });

    const id =
      created.body.data.category.id;

    const customerToken =
      await createCustomerToken();

    const response = await request(app)
      .delete(`/api/categories/${id}`)
      .set(
        "Authorization",
        `Bearer ${customerToken}`
      );

    expect(response.statusCode).toBe(403);
  });
});