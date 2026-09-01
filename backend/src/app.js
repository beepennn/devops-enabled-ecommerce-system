const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "DevOps-Enabled E-Commerce API is running",
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "success",
    service: "ecommerce-api",
  });
});

module.exports = app;