// server/routes/documents.js
// Document Control (SALSA / BRC / ISO procedures, forms, records)

"use strict";

const express = require("express");
const router = express.Router();

const { run, all, get } = require("../db");
const auth = require("../middleware/auth");

// -----------------------------
// Helper: company id from JWT
// -----------------------------
function getCompanyIdFromReq(req) {
  if (!req.user) return null;
  if (req.user.company_id) return req.user.company_id;
  if (req.user.companyId) return req.user.companyId;
  return null;
}

async function getDocumentForCompany(id, companyId) {
  return get(
    "SELECT * FROM documents WHERE id = ? AND company_id = ?",
    [id, companyId]
  );
}

// -----------------------------
// GET /api/documents
// ?status=Active|Draft|Obsolete
// ?standard=SALSA|BRCGS Food|ISO 22000 etc.
// -----------------------------
router.get("/", auth, async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res
        .status(500)
        .json({ error: "Current user has no company assigned" });
    }

    const status = (req.query.status || "").trim();
    const standard = (req.query.standard || "").trim();

    let sql = "SELECT * FROM documents WHERE company_id = ? ";
    const params = [companyId];

    if (status) {
      sql += "AND status = ? ";
      params.push(status);
    }
    if (standard) {
      sql += "AND standard = ? ";
      params.push(standard);
    }

    sql += "ORDER BY department ASC, code ASC, title ASC";

    const documents = await all(sql, params);
    res.json({ documents });
  } catch (err) {
    console.error("GET /documents error:", err);
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

// -----------------------------
// GET /api/documents/stats
// Returns counts for dashboard
// -----------------------------
router.get("/stats", auth, async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res
        .status(500)
        .json({ error: "Current user has no company assigned" });
    }

    const activeRow = await get(
      "SELECT COUNT(*) AS cnt FROM documents WHERE company_id = ? AND status = 'Active'",
      [companyId]
    );
    const draftRow = await get(
      "SELECT COUNT(*) AS cnt FROM documents WHERE company_id = ? AND status = 'Draft'",
      [companyId]
    );
    const obsoleteRow = await get(
      "SELECT COUNT(*) AS cnt FROM documents WHERE company_id = ? AND status = 'Obsolete'",
      [companyId]
    );

    // Overdue review: Active + review_date < today
    const today = new Date();
    const ymd = (d) =>
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0");

    const todayStr = ymd(today);

    const overdueRow = await get(
      `
        SELECT COUNT(*) AS cnt
        FROM documents
        WHERE company_id = ?
          AND status = 'Active'
          AND review_date IS NOT NULL
          AND review_date != ''
          AND review_date < ?
      `,
      [companyId, todayStr]
    );

    res.json({
      active: activeRow ? activeRow.cnt || 0 : 0,
      draft: draftRow ? draftRow.cnt || 0 : 0,
      obsolete: obsoleteRow ? obsoleteRow.cnt || 0 : 0,
      overdue_review: overdueRow ? overdueRow.cnt || 0 : 0,
    });
  } catch (err) {
    console.error("GET /documents/stats error:", err);
    res.status(500).json({ error: "Failed to fetch document stats" });
  }
});

// -----------------------------
// POST /api/documents
// Create document
// -----------------------------
router.post("/", auth, async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res
        .status(500)
        .json({ error: "Current user has no company assigned" });
    }

    const body = req.body || {};

    const title = (body.title || "").trim();
    if (!title) {
      return res.status(400).json({ error: "Document title is required" });
    }

    const code = body.code || "";
    const department = body.department || "";
    const process_area = body.process_area || "";
    const standard = body.standard || "";
    const clause = body.clause || "";
    const doc_type = body.doc_type || "";
    const version = body.version || "";
    const issue_date = body.issue_date || "";
    const review_date = body.review_date || "";
    const status = body.status || "Active";
    const owner = body.owner || "";
    const location = body.location || "";
    const notes = body.notes || "";

    const result = await run(
      `
        INSERT INTO documents (
          company_id,
          code,
          title,
          department,
          process_area,
          standard,
          clause,
          doc_type,
          version,
          issue_date,
          review_date,
          status,
          owner,
          location,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        companyId,
        code,
        title,
        department,
        process_area,
        standard,
        clause,
        doc_type,
        version,
        issue_date,
        review_date,
        status,
        owner,
        location,
        notes,
      ]
    );

    const created = await get(
      "SELECT * FROM documents WHERE id = ? AND company_id = ?",
      [result.lastID, companyId]
    );

    res.status(201).json({ document: created });
  } catch (err) {
    console.error("POST /documents error:", err);
    res.status(500).json({ error: "Failed to create document" });
  }
});

// -----------------------------
// PATCH /api/documents/:id
// Update document
// -----------------------------
router.patch("/:id", auth, async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res
        .status(500)
        .json({ error: "Current user has no company assigned" });
    }

    const id = req.params.id;
    const existing = await getDocumentForCompany(id, companyId);
    if (!existing) {
      return res.status(404).json({ error: "Document not found" });
    }

    const body = req.body || {};

    const code = body.code != null ? body.code : existing.code;
    const title = (body.title || existing.title || "").trim();
    const department =
      body.department != null ? body.department : existing.department;
    const process_area =
      body.process_area != null ? body.process_area : existing.process_area;
    const standard =
      body.standard != null ? body.standard : existing.standard;
    const clause = body.clause != null ? body.clause : existing.clause;
    const doc_type = body.doc_type != null ? body.doc_type : existing.doc_type;
    const version = body.version != null ? body.version : existing.version;
    const issue_date =
      body.issue_date != null ? body.issue_date : existing.issue_date;
    const review_date =
      body.review_date != null ? body.review_date : existing.review_date;
    const status = body.status != null ? body.status : existing.status;
    const owner = body.owner != null ? body.owner : existing.owner;
    const location =
      body.location != null ? body.location : existing.location;
    const notes = body.notes != null ? body.notes : existing.notes;

    await run(
      `
        UPDATE documents
        SET code = ?,
            title = ?,
            department = ?,
            process_area = ?,
            standard = ?,
            clause = ?,
            doc_type = ?,
            version = ?,
            issue_date = ?,
            review_date = ?,
            status = ?,
            owner = ?,
            location = ?,
            notes = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND company_id = ?
      `,
      [
        code,
        title,
        department,
        process_area,
        standard,
        clause,
        doc_type,
        version,
        issue_date,
        review_date,
        status,
        owner,
        location,
        notes,
        id,
        companyId,
      ]
    );

    const updated = await getDocumentForCompany(id, companyId);
    res.json({ document: updated });
  } catch (err) {
    console.error("PATCH /documents/:id error:", err);
    res.status(500).json({ error: "Failed to update document" });
  }
});

// -----------------------------
// DELETE /api/documents/:id
// -----------------------------
router.delete("/:id", auth, async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res
        .status(500)
        .json({ error: "Current user has no company assigned" });
    }

    const id = req.params.id;
    const existing = await getDocumentForCompany(id, companyId);
    if (!existing) {
      return res.status(404).json({ error: "Document not found" });
    }

    await run(
      "DELETE FROM documents WHERE id = ? AND company_id = ?",
      [id, companyId]
    );

    res.status(204).send();
  } catch (err) {
    console.error("DELETE /documents/:id error:", err);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

module.exports = router;