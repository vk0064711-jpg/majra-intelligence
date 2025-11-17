// public/scripts/audits.js
// Full audit UI module – save, edit, delete, filter, and dashboard counters

(function () {
  "use strict";

  // -----------------------------------
  // Small helpers
  // -----------------------------------
  function byId(id) {
    return document.getElementById(id);
  }

  function inputVal(id) {
    var el = byId(id);
    return el ? el.value.trim() : "";
  }

  function setText(id, value) {
    var el = byId(id);
    if (el) el.textContent = value;
  }

  function setMessage(msg, isError) {
    var el = byId("audits-message");
    if (!el) return;
    el.textContent = msg || "";
    el.style.color = isError ? "#b91c1c" : "#166534"; // red / green
  }

  // Current filter for “Filter by status” buttons
  var currentFilter = "all";

  // -----------------------------------
  // MAIN LOAD FUNCTION (exported)
  // -----------------------------------
  async function loadAudits() {
    var filter = currentFilter;
    if (filter === "all") filter = "";

    try {
      var audits = [];
      if (typeof window.fetchAudits === "function") {
        audits = await window.fetchAudits(filter);
      }
      renderAuditTable(audits || []);
      updateAuditDashboardCounters();
    } catch (err) {
      console.error("Error loading audits:", err);
      setMessage("Failed to load audits: " + err.message, true);
    }
  }

  // -----------------------------------
  // SAVE (CREATE / UPDATE)
  // -----------------------------------
  async function handleAuditFormSubmit(e) {
    e.preventDefault();
    setMessage("");

    var id = inputVal("audit-id");
    var title = inputVal("audit-title");

    if (!title) {
      setMessage("Audit title is required", true);
      return;
    }

    var payload = {
      title: title,
      area: inputVal("audit-area"),
      standard: inputVal("audit-standard"),
      section: inputVal("audit-section"),
      auditor: inputVal("audit-auditor"),
      audit_date: byId("audit-date") ? byId("audit-date").value : "",
      status: byId("audit-status") ? byId("audit-status").value : "open",
      severity: byId("audit-severity") ? byId("audit-severity").value : "",
      due_date: byId("audit-due-date") ? byId("audit-due-date").value : "",
      responsible_person: inputVal("audit-responsible"),
      findings: byId("audit-findings") ? byId("audit-findings").value.trim() : "",
      root_cause: byId("audit-root-cause") ? byId("audit-root-cause").value.trim() : "",
      corrective_action: byId("audit-corrective") ? byId("audit-corrective").value.trim() : "",
      preventive_action: byId("audit-preventive") ? byId("audit-preventive").value.trim() : "",
      evidence_notes: ""
    };

    try {
      var savedAudit = null;

      if (id) {
        if (typeof window.updateAudit !== "function") {
          throw new Error("updateAudit API not available");
        }
        savedAudit = await window.updateAudit(id, payload);
      } else {
        if (typeof window.createAudit !== "function") {
          throw new Error("createAudit API not available");
        }
        savedAudit = await window.createAudit(payload);
      }

      if (!savedAudit) {
        setMessage("Failed to save audit (no data returned)", true);
        return;
      }

      clearAuditForm();
      setMessage(id ? "Audit updated." : "Audit saved.");
      loadAudits();
    } catch (err) {
      console.error("Error saving audit:", err);
      setMessage("Failed to save audit: " + err.message, true);
    }
  }

  // -----------------------------------
  // CLEAR FORM
  // -----------------------------------
  function clearAuditForm() {
    var form = byId("audit-form");
    if (form) form.reset();

    var idEl = byId("audit-id");
    if (idEl) idEl.value = "";
  }

  // -----------------------------------
  // RENDER TABLE
  // -----------------------------------
  function renderAuditTable(audits) {
    var tbody = byId("audits-table-body");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (!audits.length) {
      var emptyTr = document.createElement("tr");
      var emptyTd = document.createElement("td");
      emptyTd.colSpan = 8;
      emptyTd.textContent = "No audits recorded yet.";
      emptyTd.style.textAlign = "center";
      emptyTd.style.color = "#6b7280";
      emptyTr.appendChild(emptyTd);
      tbody.appendChild(emptyTr);
      return;
    }

    audits.forEach(function (a) {
      var tr = document.createElement("tr");

      var dateTd = document.createElement("td");
      dateTd.textContent = a.audit_date || "";
      tr.appendChild(dateTd);

      var titleTd = document.createElement("td");
      titleTd.textContent = a.title || "";
      tr.appendChild(titleTd);

      var areaTd = document.createElement("td");
      areaTd.textContent = a.area || "";
      tr.appendChild(areaTd);

      var stdTd = document.createElement("td");
      var stdText = a.standard || "";
      if (a.section) {
        stdText += (stdText ? " – " : "") + a.section;
      }
      stdTd.textContent = stdText;
      tr.appendChild(stdTd);

      var sevTd = document.createElement("td");
      sevTd.textContent = a.severity || "";
      tr.appendChild(sevTd);

      var statusTd = document.createElement("td");
      statusTd.textContent = a.status || "";
      tr.appendChild(statusTd);

      var dueTd = document.createElement("td");
      dueTd.textContent = a.due_date || "";
      tr.appendChild(dueTd);

      var actionsTd = document.createElement("td");

      var editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn small";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", function () {
        fillFormForEdit(a);
      });

      var delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn small danger";
      delBtn.style.marginLeft = "4px";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", function () {
        deleteAuditConfirm(a.id);
      });

      actionsTd.appendChild(editBtn);
      actionsTd.appendChild(delBtn);
      tr.appendChild(actionsTd);

      tbody.appendChild(tr);
    });
  }

  // -----------------------------------
  // EDIT (FILL FORM)
  // -----------------------------------
  function fillFormForEdit(a) {
    if (!a) return;

    if (byId("audit-id")) byId("audit-id").value = a.id;
    if (byId("audit-title")) byId("audit-title").value = a.title || "";
    if (byId("audit-area")) byId("audit-area").value = a.area || "";
    if (byId("audit-standard")) byId("audit-standard").value = a.standard || "";
    if (byId("audit-section")) byId("audit-section").value = a.section || "";
    if (byId("audit-auditor")) byId("audit-auditor").value = a.auditor || "";
    if (byId("audit-date")) byId("audit-date").value = a.audit_date || "";
    if (byId("audit-status")) byId("audit-status").value = a.status || "open";
    if (byId("audit-severity")) byId("audit-severity").value = a.severity || "";
    if (byId("audit-due-date")) byId("audit-due-date").value = a.due_date || "";
    if (byId("audit-responsible")) byId("audit-responsible").value =
      a.responsible_person || "";
    if (byId("audit-findings")) byId("audit-findings").value = a.findings || "";
    if (byId("audit-root-cause")) byId("audit-root-cause").value = a.root_cause || "";
    if (byId("audit-corrective")) byId("audit-corrective").value =
      a.corrective_action || "";
    if (byId("audit-preventive")) byId("audit-preventive").value =
      a.preventive_action || "";

    setMessage("Editing audit: " + (a.title || ""));
  }

  // -----------------------------------
  // DELETE
  // -----------------------------------
  async function deleteAuditConfirm(id) {
    if (!id) return;
    if (!window.confirm("Delete this audit?")) return;

    try {
      if (typeof window.deleteAudit !== "function") {
        throw new Error("deleteAudit API not available");
      }
      await window.deleteAudit(id);
      setMessage("Audit deleted.");
      loadAudits();
    } catch (err) {
      console.error("Error deleting audit:", err);
      setMessage("Failed to delete audit: " + err.message, true);
    }
  }

  // -----------------------------------
  // DASHBOARD COUNTERS
  // -----------------------------------
  async function updateAuditDashboardCounters() {
    if (typeof window.fetchAuditStats !== "function") return;

    try {
      var stats = await window.fetchAuditStats();
      stats = stats || {};

      setText("dashboard-open-audits-count", stats.open || 0);
      setText("audits-due-soon-count", stats.due_7_days || 0);
      setText("audits-closed-count", stats.closed || 0);
    } catch (err) {
      console.warn("Failed to load audit stats:", err);
    }
  }

  // -----------------------------------
  // INIT: wire events
  // -----------------------------------
  document.addEventListener("DOMContentLoaded", function () {
    var form = byId("audit-form");
    if (!form) {
      return; // audits view not on this page
    }

    // Form submit
    form.addEventListener("submit", handleAuditFormSubmit);

    // Clear button
    var resetBtn = byId("audit-reset-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        clearAuditForm();
        setMessage("");
      });
    }

    // Filter buttons
    var filterButtons = document.querySelectorAll("[data-audit-filter]");
    for (var i = 0; i < filterButtons.length; i++) {
      filterButtons[i].addEventListener("click", function (e) {
        var val = e.currentTarget.getAttribute("data-audit-filter") || "all";
        currentFilter = val;
        loadAudits();
      });
    }

    // Initial load
    loadAudits();
  });

  // -----------------------------------
  // Expose to app.js (after login)
// -----------------------------------
  window.MajraAudits = {
    loadAudits: loadAudits
  };
})();