// server/routes/suppliers.js
// Supplier routes (SQLite, per-company)

"use strict";

const express = require("express");
const router = express.Router();

const { run, all, get } = require("../db");
const auth = require("../middleware/auth"); // JWT middleware

// ------------------------------------------------------
// Helper: get supplier only if it belongs to this company
// ------------------------------------------------------
async function getSupplierForCompany(id, companyId) {
  return get(
    "SELECT * FROM suppliers WHERE id = ? AND company_id = ?",
    [id, companyId]
  );
}

// ------------------------------------------------------
// Helper: convert JS Date -> YYYY-MM-DD (used in /stats)
// ------------------------------------------------------
function toYMD(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
}

// ------------------------------------------------------
// Small helper: read companyId from token in a safe way
// (handles company_id or companyId in the JWT payload)
// ------------------------------------------------------
function getCompanyIdFromReq(req) {
  if (!req.user) return null;
  if (req.user.company_id) return req.user.company_id;
  if (req.user.companyId) return req.user.companyId;
  return null;
}

// ------------------------------------------------------
// GET /api/suppliers
// List all suppliers for that company
// ------------------------------------------------------
router.get("/", auth, async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      console.error("GET /suppliers: missing company id on req.user:", req.user);
      return res
        .status(500)
        .json({ error: "Current user has no company assigned" });
    }

    const suppliers = await all(
      "SELECT * FROM suppliers WHERE company_id = ? ORDER BY name ASC",
      [companyId]
    );

    res.json({ suppliers });
  } catch (err) {
    console.error("GET /suppliers error:", err);
    res.status(500).json({ error: "Failed to fetch suppliers" });
  }
});
// -------------------------------------------
// GET /api/suppliers/stats
// Simple stats for dashboard (total suppliers)
// -------------------------------------------
router.get("/stats", auth, async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      console.error("GET /suppliers/stats: missing company id on req.user");
      return res
        .status(500)
        .json({ error: "Current user has no company assigned" });
    }

    const row = await get(
      "SELECT COUNT(*) AS total FROM suppliers WHERE company_id = ?",
      [companyId]
    );

    res.json({
      total: row && row.total ? row.total : 0
    });
  } catch (err) {
    console.error("GET /suppliers/stats error:", err);
    res.status(500).json({ error: "Failed to fetch supplier stats" });
  }
});

// ------------------------------------------------------
// GET /api/suppliers/stats
// Dashboard statistics (optional for later)
// ------------------------------------------------------
router.get("/stats", auth, async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      console.error("GET /suppliers/stats: missing company id:", req.user);
      return res
        .status(500)
        .json({ error: "Current user has no company assigned" });
    }

    const today = new Date();
    const plus30 = new Date();
    plus30.setDate(today.getDate() + 30);

    const todayStr = toYMD(today);
    const plus30Str = toYMD(plus30);

    const total = await get(
      "SELECT COUNT(*) AS cnt FROM suppliers WHERE company_id = ?",
      [companyId]
    );

    const missingCert = await get(
      "SELECT COUNT(*) AS cnt FROM suppliers WHERE company_id = ? AND (certificate_type IS NULL OR certificate_type = '')",
      [companyId]
    );

    const expiringSoon = await get(
      "SELECT COUNT(*) AS cnt FROM suppliers WHERE company_id = ? AND certificate_expiry IS NOT NULL AND certificate_expiry <> '' AND certificate_expiry > ? AND certificate_expiry <= ?",
      [companyId, todayStr, plus30Str]
    );

    const expired = await get(
      "SELECT COUNT(*) AS cnt FROM suppliers WHERE company_id = ? AND certificate_expiry IS NOT NULL AND certificate_expiry <> '' AND certificate_expiry <= ?",
      [companyId, todayStr]
    );

    res.json({
      total: total ? total.cnt || 0 : 0,
      missing_cert: missingCert ? missingCert.cnt || 0 : 0,
      expiring_30_days: expiringSoon ? expiringSoon.cnt || 0 : 0,
      expired: expired ? expired.cnt || 0 : 0,
    });
  } catch (err) {
    console.error("GET /suppliers/stats error:", err);
    res.status(500).json({ error: "Failed to fetch supplier stats" });
  }
});

// ------------------------------------------------------
// POST /api/suppliers
// Create supplier
// ------------------------------------------------------
router.post("/", auth, async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      console.error("POST /suppliers: missing company id:", req.user);
      return res
        .status(500)
        .json({ error: "Current user has no company assigned" });
    }

    const {
      name = "",
      material = "",
      certificate_type = "",
      certificate_expiry = "",
      risk_level = "",
      status = "",
      notes = "",
    } = req.body || {};

    if (!name) {
      return res.status(400).json({ error: "Supplier name is required" });
    }

    const result = await run(
      `INSERT INTO suppliers
        (company_id, name, material, certificate_type, certificate_expiry, risk_level, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        name,
        material,
        certificate_type,
        certificate_expiry,
        risk_level,
        status,
        notes,
      ]
    );

    const created = await get(
      "SELECT * FROM suppliers WHERE id = ? AND company_id = ?",
      [result.lastID, companyId]
    );

    res.status(201).json({ supplier: created });
  } catch (err) {
    console.error("POST /suppliers error:", err);
    // send the message so you can see if anything else goes wrong
    res.status(500).json({ error: "Failed to create supplier: " + err.message });
  }
});

// ------------------------------------------------------
// PATCH /api/suppliers/:id
// Update supplier
// ------------------------------------------------------
router.patch("/:id", auth, async (req, res) => {
  try {
    const id = req.params.id;
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      console.error("PATCH /suppliers/:id: missing company id:", req.user);
      return res
        .status(500)
        .json({ error: "Current user has no company assigned" });
    }

    const existing = await getSupplierForCompany(id, companyId);
    if (!existing) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    const {
      name = "",
      material = "",
      certificate_type = "",
      certificate_expiry = "",
      risk_level = "",
      status = "",
      notes = "",
    } = req.body || {};

    await run(
      `UPDATE suppliers
       SET name = ?, material = ?, certificate_type = ?, certificate_expiry = ?,
           risk_level = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND company_id = ?`,
      [
        name,
        material,
        certificate_type,
        certificate_expiry,
        risk_level,
        status,
        notes,
        id,
        companyId,
      ]
    );

    const updated = await getSupplierForCompany(id, companyId);
    res.json({ supplier: updated });
  } catch (err) {
    console.error("PATCH /suppliers/:id error:", err);
    res.status(500).json({ error: "Failed to update supplier" });
  }
});

// ------------------------------------------------------
// DELETE /api/suppliers/:id
// ------------------------------------------------------
router.delete("/:id", auth, async (req, res) => {
  try {
    const id = req.params.id;
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      console.error("DELETE /suppliers/:id: missing company id:", req.user);
      return res
        .status(500)
        .json({ error: "Current user has no company assigned" });
    }

    const existing = await getSupplierForCompany(id, companyId);
    if (!existing) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    await run(
      "DELETE FROM suppliers WHERE id = ? AND company_id = ?",
      [id, companyId]
    );

    res.status(204).send();
  } catch (err) {
    console.error("DELETE /suppliers/:id error:", err);
    res.status(500).json({ error: "Failed to delete supplier" });
  }
});

module.exports = router;