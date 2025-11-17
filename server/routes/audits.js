// server/routes/audits.js
"use strict";

const express = require("express");
const router = express.Router();

const { run, all, get } = require("../db");
const auth = require("../middleware/auth");

// helper: company id from JWT
function getCompanyIdFromReq(req) {
  if (!req.user) return null;
  if (req.user.company_id) return req.user.company_id;
  if (req.user.companyId) return req.user.companyId;
  return null;
}

async function getAuditForCompany(id, companyId) {
  return get(
    "SELECT * FROM audits WHERE id = ? AND company_id = ?",
    [id, companyId]
  );
}

// GET /api/audits?status=
router.get("/", auth, async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res
        .status(500)
        .json({ error: "Current user has no company assigned" });
    }

    const status = (req.query.status || "").trim();
    let sql = "SELECT * FROM audits WHERE company_id = ? ";
    const params = [companyId];

    if (status) {
      sql += "AND status = ? ";
      params.push(status);
    }

    sql += "ORDER BY audit_date DESC, created_at DESC";

    const audits = await all(sql, params);
    res.json({ audits });
  } catch (err) {
    console.error("GET /audits error:", err);
    res.status(500).json({ error: "Failed to fetch audits" });
  }
});

// GET /api/audits/stats
router.get("/stats", auth, async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res
        .status(500)
        .json({ error: "Current user has no company assigned" });
    }

    const openRow = await get(
      "SELECT COUNT(*) AS cnt FROM audits WHERE company_id = ? AND status != 'closed'",
      [companyId]
    );

    const closedRow = await get(
      "SELECT COUNT(*) AS cnt FROM audits WHERE company_id = ? AND status = 'closed'",
      [companyId]
    );

    const today = new Date();
    const plus7 = new Date();
    plus7.setDate(today.getDate() + 7);

    function toYMD(d) {
      return (
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0")
      );
    }

    const todayStr = toYMD(today);
    const plus7Str = toYMD(plus7);

    const dueSoonRow = await get(
      "SELECT COUNT(*) AS cnt FROM audits WHERE company_id = ? AND status != 'closed' AND due_date >= ? AND due_date <= ?",
      [companyId, todayStr, plus7Str]
    );

    res.json({
      open: openRow ? openRow.cnt || 0 : 0,
      due_7_days: dueSoonRow ? dueSoonRow.cnt || 0 : 0,
      closed: closedRow ? closedRow.cnt || 0 : 0
    });
  } catch (err) {
    console.error("GET /audits/stats error:", err);
    res.status(500).json({ error: "Failed to fetch audit stats" });
  }
});

// POST /api/audits
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
      return res.status(400).json({ error: "Audit title is required" });
    }

    const area = body.area || "";
    const standard = body.standard || "";
    const section = body.section || "";
    const auditor = body.auditor || "";
    const audit_date = body.audit_date || "";
    const status = body.status || "open";
    const severity = body.severity || "";
    const due_date = body.due_date || "";
    const responsible_person = body.responsible_person || "";
    const findings = body.findings || "";
    const root_cause = body.root_cause || "";
    const corrective_action = body.corrective_action || "";
    const preventive_action = body.preventive_action || "";
    const evidence_notes = body.evidence_notes || "";

    const result = await run(
      `INSERT INTO audits (
        company_id,
        title,
        area,
        standard,
        section,
        auditor,
        audit_date,
        status,
        severity,
        due_date,
        responsible_person,
        findings,
        root_cause,
        corrective_action,
        preventive_action,
        evidence_notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        title,
        area,
        standard,
        section,
        auditor,
        audit_date,
        status,
        severity,
        due_date,
        responsible_person,
        findings,
        root_cause,
        corrective_action,
        preventive_action,
        evidence_notes
      ]
    );

    const created = await get(
      "SELECT * FROM audits WHERE id = ? AND company_id = ?",
      [result.lastID, companyId]
    );

    res.status(201).json({ audit: created });
  } catch (err) {
    console.error("POST /audits error:", err);
    res.status(500).json({ error: "Failed to create audit" });
  }
});

// PATCH /api/audits/:id
router.patch("/:id", auth, async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res
        .status(500)
        .json({ error: "Current user has no company assigned" });
    }

    const id = req.params.id;
    const existing = await getAuditForCompany(id, companyId);
    if (!existing) {
      return res.status(404).json({ error: "Audit not found" });
    }

    const body = req.body || {};

    const title = (body.title || existing.title || "").trim();
    const area = body.area !== undefined ? body.area : existing.area;
    const standard = body.standard !== undefined ? body.standard : existing.standard;
    const section = body.section !== undefined ? body.section : existing.section;
    const auditor = body.auditor !== undefined ? body.auditor : existing.auditor;
    const audit_date = body.audit_date !== undefined ? body.audit_date : existing.audit_date;
    const status = body.status !== undefined ? body.status : existing.status;
    const severity = body.severity !== undefined ? body.severity : existing.severity;
    const due_date = body.due_date !== undefined ? body.due_date : existing.due_date;
    const responsible_person =
      body.responsible_person !== undefined
        ? body.responsible_person
        : existing.responsible_person;
    const findings =
      body.findings !== undefined ? body.findings : existing.findings;
    const root_cause =
      body.root_cause !== undefined ? body.root_cause : existing.root_cause;
    const corrective_action =
      body.corrective_action !== undefined
        ? body.corrective_action
        : existing.corrective_action;
    const preventive_action =
      body.preventive_action !== undefined
        ? body.preventive_action
        : existing.preventive_action;
    const evidence_notes =
      body.evidence_notes !== undefined
        ? body.evidence_notes
        : existing.evidence_notes;

    await run(
      `UPDATE audits
       SET title = ?,
           area = ?,
           standard = ?,
           section = ?,
           auditor = ?,
           audit_date = ?,
           status = ?,
           severity = ?,
           due_date = ?,
           responsible_person = ?,
           findings = ?,
           root_cause = ?,
           corrective_action = ?,
           preventive_action = ?,
           evidence_notes = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND company_id = ?`,
      [
        title,
        area,
        standard,
        section,
        auditor,
        audit_date,
        status,
        severity,
        due_date,
        responsible_person,
        findings,
        root_cause,
        corrective_action,
        preventive_action,
        evidence_notes,
        id,
        companyId
      ]
    );

    const updated = await getAuditForCompany(id, companyId);
    res.json({ audit: updated });
  } catch (err) {
    console.error("PATCH /audits/:id error:", err);
    res.status(500).json({ error: "Failed to update audit" });
  }
});

// DELETE /api/audits/:id
router.delete("/:id", auth, async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res
        .status(500)
        .json({ error: "Current user has no company assigned" });
    }

    const id = req.params.id;
    const existing = await getAuditForCompany(id, companyId);
    if (!existing) {
      return res.status(404).json({ error: "Audit not found" });
    }

    await run(
      "DELETE FROM audits WHERE id = ? AND company_id = ?",
      [id, companyId]
    );

    res.status(204).send();
  } catch (err) {
    console.error("DELETE /audits/:id error:", err);
    res.status(500).json({ error: "Failed to delete audit" });
  }
});

module.exports = router;