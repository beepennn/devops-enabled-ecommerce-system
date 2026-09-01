const env = require("../config/env");

function notFound(req, res) {
  res.status(404).json({
    status: "error",
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
}

function errorHandler(
  error,
  req,
  res,
  next
) {
  const statusCode =
    error.statusCode || 500;

  const response = {
    status: "error",

    message:
      statusCode === 500
        ? "Internal server error"
        : error.message,
  };

  if (
    env.NODE_ENV === "development" &&
    statusCode === 500
  ) {
    response.debug = error.message;
  }

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json(response);
}

module.exports = {
  notFound,
  errorHandler,
};