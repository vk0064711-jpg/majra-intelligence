// server/routes/training.js
// Employee training records (SQLite per company)

"use strict";

const express = require("express");
const router = express.Router();

const { run, all, get } = require("../db");
const auth = require("../middleware/auth");

// -------------------------------------
// Helper: get company id from JWT user
// -------------------------------------
function getCompanyIdFromReq(req) {
  if (!req.user) return null;
  if (req.user.company_id) return req.user.company_id;
  if (req.user.companyId) return req.user.companyId;
  return null;
}

// -------------------------------------
// Helper: fetch one record for this company
// -------------------------------------
async function getTrainingForCompany(id, companyId) {
  return get(
    "SELECT * FROM training_records WHERE id = ? AND company_id = ?",
    [id, companyId]
  );
}

// -------------------------------------
// GET /api/training
// Optional query: ?status=Completed&department=Production
// -------------------------------------
router.get("/", auth, async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res
        .status(500)
        .json({ error: "Current user has no company assigned" });
    }

    const status = (req.query.status || "").trim();
    const department = (req.query.department || "").trim();

    let sql = "SELECT * FROM training_records WHERE company_id = ?";
    const params = [companyId];

    if (status) {
      sql += " AND status = ?";
      params.push(status);
    }
    if (department) {
      sql += " AND department = ?";
      params.push(department);
    }

    sql += " ORDER BY due_date ASC, employee_name ASC";

    const trainingRecords = await all(sql, params);
    res.json({ trainingRecords });
  } catch (err) {
    console.error("GET /training error:", err);
    res.status(500).json({ error: "Failed to fetch training records" });
  }
});

// -------------------------------------
// GET /api/training/stats
// Returns basic dashboard stats
// { total, completed, planned, overdue, due_30_days }
// -------------------------------------
router.get("/stats", auth, async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res
        .status(500)
        .json({ error: "Current user has no company assigned" });
    }

    // total records
    const totalRow = await get(
      "SELECT COUNT(*) AS cnt FROM training_records WHERE company_id = ?",
      [companyId]
    );

    // completed
    const completedRow = await get(
      "SELECT COUNT(*) AS cnt FROM training_records WHERE company_id = ? AND status = 'Completed'",
      [companyId]
    );

    // planned/in progress
    const plannedRow = await get(
      "SELECT COUNT(*) AS cnt FROM training_records WHERE company_id = ? AND status IN ('Planned','In progress')",
      [companyId]
    );

    // overdue (due_date < today AND status != Completed)
    const today = new Date();
    const toYMD = (d) =>
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0");

    const todayStr = toYMD(today);

    const overdueRow = await get(
      "SELECT COUNT(*) AS cnt FROM training_records WHERE company_id = ? AND status != 'Completed' AND due_date IS NOT NULL AND due_date < ?",
      [companyId, todayStr]
    );

    // due in next 30 days (and not completed)
    const plus30 = new Date();
    plus30.setDate(today.getDate() + 30);
    const plus30Str = toYMD(plus30);

    const dueSoonRow = await get(
      "SELECT COUNT(*) AS cnt FROM training_records WHERE company_id = ? AND status != 'Completed' AND due_date >= ? AND due_date <= ?",
      [companyId, todayStr, plus30Str]
    );

    res.json({
      total: totalRow ? totalRow.cnt || 0 : 0,
      completed: completedRow ? completedRow.cnt || 0 : 0,
      planned: plannedRow ? plannedRow.cnt || 0 : 0,
      overdue: overdueRow ? overdueRow.cnt || 0 : 0,
      due_30_days: dueSoonRow ? dueSoonRow.cnt || 0 : 0
    });
  } catch (err) {
    console.error("GET /training/stats error:", err);
    res.status(500).json({ error: "Failed to fetch training stats" });
  }
});

// -------------------------------------
// POST /api/training
// Create new record
// -------------------------------------
router.post("/", auth, async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res
        .status(500)
        .json({ error: "Current user has no company assigned" });
    }

    const body = req.body || {};

    const employee_name = (body.employee_name || "").trim();
    const training_topic = (body.training_topic || "").trim();

    if (!employee_name || !training_topic) {
      return res.status(400).json({
        error: "Employee name and training topic are required"
      });
    }

    const employee_email = body.employee_email || "";
    const job_title = body.job_title || "";
    const department = body.department || "";
    const training_type = body.training_type || "";
    const provider = body.provider || "";
    const status = body.status || "Planned";
    const due_date = body.due_date || "";
    const completion_date = body.completion_date || "";
    const validity_months =
      body.validity_months != null ? body.validity_months : null;
    const next_review_date = body.next_review_date || "";
    const certificate_location = body.certificate_location || "";
    const notes = body.notes || "";

    const result = await run(
      `INSERT INTO training_records (
         company_id,
         employee_name,
         employee_email,
         job_title,
         department,
         training_topic,
         training_type,
         provider,
         status,
         due_date,
         completion_date,
         validity_months,
         next_review_date,
         certificate_location,
         notes
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        companyId,
        employee_name,
        employee_email,
        job_title,
        department,
        training_topic,
        training_type,
        provider,
        status,
        due_date,
        completion_date,
        validity_months,
        next_review_date,
        certificate_location,
        notes
      ]
    );

    const created = await get(
      "SELECT * FROM training_records WHERE id = ? AND company_id = ?",
      [result.lastID, companyId]
    );

    res.status(201).json({ training: created });
  } catch (err) {
    console.error("POST /training error:", err);
    res.status(500).json({ error: "Failed to create training record" });
  }
});

// -------------------------------------
// PATCH /api/training/:id
// Update record
// -------------------------------------
router.patch("/:id", auth, async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res
        .status(500)
        .json({ error: "Current user has no company assigned" });
    }

    const id = req.params.id;
    const existing = await getTrainingForCompany(id, companyId);
    if (!existing) {
      return res.status(404).json({ error: "Training record not found" });
    }

    const body = req.body || {};

    const employee_name =
      body.employee_name != null
        ? body.employee_name
        : existing.employee_name;
    const employee_email =
      body.employee_email != null
        ? body.employee_email
        : existing.employee_email;
    const job_title =
      body.job_title != null ? body.job_title : existing.job_title;
    const department =
      body.department != null ? body.department : existing.department;
    const training_topic =
      body.training_topic != null
        ? body.training_topic
        : existing.training_topic;
    const training_type =
      body.training_type != null
        ? body.training_type
        : existing.training_type;
    const provider =
      body.provider != null ? body.provider : existing.provider;
    const status = body.status != null ? body.status : existing.status;
    const due_date =
      body.due_date != null ? body.due_date : existing.due_date;
    const completion_date =
      body.completion_date != null
        ? body.completion_date
        : existing.completion_date;
    const validity_months =
      body.validity_months != null
        ? body.validity_months
        : existing.validity_months;
    const next_review_date =
      body.next_review_date != null
        ? body.next_review_date
        : existing.next_review_date;
    const certificate_location =
      body.certificate_location != null
        ? body.certificate_location
        : existing.certificate_location;
    const notes = body.notes != null ? body.notes : existing.notes;

    await run(
      `UPDATE training_records
       SET employee_name = ?,
           employee_email = ?,
           job_title = ?,
           department = ?,
           training_topic = ?,
           training_type = ?,
           provider = ?,
           status = ?,
           due_date = ?,
           completion_date = ?,
           validity_months = ?,
           next_review_date = ?,
           certificate_location = ?,
           notes = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND company_id = ?
      `,
      [
        employee_name,
        employee_email,
        job_title,
        department,
        training_topic,
        training_type,
        provider,
        status,
        due_date,
        completion_date,
        validity_months,
        next_review_date,
        certificate_location,
        notes,
        id,
        companyId
      ]
    );

    const updated = await getTrainingForCompany(id, companyId);
    res.json({ training: updated });
  } catch (err) {
    console.error("PATCH /training/:id error:", err);
    res.status(500).json({ error: "Failed to update training record" });
  }
});

// -------------------------------------
// DELETE /api/training/:id
// -------------------------------------
router.delete("/:id", auth, async (req, res) => {
  try {
    const companyId = getCompanyIdFromReq(req);
    if (!companyId) {
      return res
        .status(500)
        .json({ error: "Current user has no company assigned" });
    }

    const id = req.params.id;
    const existing = await getTrainingForCompany(id, companyId);
    if (!existing) {
      return res.status(404).json({ error: "Training record not found" });
    }

    await run(
      "DELETE FROM training_records WHERE id = ? AND company_id = ?",
      [id, companyId]
    );

    res.status(204).send();
  } catch (err) {
    console.error("DELETE /training/:id error:", err);
    res.status(500).json({ error: "Failed to delete training record" });
  }
});

module.exports = router;