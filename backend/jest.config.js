module.exports = {
  testEnvironment: "node",

  testMatch: [
    "**/tests/**/*.test.js"
  ],

  globalSetup:
    "<rootDir>/tests/setup/globalSetup.js",

  setupFilesAfterEnv: [
    "<rootDir>/tests/setup/setupAfterEnv.js"
  ],

  clearMocks: true,
  restoreMocks: true,

  verbose: true,

  testTimeout: 15000,
};