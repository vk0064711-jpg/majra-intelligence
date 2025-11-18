// server/server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const { init } = require("./db");

// Route modules
const authRoutes = require("./routes/auth");
const complaintsRoutes = require("./routes/complaints");
const suppliersRoutes = require("./routes/suppliers");
const auditsRoutes = require("./routes/audits");
const documentsRoutes = require("./routes/documents");
const trainingRoutes = require("./routes/training");

const app = express();
const PORT = process.env.PORT || 3000;

// --------------------
// Middleware
// --------------------
app.use(cors());
app.use(express.json());

// --------------------
// Serve FRONTEND
// --------------------
app.use(express.static(path.join(__dirname, "..", "public")));

// --------------------
// API routes
// --------------------
app.use("/api/auth", authRoutes);
app.use("/api/complaints", complaintsRoutes);
app.use("/api/suppliers", suppliersRoutes);
app.use("/api/audits", auditsRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/training", trainingRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// --------------------
// Root index.html
// --------------------
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// --------------------
// Start server AFTER DB init
// --------------------
init()
  .then(() => {
    console.log("✅ Database initialised successfully.");
    app.listen(PORT, () => {
      console.log(
        "Majra Intelligence backend running on http://localhost:" + PORT
      );
    });
  })
  .catch((err) => {
    console.error("❌ Error initialising database:", err);
    process.exit(1);
  });