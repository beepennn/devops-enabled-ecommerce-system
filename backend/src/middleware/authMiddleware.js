const AppError = require("../utils/AppError");

const {
  verifyAccessToken,
} = require("../utils/tokens");

function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;

    if (
      !header ||
      !header.startsWith("Bearer ")
    ) {
      throw new AppError(
        "Authentication required",
        401
      );
    }

    const token = header.substring(7);

    const payload = verifyAccessToken(token);

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return next(
        new AppError(
          "Invalid or expired access token",
          401
        )
      );
    }

    next(error);
  }
}

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(
        new AppError(
          "Authentication required",
          401
        )
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          "You do not have permission to perform this action",
          403
        )
      );
    }

    next();
  };
}

module.exports = {
  authenticate,
  authorize,
};