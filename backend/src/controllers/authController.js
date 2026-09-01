const env = require("../config/env");

const {
  registerSchema,
  loginSchema,
} = require("../validators/authValidator");

const {
  registerUser,
  loginUser,
  refreshSession,
  logoutUser,
  getUserById,
} = require("../services/authService");

const AppError = require("../utils/AppError");

function getRequestInfo(req) {
  return {
    userAgent:
      req.get("user-agent") || null,

    ip:
      req.ip ||
      req.socket?.remoteAddress ||
      null,
  };
}

function setRefreshCookie(res, token) {
  const maxAge =
    env.REFRESH_TOKEN_EXPIRES_DAYS *
    24 *
    60 *
    60 *
    1000;

  res.cookie(
    "refreshToken",
    token,
    {
      httpOnly: true,
      secure:
        env.NODE_ENV === "production",

      sameSite: "lax",

      maxAge,

      path: "/api/auth",
    }
  );
}

function clearRefreshCookie(res) {
  res.clearCookie(
    "refreshToken",
    {
      httpOnly: true,
      secure:
        env.NODE_ENV === "production",

      sameSite: "lax",

      path: "/api/auth",
    }
  );
}

async function register(req, res, next) {
  try {
    const parsed =
      registerSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues[0].message,
        400
      );
    }

    const result = await registerUser(
      parsed.data,
      getRequestInfo(req)
    );

    setRefreshCookie(
      res,
      result.refreshToken
    );

    res.status(201).json({
      status: "success",

      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const parsed =
      loginSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues[0].message,
        400
      );
    }

    const result = await loginUser(
      parsed.data,
      getRequestInfo(req)
    );

    setRefreshCookie(
      res,
      result.refreshToken
    );

    res.status(200).json({
      status: "success",

      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function refresh(req, res, next) {
  try {
    const result = await refreshSession(
      req.cookies.refreshToken,
      getRequestInfo(req)
    );

    setRefreshCookie(
      res,
      result.refreshToken
    );

    res.status(200).json({
      status: "success",

      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    clearRefreshCookie(res);
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    await logoutUser(
      req.cookies.refreshToken
    );

    clearRefreshCookie(res);

    res.status(200).json({
      status: "success",
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
}

async function me(req, res, next) {
  try {
    const user =
      await getUserById(req.user.id);

    res.status(200).json({
      status: "success",
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
};