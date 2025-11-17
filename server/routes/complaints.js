// server/routes/complaints.js
//
// All complaint API endpoints for Majra Intelligence
// - List complaints
// - Create complaint
// - Update status
// - Save investigation + letter
// - Delete complaint
// - Simple stats for dashboard
//

const express = require("express");
const router = express.Router();

const { run, get, all } = require("../db");
const auth = require("../middleware/auth");

// ===============================
// Helpers
// ===============================

function mapComplaintRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    date_received: row.date_received,
    customer_name: row.customer_name,
    product_name: row.product_name,
    complaint_type: row.complaint_type,
    contamination_type: row.contamination_type,
    description: row.description,
    status: row.status,
    root_cause: row.root_cause,
    corrective_action: row.corrective_action,
    preventive_action: row.preventive_action,
    outcome: row.outcome,
    letter_body: row.letter_body
  };
}

// ===============================
// GET /complaints/stats  (put BEFORE :id routes)
// ===============================
router.get("/stats", auth, async (req, res) => {
  const companyId = req.user.companyId;

  try {
    const statusCounts = await all(
      `SELECT status, COUNT(*) AS count
       FROM complaints
       WHERE company_id = ?
       GROUP BY status`,
      [companyId]
    );

    const topTypes = await all(
      `SELECT complaint_type AS type, COUNT(*) AS count
       FROM complaints
       WHERE company_id = ?
         AND complaint_type IS NOT NULL
         AND TRIM(complaint_type) <> ''
       GROUP BY complaint_type
       ORDER BY count DESC
       LIMIT 5`,
      [companyId]
    );

    res.json({ statusCounts, topTypes });
  } catch (err) {
    console.error("GET /complaints/stats error:", err);
    res.status(500).json({ error: "Failed to get complaint stats" });
  }
});

// ===============================
// GET /complaints  (list for company)
// ===============================
router.get("/", auth, async (req, res) => {
  const companyId = req.user.companyId;

  try {
    const rows = await all(
      `SELECT id,
              date_received,
              customer_name,
              product_name,
              complaint_type,
              contamination_type,
              description,
              status,
              root_cause,
              corrective_action,
              preventive_action,
              outcome,
              letter_body
       FROM complaints
       WHERE company_id = ?
       ORDER BY created_at DESC`,
      [companyId]
    );

    res.json({
      complaints: rows.map(mapComplaintRow)
    });
  } catch (err) {
    console.error("GET /complaints error:", err);
    res.status(500).json({ error: "Failed to load complaints" });
  }
});

// ===============================
// POST /complaints  (create)
// ===============================
router.post("/", auth, async (req, res) => {
  const companyId = req.user.companyId;

  const {
    date_received,
    customer_name,
    product_name,
    complaint_type,
    contamination_type,
    description
  } = req.body || {};

  if (!customer_name || !product_name || !description) {
    return res.status(400).json({
      error:
        "Missing required fields (customer name, product / item, description)."
    });
  }

  try {
    const result = await run(
      `INSERT INTO complaints
         (company_id,
          date_received,
          customer_name,
          product_name,
          complaint_type,
          contamination_type,
          description,
          status)
       VALUES
         (?, ?, ?, ?, ?, ?, ?, 'open')`,
      [
        companyId,
        date_received || null,
        customer_name,
        product_name,
        complaint_type || null,
        contamination_type || null,
        description
      ]
    );

    const row = await get(
      `SELECT id,
              date_received,
              customer_name,
              product_name,
              complaint_type,
              contamination_type,
              description,
              status,
              root_cause,
              corrective_action,
              preventive_action,
              outcome,
              letter_body
       FROM complaints
       WHERE id = ?`,
      [result.lastID]
    );

    res.json({ complaint: mapComplaintRow(row) });
  } catch (err) {
    console.error("POST /complaints error:", err);
    res.status(500).json({ error: "Failed to create complaint" });
  }
});

// ===============================
// Shared handlers so PUT + PATCH work
// ===============================
async function handleStatusUpdate(req, res) {
  const companyId = req.user.companyId;
  const complaintId = req.params.id;
  const { status } = req.body || {};

  if (!status) {
    return res.status(400).json({ error: "Status is required." });
  }

  try {
    await run(
      `UPDATE complaints
       SET status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND company_id = ?`,
      [status, complaintId, companyId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Status update error:", err);
    res.status(500).json({ error: "Failed to update complaint status" });
  }
}

async function handleInvestigationUpdate(req, res) {
  const companyId = req.user.companyId;
  const complaintId = req.params.id;

  const {
    root_cause,
    corrective_action,
    preventive_action,
    outcome,
    letter_body
  } = req.body || {};

  try {
    await run(
      `UPDATE complaints
       SET root_cause = ?,
           corrective_action = ?,
           preventive_action = ?,
           outcome = ?,
           letter_body = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND company_id = ?`,
      [
        root_cause || null,
        corrective_action || null,
        preventive_action || null,
        outcome || null,
        letter_body || null,
        complaintId,
        companyId
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Investigation update error:", err);
    res.status(500).json({ error: "Failed to save investigation" });
  }
}

// ===============================
// PATCH/PUT /complaints/:id/status
// ===============================
router.patch("/:id/status", auth, handleStatusUpdate);
router.put("/:id/status", auth, handleStatusUpdate); // supports older clients

// ===============================
// PATCH/PUT /complaints/:id/investigation
// ===============================
router.patch("/:id/investigation", auth, handleInvestigationUpdate);
router.put("/:id/investigation", auth, handleInvestigationUpdate); // supports older clients

// ===============================
// DELETE /complaints/:id
// ===============================
router.delete("/:id", auth, async (req, res) => {
  const companyId = req.user.companyId;
  const complaintId = req.params.id;

  try {
    await run(
      `DELETE FROM complaints
       WHERE id = ? AND company_id = ?`,
      [complaintId, companyId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /complaints/:id error:", err);
    res.status(500).json({ error: "Failed to delete complaint" });
  }
});

module.exports = router;