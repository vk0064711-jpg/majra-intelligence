// public/scripts/audits.js
// Audits & GMP Inspections module for Majra Intelligence

(function () {
  "use strict";

  console.log("[MajraAudits] audits.js loaded");

  var MajraAudits = {};

  var auditForm;
  var msgEl;
  var tableBody;
  var resetBtn;
  var filterButtons;

  var openCountEl;
  var dueSoonCountEl;
  var closedCountEl;

  var hiddenIdInput;
  var currentFilter = ""; // "", "open", "in_progress", "closed"
  var currentAudits = [];

  // Chart
  var chartCanvas;
  var chartCtx;

  // -----------------------------
  // Helpers
  // -----------------------------
  function $(id) {
    return document.getElementById(id);
  }

  function formatDate(value) {
    if (!value) return "";
    // stored as yyyy-mm-dd already
    return value;
  }

  function setMessage(text, colour) {
    if (!msgEl) return;
    msgEl.textContent = text || "";
    msgEl.style.color = colour || "";
  }

  function getFormValue(id) {
    var el = $(id);
    return el ? (el.value || "").trim() : "";
  }

  function getFormData() {
    return {
      title: getFormValue("audit-title"),
      area: getFormValue("audit-area"),
      standard: getFormValue("audit-standard"),
      section: getFormValue("audit-section"),
      auditor: getFormValue("audit-auditor"),
      audit_date: $("audit-date") ? $("audit-date").value || "" : "",
      status: $("audit-status") ? $("audit-status").value || "open" : "open",
      severity: $("audit-severity") ? $("audit-severity").value || "" : "",
      due_date: $("audit-due-date") ? $("audit-due-date").value || "" : "",
      responsible_person: getFormValue("audit-responsible"),
      findings: getFormValue("audit-findings"),
      root_cause: getFormValue("audit-root-cause"),
      corrective_action: getFormValue("audit-corrective"),
      preventive_action: getFormValue("audit-preventive"),
      // Files are local only; store a free-text field on server
      evidence_notes: ""
    };
  }

  function fillFormFromAudit(audit) {
    if (!audit) return;

    if (hiddenIdInput) hiddenIdInput.value = audit.id || "";

    if ($("audit-title")) $("audit-title").value = audit.title || "";
    if ($("audit-area")) $("audit-area").value = audit.area || "";
    if ($("audit-standard")) $("audit-standard").value = audit.standard || "";
    if ($("audit-section")) $("audit-section").value = audit.section || "";
    if ($("audit-auditor")) $("audit-auditor").value = audit.auditor || "";
    if ($("audit-date")) $("audit-date").value = audit.audit_date || "";
    if ($("audit-status")) $("audit-status").value = audit.status || "open";
    if ($("audit-severity")) $("audit-severity").value = audit.severity || "";
    if ($("audit-due-date")) $("audit-due-date").value = audit.due_date || "";
    if ($("audit-responsible"))
      $("audit-responsible").value = audit.responsible_person || "";
    if ($("audit-findings")) $("audit-findings").value = audit.findings || "";
    if ($("audit-root-cause"))
      $("audit-root-cause").value = audit.root_cause || "";
    if ($("audit-corrective"))
      $("audit-corrective").value = audit.corrective_action || "";
    if ($("audit-preventive"))
      $("audit-preventive").value = audit.preventive_action || "";

    setMessage(
      "Audit loaded in form. You can update and click Save.",
      "#2563eb"
    );
  }

  function clearForm() {
    if (auditForm) auditForm.reset();
    if (hiddenIdInput) hiddenIdInput.value = "";
    setMessage("", "");
  }

  // -----------------------------
  // Render table & stats
  // -----------------------------
  function renderTable(audits) {
    currentAudits = Array.isArray(audits) ? audits : [];
    if (!tableBody) return;

    tableBody.innerHTML = "";

    if (!currentAudits.length) {
      var trEmpty = document.createElement("tr");
      var td = document.createElement("td");
      td.colSpan = 8;
      td.textContent = "No audits found for this filter.";
      td.style.textAlign = "center";
      td.style.color = "#6b7280";
      trEmpty.appendChild(td);
      tableBody.appendChild(trEmpty);

      updateChart(); // clear / show "no data"
      calculateScoresAndRender(); // also clears score section
      return;
    }

    currentAudits.forEach(function (audit) {
      var tr = document.createElement("tr");

      var tdDate = document.createElement("td");
      tdDate.textContent = formatDate(audit.audit_date);
      tr.appendChild(tdDate);

      var tdTitle = document.createElement("td");
      tdTitle.textContent = audit.title || "";
      tr.appendChild(tdTitle);

      var tdArea = document.createElement("td");
      tdArea.textContent = audit.area || "";
      tr.appendChild(tdArea);

      var tdStd = document.createElement("td");
      var stdSec = audit.standard || "";
      if (audit.section) {
        stdSec = stdSec ? stdSec + " / " + audit.section : audit.section;
      }
      tdStd.textContent = stdSec;
      tr.appendChild(tdStd);

      var tdSeverity = document.createElement("td");
      tdSeverity.textContent = audit.severity || "";
      tr.appendChild(tdSeverity);

      var tdStatus = document.createElement("td");
      tdStatus.textContent = audit.status || "";
      tr.appendChild(tdStatus);

      var tdDue = document.createElement("td");
      tdDue.textContent = formatDate(audit.due_date);
      tr.appendChild(tdDue);

      var tdActions = document.createElement("td");

      var editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.textContent = "Edit";
      editBtn.className = "btn subtle btn-small";
      editBtn.setAttribute("data-action", "edit");
      editBtn.setAttribute("data-id", audit.id);

      var delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.textContent = "Delete";
      delBtn.className = "btn subtle btn-small";
      delBtn.style.marginLeft = "4px";
      delBtn.setAttribute("data-action", "delete");
      delBtn.setAttribute("data-id", audit.id);

      tdActions.appendChild(editBtn);
      tdActions.appendChild(delBtn);
      tr.appendChild(tdActions);

      tableBody.appendChild(tr);
    });

    updateChart();
    calculateScoresAndRender();
  }

  async function refreshStats() {
    if (typeof window.fetchAuditStats !== "function") return;

    try {
      var stats = await window.fetchAuditStats();
      if (!stats) return;

      if (openCountEl) openCountEl.textContent = stats.open || 0;
      if (dueSoonCountEl) dueSoonCountEl.textContent = stats.due_7_days || 0;
      if (closedCountEl) closedCountEl.textContent = stats.closed || 0;
    } catch (err) {
      console.warn("fetchAuditStats error:", err);
    }
  }

  // -----------------------------
  // Chart by Area (Department)
  // -----------------------------
  function updateChart() {
    if (!chartCtx || !chartCanvas) return;

    var ctx = chartCtx;
    var canvas = chartCanvas;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!currentAudits || !currentAudits.length) {
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillStyle = "#6b7280";
      ctx.fillText("No audit data for chart.", 10, 20);
      return;
    }

    // Aggregate by area
    var byArea = {};
    currentAudits.forEach(function (a) {
      var area = (a.area || "Unspecified").trim() || "Unspecified";
      if (!byArea[area]) {
        byArea[area] = { total: 0, open: 0, closed: 0 };
      }
      byArea[area].total += 1;
      if ((a.status || "").toLowerCase() === "closed") {
        byArea[area].closed += 1;
      } else {
        byArea[area].open += 1;
      }
    });

    var areas = Object.keys(byArea);
    var maxValue = 0;
    areas.forEach(function (area) {
      if (byArea[area].total > maxValue) maxValue = byArea[area].total;
    });
    if (maxValue === 0) maxValue = 1;

    var paddingLeft = 40;
    var paddingBottom = 40;
    var paddingTop = 20;
    var width = canvas.width - paddingLeft - 20;
    var height = canvas.height - paddingTop - paddingBottom;

    var barWidth =
      areas.length > 0 ? Math.max(20, width / (areas.length * 1.5)) : 20;
    var gap = barWidth * 0.5;

    // Axes
    ctx.font = "11px system-ui, sans-serif";
    ctx.strokeStyle = "#9ca3af";
    ctx.fillStyle = "#4b5563";
    ctx.textAlign = "left";

    ctx.beginPath();
    ctx.moveTo(paddingLeft, paddingTop);
    ctx.lineTo(paddingLeft, paddingTop + height);
    ctx.lineTo(paddingLeft + width, paddingTop + height);
    ctx.stroke();

    // Y axis labels
    var steps = Math.min(maxValue, 5);
    for (var i = 0; i <= steps; i++) {
      var v = (maxValue / steps) * i;
      var y = paddingTop + height - (v / maxValue) * height;
      ctx.fillText(String(Math.round(v)), 4, y + 3);
    }

    // Bars
    var x = paddingLeft + gap;
    areas.forEach(function (area) {
      var total = byArea[area].total;
      var barHeight = (total / maxValue) * height;
      var y = paddingTop + height - barHeight;

      ctx.fillStyle = "#16a34a"; // green
      ctx.fillRect(x, y, barWidth, barHeight);

      // area label
      ctx.save();
      ctx.translate(x + barWidth / 2, paddingTop + height + 12);
      ctx.rotate(-Math.PI / 6);
      ctx.fillStyle = "#111827";
      ctx.textAlign = "center";
      ctx.fillText(area, 0, 0);
      ctx.restore();

      // numeric label
      ctx.fillStyle = "#111827";
      ctx.textAlign = "center";
      ctx.fillText(String(total), x + barWidth / 2, y - 4);

      x += barWidth + gap;
    });
  }

  // Small wrapper so app.js can call it if needed
  function loadAuditSummaryChart() {
    updateChart();
  }

  // -----------------------------
  // Compliance scoring helpers
  // -----------------------------
  // Convert severity text → numeric factor (0–1)
  function severityFactorFromText(severity) {
    var s = (severity || "").toLowerCase().trim();
    if (!s) return 1; // no severity set, assume OK

    if (s === "critical" || s === "cat 1" || s === "cat1") return 0.2;
    if (s === "major" || s === "cat 2" || s === "cat2") return 0.5;
    if (s === "minor" || s === "cat 3" || s === "cat3") return 0.8;

    return 1; // anything else treated as low risk
  }

  // Convert status text → numeric factor (0–1)
  function statusFactorFromText(status) {
    var st = (status || "").toLowerCase().trim();
    if (st === "closed") return 1;
    if (st === "in_progress" || st === "in-progress" || st === "in progress")
      return 0.6;
    // open / unknown
    return 0.3;
  }

  // Calculate a 0–100 score for a single audit
  function calculateAuditScore(audit) {
    var sevFactor = severityFactorFromText(audit.severity);
    var stFactor = statusFactorFromText(audit.status);
    var score = sevFactor * stFactor * 100; // 0–100
    if (score < 0) score = 0;
    if (score > 100) score = 100;
    return score;
  }

  // Calculate overall & per-area scores and render the card
  function calculateScoresAndRender() {
    var scoreValueEl = $("audit-score-value");
    var tbody = $("audit-score-by-area-body");
    if (!scoreValueEl || !tbody) return;

    if (!currentAudits || !currentAudits.length) {
      scoreValueEl.textContent = "--";
      tbody.innerHTML =
        '<tr><td colspan="3" style="text-align:center; color:#6b7280;">No score data yet.</td></tr>';
      return;
    }

    var totalScore = 0;
    var count = 0;
    var byArea = {};

    currentAudits.forEach(function (a) {
      var score = calculateAuditScore(a);
      totalScore += score;
      count += 1;

      var area = (a.area || "Unspecified").trim() || "Unspecified";
      if (!byArea[area]) {
        byArea[area] = { totalScore: 0, count: 0 };
      }
      byArea[area].totalScore += score;
      byArea[area].count += 1;
    });

    var overall = count ? Math.round(totalScore / count) : 0;
    scoreValueEl.textContent = overall + " / 100";

    // Fill table body
    tbody.innerHTML = "";
    Object.keys(byArea)
      .sort()
      .forEach(function (area) {
        var info = byArea[area];
        var avg = info.count ? Math.round(info.totalScore / info.count) : 0;

        var tr = document.createElement("tr");

        var tdArea = document.createElement("td");
        tdArea.textContent = area;

        var tdTotal = document.createElement("td");
        tdTotal.textContent = info.count;

        var tdScore = document.createElement("td");
        tdScore.textContent = avg + " / 100";

        tr.appendChild(tdArea);
        tr.appendChild(tdTotal);
        tr.appendChild(tdScore);

        tbody.appendChild(tr);
      });
  }

  // -----------------------------
  // API loads
  // -----------------------------
  async function loadAudits(status) {
    if (typeof window.fetchAudits !== "function") return;

    try {
      setMessage("Loading audits…", "#6b7280");
      var audits = await window.fetchAudits(status || "");
      renderTable(audits);
      setMessage("", "");

      // refresh dashboard stats + chart + scores
      refreshStats();
      loadAuditSummaryChart();
      // calculateScoresAndRender is already called by renderTable
    } catch (err) {
      console.error("fetchAudits error:", err);
      setMessage("Failed to load audits: " + err.message, "red");
    }
  }

  // -----------------------------
  // Exports (client-side)
  // -----------------------------
  function exportCsv() {
    if (!currentAudits.length) {
      alert("No audits to export.");
      return;
    }

    var header = [
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
      "Preventive Action"
    ];

    function escapeCsv(val) {
      if (val == null) return "";
      var s = String(val);
      if (/[",\n]/.test(s)) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }

    var rows = currentAudits.map(function (a) {
      return [
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
        a.preventive_action || ""
      ];
    });

    var csv = header.map(escapeCsv).join(",") + "\n";
    rows.forEach(function (r) {
      csv += r.map(escapeCsv).join(",") + "\n";
    });

    var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "majra_audits.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportWord() {
    if (!currentAudits.length) {
      alert("No audits to export.");
      return;
    }

    var html = "<html><head><meta charset='UTF-8'></head><body>";
    html += "<h2>Audit &amp; GMP Inspection Report</h2>";
    html += "<table border='1' cellspacing='0' cellpadding='4' style='border-collapse:collapse;font-family:Calibri;font-size:11pt;'>";
    html +=
      "<tr>" +
      "<th>Date</th><th>Title</th><th>Area</th><th>Standard/Section</th>" +
      "<th>Severity</th><th>Status</th><th>Due</th><th>Responsible</th>" +
      "</tr>";

    currentAudits.forEach(function (a) {
      var stdSec = a.standard || "";
      if (a.section) {
        stdSec =
          stdSec ? stdSec + " / " + a.section : a.section;
      }
      html +=
        "<tr>" +
        "<td>" +
        (a.audit_date || "") +
        "</td>" +
        "<td>" +
        (a.title || "") +
        "</td>" +
        "<td>" +
        (a.area || "") +
        "</td>" +
        "<td>" +
        stdSec +
        "</td>" +
        "<td>" +
        (a.severity || "") +
        "</td>" +
        "<td>" +
        (a.status || "") +
        "</td>" +
        "<td>" +
        (a.due_date || "") +
        "</td>" +
        "<td>" +
        (a.responsible_person || "") +
        "</td>" +
        "</tr>";
    });

    html += "</table></body></html>";

    var blob = new Blob([html], {
      type: "application/msword;charset=utf-8;"
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "majra_audits_report.doc";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportPdfViaPrint() {
    if (!currentAudits.length) {
      alert("No audits to export.");
      return;
    }

    var html = "<html><head><meta charset='UTF-8'><title>Audit Report</title>";
    html +=
      "<style>body{font-family:system-ui,Arial,sans-serif;font-size:11px;} table{border-collapse:collapse;width:100%;} th,td{border:1px solid #444;padding:4px;}</style>";
    html += "</head><body>";
    html += "<h2>Audit & GMP Inspection Report</h2>";
    html += "<table>";
    html +=
      "<tr><th>Date</th><th>Title</th><th>Area</th><th>Standard/Section</th><th>Severity</th><th>Status</th><th>Due</th></tr>";

    currentAudits.forEach(function (a) {
      var stdSec = a.standard || "";
      if (a.section) {
        stdSec =
          stdSec ? stdSec + " / " + a.section : a.section;
      }
      html +=
        "<tr>" +
        "<td>" +
        (a.audit_date || "") +
        "</td>" +
        "<td>" +
        (a.title || "") +
        "</td>" +
        "<td>" +
        (a.area || "") +
        "</td>" +
        "<td>" +
        stdSec +
        "</td>" +
        "<td>" +
        (a.severity || "") +
        "</td>" +
        "<td>" +
        (a.status || "") +
        "</td>" +
        "<td>" +
        (a.due_date || "") +
        "</td>" +
        "</tr>";
    });

    html += "</table></body></html>";

    var w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print(); // user chooses "Save as PDF"
  }

  // -----------------------------
  // Event handlers
  // -----------------------------
  async function handleSubmit(e) {
    e.preventDefault();
    console.log("[MajraAudits] submit handler fired");

    if (typeof window.createAudit !== "function") {
      setMessage("Audit API not available.", "red");
      return;
    }

    var body = getFormData();

    if (!body.title) {
      setMessage("Audit title is required.", "red");
      return;
    }

    var id = hiddenIdInput ? hiddenIdInput.value || "" : "";
    try {
      if (id) {
        await window.updateAudit(id, body);
        setMessage("Audit updated.", "green");
      } else {
        await window.createAudit(body);
        setMessage("Audit saved.", "green");
      }

      await loadAudits(currentFilter === "all" ? "" : currentFilter);
      clearForm();
    } catch (err) {
      console.error("create/update audit error:", err);
      setMessage("Failed to save audit: " + err.message, "red");
    }
  }

  function handleResetClick() {
    clearForm();
  }

  function handleFilterClick(e) {
    var btn = e.currentTarget;
    var val = btn.getAttribute("data-audit-filter") || "";
    currentFilter = val;

    filterButtons.forEach(function (b) {
      if (b === btn) b.classList.add("active");
      else b.classList.remove("active");
    });

    var statusParam = "";
    if (val === "open" || val === "in_progress" || val === "closed") {
      statusParam = val;
    }
    loadAudits(statusParam);
  }

  function handleTableClick(e) {
    var btn = e.target.closest("button[data-action]");
    if (!btn) return;

    var action = btn.getAttribute("data-action");
    var id = btn.getAttribute("data-id");
    if (!id) return;

    var audit = currentAudits.find(function (a) {
      return String(a.id) === String(id);
    });

    if (action === "edit") {
      fillFormFromAudit(audit);
    } else if (action === "delete") {
      if (!window.confirm("Delete this audit record?")) return;
      if (typeof window.deleteAudit !== "function") return;

      window
        .deleteAudit(id)
        .then(function () {
          setMessage("Audit deleted.", "green");
          if (
            hiddenIdInput &&
            hiddenIdInput.value &&
            String(hiddenIdInput.value) === String(id)
          ) {
            clearForm();
          }
          loadAudits(currentFilter === "all" ? "" : currentFilter);
        })
        .catch(function (err) {
          console.error("deleteAudit error:", err);
          setMessage("Failed to delete audit: " + err.message, "red");
        });
    }
  }

  // -----------------------------
  // Init
  // -----------------------------
  document.addEventListener("DOMContentLoaded", function () {
    console.log("[MajraAudits] DOMContentLoaded");

    auditForm = $("audit-form");
    msgEl = $("audits-message");
    tableBody = $("audits-table-body");
    resetBtn = $("audit-reset-btn");
    hiddenIdInput = $("audit-id");

    openCountEl = $("dashboard-open-audits-count");
    dueSoonCountEl = $("audits-due-soon-count");
    closedCountEl = $("audits-closed-count");

    chartCanvas = $("audit-chart");
    if (chartCanvas && chartCanvas.getContext) {
      chartCtx = chartCanvas.getContext("2d");
    }

    filterButtons = Array.prototype.slice.call(
      document.querySelectorAll("[data-audit-filter]")
    );

    if (auditForm) {
      auditForm.addEventListener("submit", handleSubmit);
      console.log("[MajraAudits] submit listener attached");
    }
    if (resetBtn) {
      resetBtn.addEventListener("click", handleResetClick);
    }
    if (tableBody) {
      tableBody.addEventListener("click", handleTableClick);
    }

    filterButtons.forEach(function (btn) {
      btn.addEventListener("click", handleFilterClick);
    });

    // Export buttons (you already added in HTML)
    var btnCsv = $("audits-export-csv");
    if (btnCsv) btnCsv.addEventListener("click", exportCsv);

    var btnWord = $("audits-export-word");
    if (btnWord) btnWord.addEventListener("click", exportWord);

    var btnPdf = $("audits-export-pdf");
    if (btnPdf) btnPdf.addEventListener("click", exportPdfViaPrint);

    // Default filter = all (app.js will call MajraAudits.loadAudits() after login)
    currentFilter = "all";
    filterButtons.forEach(function (b) {
      if (b.getAttribute("data-audit-filter") === "all") {
        b.classList.add("active");
      } else {
        b.classList.remove("active");
      }
    });
  });

  // -----------------------------
  // Expose API to app.js
  // -----------------------------
  MajraAudits.loadAudits = function () {
    return loadAudits("");
  };
  MajraAudits.refreshStats = refreshStats;

  window.MajraAudits = MajraAudits;
})();