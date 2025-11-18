// server/routes/audits.js
"use strict";

const express = require("express");
const router = express.Router();

const { run, all, get } = require("../db");
const auth = require("../middleware/auth");

// ----------------- helpers -----------------
function getCompanyIdFromReq(req) {
  if (!req.user) return null;
  if (req.user.company_id) return req.user.company_id;
  if (req.user.companyId) return req.user.companyId;
  return null;
}

async function getAuditForCompany(id, companyId) {
  return get("SELECT * FROM audits WHERE id = ? AND company_id = ?", [
    id,
    companyId
  ]);
}

/**
 * Calculate a 0–100 compliance score for a single audit.
 *
 * Rules:
 * - Start from 100
 * - Severity:
 *    Critical  -> -40
 *    Major     -> -25
 *    Minor     -> -10
 *    Observation/Obs -> -5
 * - Overdue (not closed & due_date < today) -> -10
 * - If closed and has some actions/findings -> +5 bonus (capped at 100)
 */
function calculateAuditScore(audit) {
  let score = 100;

  const sev = (audit.severity || "").toLowerCase().trim();
  if (sev === "critical") score -= 40;
  else if (sev === "major") score -= 25;
  else if (sev === "minor") score -= 10;
  else if (sev === "observation" || sev === "obs") score -= 5;

  const status = (audit.status || "").toLowerCase().trim();
  const due = audit.due_date || null;
  const todayStr = new Date().toISOString().slice(0, 10);

  if (due && status !== "closed" && due < todayStr) {
    // open / in_progress & overdue
    score -= 10;
  }

  // small bonus if closed with actions recorded
  if (status === "closed") {
    if (
      (audit.corrective_action && audit.corrective_action.trim()) ||
      (audit.preventive_action && audit.preventive_action.trim()) ||
      (audit.findings && audit.findings.trim())
    ) {
      score += 5;
    }
  }

  if (score < 0) score = 0;
  if (score > 100) score = 100;
  return Math.round(score);
}

// ----------------- list / filter -----------------
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

// ----------------- stats (for dashboard cards) -----------------
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

// ----------------- overall score (NEW) -----------------
// GET /api/audits/score/overall
router.get("/score/overall", auth, async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res
        .status(500)
        .json({ error: "Current user has no company assigned" });
    }

    const audits = await all(
      "SELECT * FROM audits WHERE company_id = ?",
      [companyId]
    );

    if (!audits || !audits.length) {
      return res.json({ overall_score: null, by_area: [] });
    }

    const scored = audits.map((a) => {
      return {
        ...a,
        score: calculateAuditScore(a)
      };
    });

    const totalScore = scored.reduce((sum, a) => sum + a.score, 0);
    const overall = Math.round(totalScore / scored.length);

    const byAreaMap = {};
    scored.forEach((a) => {
      const area = (a.area || "Unspecified").trim() || "Unspecified";
      if (!byAreaMap[area]) {
        byAreaMap[area] = {
          area,
          total_audits: 0,
          sum_score: 0
        };
      }
      byAreaMap[area].total_audits += 1;
      byAreaMap[area].sum_score += a.score;
    });

    const by_area = Object.values(byAreaMap).map((row) => ({
      area: row.area,
      total_audits: row.total_audits,
      avg_score: Math.round(row.sum_score / row.total_audits)
    }));

    res.json({
      overall_score: overall,
      by_area
    });
  } catch (err) {
    console.error("GET /audits/score/overall error:", err);
    res
      .status(500)
      .json({ error: "Failed to calculate audit compliance score" });
  }
});

// ----------------- export data (for CSV / graphs etc.) -----------------
// GET /api/audits/export/json
router.get("/export/json", auth, async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res
        .status(500)
        .json({ error: "Current user has no company assigned" });
    }

    const audits = await all(
      "SELECT * FROM audits WHERE company_id = ? ORDER BY audit_date DESC, created_at DESC",
      [companyId]
    );
    res.json({ audits });
  } catch (err) {
    console.error("GET /audits/export/json error:", err);
    res.status(500).json({ error: "Failed to export audits" });
  }
});

// GET /api/audits/export/csv
router.get("/export/csv", auth, async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res
        .status(500)
        .json({ error: "Current user has no company assigned" });
    }

    const audits = await all(
      "SELECT * FROM audits WHERE company_id = ? ORDER BY audit_date DESC, created_at DESC",
      [companyId]
    );

    const header = [
      "Date",
      "Title",
      "Area",
      "Standard",
      "Section",
      "Auditor",
      "Status",
      "Severity",
      "Due Date",
      "Responsible Person",
      "Findings",
      "Root Cause",
      "Corrective Action",
      "Preventive Action",
      "Evidence Notes"
    ];

    function escapeCsv(val) {
      if (val == null) return "";
      const s = String(val);
      if (/[",\n]/.test(s)) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }

    const rows = audits.map((a) => [
      a.audit_date || "",
      a.title || "",
      a.area || "",
      a.standard || "",
      a.section || "",
      a.auditor || "",
      a.status || "",
      a.severity || "",
      a.due_date || "",
      a.responsible_person || "",
      a.findings || "",
      a.root_cause || "",
      a.corrective_action || "",
      a.preventive_action || "",
      a.evidence_notes || ""
    ]);

    let csv = header.map(escapeCsv).join(",") + "\n";
    rows.forEach((r) => {
      csv += r.map(escapeCsv).join(",") + "\n";
    });

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="audits.csv"'
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.send(csv);
  } catch (err) {
    console.error("GET /audits/export/csv error:", err);
    res.status(500).json({ error: "Failed to export audits CSV" });
  }
});

// ----------------- chart data by area (department) -----------------
// GET /api/audits/summary/by-area
router.get("/summary/by-area", auth, async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res
        .status(500)
        .json({ error: "Current user has no company assigned" });
    }

    const rows = await all(
      `
      SELECT
        COALESCE(area, 'Unspecified') AS area,
        status,
        COUNT(*) AS count
      FROM audits
      WHERE company_id = ?
      GROUP BY COALESCE(area, 'Unspecified'), status
      ORDER BY area ASC
    `,
      [companyId]
    );

    res.json({ rows });
  } catch (err) {
    console.error("GET /audits/summary/by-area error:", err);
    res.status(500).json({ error: "Failed to fetch chart data" });
  }
});

// ----------------- create -----------------
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

    console.log("✅ POST /audits created:", created);
    res.status(201).json({ audit: created });
  } catch (err) {
    console.error("❌ POST /audits error:", err.message, err);
    res
      .status(500)
      .json({ error: "Failed to create audit: " + err.message });
  }
});

// ----------------- update -----------------
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
    const standard =
      body.standard !== undefined ? body.standard : existing.standard;
    const section =
      body.section !== undefined ? body.section : existing.section;
    const auditor =
      body.auditor !== undefined ? body.auditor : existing.auditor;
    const audit_date =
      body.audit_date !== undefined ? body.audit_date : existing.audit_date;
    const status =
      body.status !== undefined ? body.status : existing.status;
    const severity =
      body.severity !== undefined ? body.severity : existing.severity;
    const due_date =
      body.due_date !== undefined ? body.due_date : existing.due_date;
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

// ----------------- delete -----------------
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

    await run("DELETE FROM audits WHERE id = ? AND company_id = ?", [
      id,
      companyId
    ]);

    res.status(204).send();
  } catch (err) {
    console.error("DELETE /audits/:id error:", err);
    res.status(500).json({ error: "Failed to delete audit" });
  }
});

module.exports = router;