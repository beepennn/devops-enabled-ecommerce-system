const {
  resetTestDatabase,
  closeTestDatabase,
} = require("../helpers/database");

beforeEach(async () => {
  await resetTestDatabase();
});

afterAll(async () => {
  await closeTestDatabase();
});