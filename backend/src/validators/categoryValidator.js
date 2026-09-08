const { z } = require("zod");

const uuidSchema = z.string().uuid("Invalid category ID");

const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Category name must contain at least 2 characters")
    .max(120),

  slug: z
    .string()
    .trim()
    .min(2)
    .max(150)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must contain lowercase letters, numbers, and hyphens only"
    )
    .optional(),

  description: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .nullable(),

  parentId: uuidSchema.optional().nullable(),
});

const updateCategorySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(120)
      .optional(),

    slug: z
      .string()
      .trim()
      .min(2)
      .max(150)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug must contain lowercase letters, numbers, and hyphens only"
      )
      .optional(),

    description: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .nullable(),

    parentId: uuidSchema.optional().nullable(),

    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "At least one field must be provided",
    }
  );

const categoryIdSchema = z.object({
  id: uuidSchema,
});

module.exports = {
  createCategorySchema,
  updateCategorySchema,
  categoryIdSchema,
};