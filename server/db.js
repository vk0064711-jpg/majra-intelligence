// server/db.js
// Central SQLite database helper for Majra Intelligence

const sqlite3 = require("sqlite3").verbose();
const path = require("path");
require("dotenv").config();

const dbPath = path.join(__dirname, process.env.DB_FILE || "majra.sqlite");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("❌ Failed to connect to SQLite database:", err);
  } else {
    console.log("✅ Connected to SQLite database:", dbPath);
  }
});

// ----------------------------------------
// Helper wrappers
// ----------------------------------------

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this); // this.lastID, this.changes
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

// ----------------------------------------
// Initialise schema
// ----------------------------------------

async function init() {
  try {
    // -----------------------------
    // COMPANIES
    // -----------------------------
    await run(`
      CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // -----------------------------
    // USERS
    // -----------------------------
    await run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin',
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id)
      );
    `);

    // -----------------------------
    // COMPLAINTS
    // -----------------------------
    await run(`
      CREATE TABLE IF NOT EXISTS complaints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,

        date_received TEXT,
        customer_name TEXT,
        product_name TEXT,
        complaint_type TEXT,
        contamination_type TEXT,
        description TEXT,

        status TEXT DEFAULT 'open',

        root_cause TEXT,
        corrective_action TEXT,
        preventive_action TEXT,
        outcome TEXT,

        letter_body TEXT,

        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME,

        FOREIGN KEY (company_id) REFERENCES companies(id)
      );
    `);

    // -----------------------------
    // SUPPLIERS
    // -----------------------------
    await run(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,

        name TEXT NOT NULL,
        material TEXT,
        certificate_type TEXT,
        certificate_expiry TEXT,
        risk_level TEXT,
        status TEXT,
        notes TEXT,

        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME,

        FOREIGN KEY (company_id) REFERENCES companies(id)
      );
    `);

    // -----------------------------
    // DOCUMENTS (Document Control)
    // -----------------------------
    await run(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,

        code TEXT,             -- e.g. DOC-001
        title TEXT NOT NULL,   -- Procedure name
        department TEXT,       -- Production, QA etc.
        process_area TEXT,     -- Mixing, Packing, etc.

        standard TEXT,         -- SALSA, BRCGS Food, ISO 22000
        clause TEXT,           -- 1.7, 4.11 etc.

        doc_type TEXT,         -- Policy, Procedure, WI, Form, Record
        version TEXT,          -- e.g. 1.0, 2.3
        issue_date TEXT,       -- YYYY-MM-DD
        review_date TEXT,      -- YYYY-MM-DD

        status TEXT,           -- Draft, Active, Obsolete
        owner TEXT,
        location TEXT,
        notes TEXT,

        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME,

        FOREIGN KEY (company_id) REFERENCES companies(id)
      );
    `);

    // -----------------------------
    // TRAINING RECORDS
    // -----------------------------
    await run(`
      CREATE TABLE IF NOT EXISTS training_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,

        employee_name TEXT NOT NULL,        -- 1
        employee_email TEXT,                -- 2
        job_title TEXT,                     -- 3
        department TEXT,                    -- 4
        training_topic TEXT NOT NULL,       -- 5
        training_type TEXT,                 -- 6
        provider TEXT,                      -- 7
        status TEXT,                        -- 8
        due_date TEXT,                      -- 9
        completion_date TEXT,               -- 10
        validity_months INTEGER,            -- 11
        next_review_date TEXT,              -- 12
        certificate_location TEXT,          -- 13
        notes TEXT,                         -- 14

        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME,

        FOREIGN KEY (company_id) REFERENCES companies(id)
      );
    `);

    // -----------------------------
    // AUDITS (GMP / Internal audits)
    // -----------------------------
    await run(`
      CREATE TABLE IF NOT EXISTS audits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,

        title TEXT NOT NULL,
        area TEXT,
        standard TEXT,
        section TEXT,
        auditor TEXT,

        audit_date TEXT,
        status TEXT DEFAULT 'open',
        severity TEXT,
        due_date TEXT,
        responsible_person TEXT,

        findings TEXT,
        root_cause TEXT,
        corrective_action TEXT,
        preventive_action TEXT,

        evidence_notes TEXT,

        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME,

        FOREIGN KEY (company_id) REFERENCES companies(id)
      );
    `);

    console.log("✅ Database initialised successfully.");
  } catch (err) {
    console.error("❌ Error initialising database:", err);
    throw err;
  }
}

module.exports = {
  db,
  run,
  get,
  all,
  init,
};