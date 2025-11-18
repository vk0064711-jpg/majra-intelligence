// server/db.js
// Central PostgreSQL (Neon) database helper for Majra Intelligence

const { Pool } = require("pg");
require("dotenv").config();

if (!process.env.POSTGRES_URL) {
  console.error("❌ POSTGRES_URL is missing in .env");
  process.exit(1);
}

// Create a connection pool to Neon Postgres
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// ----------------------------------------
// Helper: convert "?" placeholders -> $1, $2, ...
// so your existing SQL in routes still works.
// ----------------------------------------
function convertPlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => {
    index += 1;
    return "$" + index;
  });
}

// ----------------------------------------
// Helper wrappers
// ----------------------------------------

// For INSERT / UPDATE / DELETE or any statement
async function run(sql, params = []) {
  try {
    const originalSql = sql;
    sql = convertPlaceholders(sql);

    // If it's an INSERT without RETURNING, add RETURNING id
    // so we can emulate sqlite's this.lastID
    const isInsert = /^\s*insert/i.test(sql);
    const hasReturning = /\breturning\b/i.test(sql);

    let result;
    if (isInsert && !hasReturning) {
      // add RETURNING id
      sql = sql.replace(/;?\s*$/i, " RETURNING id;");
      result = await pool.query(sql, params);
      if (result.rows && result.rows[0] && result.rows[0].id != null) {
        result.lastID = result.rows[0].id;
      }
    } else {
      result = await pool.query(sql, params);
    }

    // emulate sqlite "changes"
    result.changes = result.rowCount;
    return result;
  } catch (err) {
    console.error("SQL run error:", err, "\nSQL:", sql);
    throw err;
  }
}

// For single row SELECT
async function get(sql, params = []) {
  try {
    const originalSql = sql;
    sql = convertPlaceholders(sql);
    const result = await pool.query(sql, params);
    return result.rows[0] || null;
  } catch (err) {
    console.error("SQL get error:", err, "\nSQL:", sql);
    throw err;
  }
}

// For multiple rows SELECT
async function all(sql, params = []) {
  try {
    const originalSql = sql;
    sql = convertPlaceholders(sql);
    const result = await pool.query(sql, params);
    return result.rows;
  } catch (err) {
    console.error("SQL all error:", err, "\nSQL:", sql);
    throw err;
  }
}

// ----------------------------------------
// Initialise schema (Postgres version)
// ----------------------------------------

async function init() {
  try {
    // -----------------------------
    // COMPANIES
    // -----------------------------
    await run(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // -----------------------------
    // USERS
    // -----------------------------
    await run(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id),
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin',
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // -----------------------------
    // COMPLAINTS
    // -----------------------------
    await run(`
      CREATE TABLE IF NOT EXISTS complaints (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id),

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

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
      );
    `);

    // -----------------------------
    // SUPPLIERS
    // -----------------------------
    await run(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id),

        name TEXT NOT NULL,
        material TEXT,
        certificate_type TEXT,
        certificate_expiry TEXT,
        risk_level TEXT,
        status TEXT,
        notes TEXT,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
      );
    `);

    // -----------------------------
    // DOCUMENTS (Document Control)
    // -----------------------------
    await run(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id),

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

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
      );
    `);

    // -----------------------------
    // TRAINING RECORDS
    // -----------------------------
    await run(`
      CREATE TABLE IF NOT EXISTS training_records (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id),

        employee_name TEXT NOT NULL,
        employee_email TEXT,
        job_title TEXT,
        department TEXT,
        training_topic TEXT NOT NULL,
        training_type TEXT,
        provider TEXT,
        status TEXT,
        due_date TEXT,
        completion_date TEXT,
        validity_months INTEGER,
        next_review_date TEXT,
        certificate_location TEXT,
        notes TEXT,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
      );
    `);

    // -----------------------------
    // AUDITS & GMP INSPECTIONS
    // -----------------------------
    await run(`
      CREATE TABLE IF NOT EXISTS audits (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id),

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

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("✅ Database initialised successfully (Postgres / Neon).");
  } catch (err) {
    console.error("❌ Error initialising database:", err);
    throw err;
  }
}

module.exports = {
  pool,
  run,
  get,
  all,
  init
};