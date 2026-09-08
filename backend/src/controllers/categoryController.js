const AppError =
  require("../utils/AppError");

const {
  createCategorySchema,
  updateCategorySchema,
  categoryIdSchema,
} = require("../validators/categoryValidator");

const {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deactivateCategory,
} = require("../services/categoryService");

async function list(req, res, next) {
  try {
    const categories =
      await getCategories();

    res.status(200).json({
      status: "success",

      results:
        categories.length,

      data: {
        categories,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function getOne(
  req,
  res,
  next
) {
  try {
    const parsed =
      categoryIdSchema.safeParse(
        req.params
      );

    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues[0].message,
        400
      );
    }

    const category =
      await getCategoryById(
        parsed.data.id
      );

    res.status(200).json({
      status: "success",

      data: {
        category,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function create(
  req,
  res,
  next
) {
  try {
    const parsed =
      createCategorySchema.safeParse(
        req.body
      );

    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues[0].message,
        400
      );
    }

    const category =
      await createCategory(
        parsed.data
      );

    res.status(201).json({
      status: "success",

      data: {
        category,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function update(
  req,
  res,
  next
) {
  try {
    const params =
      categoryIdSchema.safeParse(
        req.params
      );

    if (!params.success) {
      throw new AppError(
        params.error.issues[0].message,
        400
      );
    }

    const body =
      updateCategorySchema.safeParse(
        req.body
      );

    if (!body.success) {
      throw new AppError(
        body.error.issues[0].message,
        400
      );
    }

    const category =
      await updateCategory(
        params.data.id,
        body.data
      );

    res.status(200).json({
      status: "success",

      data: {
        category,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function remove(
  req,
  res,
  next
) {
  try {
    const parsed =
      categoryIdSchema.safeParse(
        req.params
      );

    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues[0].message,
        400
      );
    }

    await deactivateCategory(
      parsed.data.id
    );

    res.status(200).json({
      status: "success",

      message:
        "Category deactivated successfully",
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
  getOne,
  create,
  update,
  remove,
};