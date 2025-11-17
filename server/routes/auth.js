// server/routes/auth.js
// Registration, login and "current user" endpoints

"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const router = express.Router();

const { run, get } = require("../db");
const auth = require("../middleware/auth");

// Use env var if set, otherwise a dev fallback
const JWT_SECRET = process.env.JWT_SECRET || "majra_dev_secret_change_me";
const JWT_EXPIRES_IN = "7d";

// Small helper: build JWT token from user record
function signToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    company_id: user.company_id,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// -------------------------------------------------------
// POST /api/auth/register
// Create company (if needed) + admin user, return token
// -------------------------------------------------------
router.post("/register", async (req, res) => {
  try {
    const body = req.body || {};

    // Accept both snake_case and camelCase from frontend
    const companyName =
      (body.company_name || body.companyName || "").trim();
    const name = (body.name || body.fullName || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!companyName || !name || !email || !password) {
      return res
        .status(400)
        .json({ error: "company_name, name, email and password are required" });
    }

    // Check if user already exists
    const existingUser = await get(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );
    if (existingUser) {
      return res.status(409).json({ error: "User with that email already exists" });
    }

    // Find or create company
    let company = await get(
      "SELECT id, name FROM companies WHERE name = ?",
      [companyName]
    );

    if (!company) {
      const result = await run(
        "INSERT INTO companies (name) VALUES (?)",
        [companyName]
      );
      company = { id: result.lastID, name: companyName };
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user as admin
    const userResult = await run(
      `INSERT INTO users
         (company_id, name, email, password_hash, role, is_active)
       VALUES (?, ?, ?, ?, 'admin', 1)`,
      [company.id, name, email, passwordHash]
    );

    const user = {
      id: userResult.lastID,
      company_id: company.id,
      name,
      email,
      role: "admin",
      company_name: company.name,
    };

    const token = signToken(user);

    res.status(201).json({
      token,
      user,
    });
  } catch (err) {
    console.error("POST /auth/register error:", err);
    res.status(500).json({ error: "Failed to register user" });
  }
});

// -------------------------------------------------------
// POST /api/auth/login
// Verify credentials, return token
// -------------------------------------------------------
router.post("/login", async (req, res) => {
  try {
    const body = req.body || {};
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required" });
    }

    // Join with companies to get company name in one go
    const user = await get(
      `SELECT u.*, c.name AS company_name
         FROM users u
         JOIN companies c ON c.id = u.company_id
        WHERE u.email = ?`,
      [email]
    );

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: "User is disabled" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        company_id: user.company_id,
        name: user.name,
        email: user.email,
        role: user.role,
        company_name: user.company_name,
      },
    });
  } catch (err) {
    console.error("POST /auth/login error:", err);
    res.status(500).json({ error: "Failed to login" });
  }
});

// -------------------------------------------------------
// GET /api/auth/me
// Return current user info from token
// -------------------------------------------------------
router.get("/me", auth, async (req, res) => {
  try {
    // auth middleware has put basic info on req.user (id, company_id, email)
    const userId = req.user.id;

    const user = await get(
      `SELECT u.*, c.name AS company_name
         FROM users u
         JOIN companies c ON c.id = u.company_id
        WHERE u.id = ?`,
      [userId]
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      id: user.id,
      company_id: user.company_id,
      name: user.name,
      email: user.email,
      role: user.role,
      company_name: user.company_name,
    });
  } catch (err) {
    console.error("GET /auth/me error:", err);
    res.status(500).json({ error: "Failed to load current user" });
  }
});

module.exports = router;