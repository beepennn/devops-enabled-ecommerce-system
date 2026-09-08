const express = require("express");

const {
  list,
  getOne,
  create,
  update,
  remove,
} = require("../controllers/categoryController");

const {
  authenticate,
  authorize,
} = require("../middleware/authMiddleware");

const router = express.Router();

/*
 * Public routes
 */
router.get("/", list);
router.get("/:id", getOne);

/*
 * Administrator routes
 */
router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  create
);

router.patch(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  update
);

router.delete(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  remove
);

module.exports = router;