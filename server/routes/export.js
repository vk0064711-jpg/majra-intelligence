// server/routes/export.js
const express = require('express');
const { all } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// protect all export routes
router.use(auth);

/**
 * Helper to get all complaints for this company (non-deleted)
 */
async function getCompanyComplaints(companyId) {
  return all(
    `
    SELECT *
    FROM complaints
    WHERE company_id = ?
      AND (deleted_at IS NULL OR deleted_at = '')
    ORDER BY date_received DESC, created_at DESC, id DESC
    `,
    [companyId]
  );
}

/**
 * GET /export/complaints/json
 * Simple JSON backup
 */
router.get('/complaints/json', async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const rows = await getCompanyComplaints(companyId);

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="majra-complaints.json"'
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /export/complaints/json error:', err);
    res.status(500).json({ error: 'Failed to export complaints JSON' });
  }
});

/**
 * GET /export/complaints/csv
 * CSV backup – Excel friendly
 */
router.get('/complaints/csv', async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const rows = await getCompanyComplaints(companyId);

    const headers = [
      'id',
      'date_received',
      'customer_name',
      'product_name',
      'complaint_type',
      'contamination_type',
      'description',
      'status',
      'root_cause',
      'corrective_action',
      'preventive_action',
      'outcome',
      'created_at',
      'updated_at',
    ];

    function escapeCsv(val) {
      if (val === null || val === undefined) return '';
      const s = String(val);
      if (/[",\n]/.test(s)) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }

    const lines = [];
    lines.push(headers.join(','));

    rows.forEach((row) => {
      const line = headers
        .map((h) => escapeCsv(row[h]))
        .join(',');
      lines.push(line);
    });

    const csv = lines.join('\n');

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="majra-complaints.csv"'
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send(csv);
  } catch (err) {
    console.error('GET /export/complaints/csv error:', err);
    res.status(500).json({ error: 'Failed to export complaints CSV' });
  }
});

/**
 * GET /export/complaints/word
 * Word-friendly HTML report (logo + table)
 */
router.get('/complaints/word', async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const rows = await getCompanyComplaints(companyId);

    let html = '';
    html += '<html><head><meta charset="UTF-8"><title>Majra Complaints Report</title></head><body>';
    html += '<h2 style="font-family:Calibri,Arial,sans-serif;">Majra Intelligence – Complaints Report</h2>';
    html += '<p style="font-family:Calibri,Arial,sans-serif;font-size:12pt;">Food Safety, Quality &amp; Compliance Assistant</p>';
    html += '<hr/>';

    html += '<table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:11pt;">';
    html += '<tr style="background:#e5e7eb;font-weight:bold;">';
    const cols = [
      'ID',
      'Date',
      'Customer',
      'Product',
      'Type',
      'Contamination',
      'Status',
      'Root cause',
      'Corrective action',
      'Preventive action',
      'Outcome',
    ];
    cols.forEach((c) => {
      html += '<td>' + c + '</td>';
    });
    html += '</tr>';

    rows.forEach((r) => {
      html += '<tr>';
      html += '<td>' + (r.id || '') + '</td>';
      html += '<td>' + (r.date_received || '') + '</td>';
      html += '<td>' + (r.customer_name || '') + '</td>';
      html += '<td>' + (r.product_name || '') + '</td>';
      html += '<td>' + (r.complaint_type || '') + '</td>';
      html += '<td>' + (r.contamination_type || '') + '</td>';
      html += '<td>' + (r.status || '') + '</td>';
      html += '<td>' + (r.root_cause || '') + '</td>';
      html += '<td>' + (r.corrective_action || '') + '</td>';
      html += '<td>' + (r.preventive_action || '') + '</td>';
      html += '<td>' + (r.outcome || '') + '</td>';
      html += '</tr>';
    });

    html += '</table>';
    html += '<hr/>';
    html += '<p style="font-family:Calibri,Arial,sans-serif;font-size:10pt;">© 2025 Majra Intelligence – Powered by Vipin Sharma</p>';
    html += '</body></html>';

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="majra-complaints-report.doc"'
    );
    res.setHeader('Content-Type', 'application/msword');
    res.send(html);
  } catch (err) {
    console.error('GET /export/complaints/word error:', err);
    res.status(500).json({ error: 'Failed to export complaints Word report' });
  }
});

module.exports = router;