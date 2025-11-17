// public/scripts/complaints.js
// Complaints module: register, status, investigation, letter, exports

(function () {
  "use strict";

  // ---------------------------------
  // State
  // ---------------------------------
  var currentComplaints = [];
  var selectedComplaintId = null;

  // Cached investigation / letter elements
  var rootCauseEl = null;
  var correctiveEl = null;
  var preventiveEl = null;
  var outcomeEl = null;
  var summaryEl = null;
  var letterEditorEl = null;
  var investigationMsgEl = null;

  // ---------------------------------
  // Helpers
  // ---------------------------------

  function formatDateDisplay(value) {
    if (!value) return "";
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;
    var d = new Date(value);
    if (isNaN(d.getTime())) return value;
    var dd = String(d.getDate()).padStart(2, "0");
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var yyyy = d.getFullYear();
    return dd + "/" + mm + "/" + yyyy;
  }

  function findComplaintById(id) {
    id = String(id);
    for (var i = 0; i < currentComplaints.length; i++) {
      if (String(currentComplaints[i].id) === id) return currentComplaints[i];
    }
    return null;
  }

  function prettyStatus(status) {
    if (!status || status === "open") return "Open";
    if (status === "in_progress") return "In progress";
    if (status === "closed") return "Closed";
    return status;
  }

  function statusClass(status) {
    if (!status || status === "open") return "status-open";
    if (status === "in_progress") return "status-in-progress";
    if (status === "closed") return "status-closed";
    return "";
  }

  // ---------------------------------
  // Load + render complaints
  // ---------------------------------

  function loadComplaints() {
    if (typeof window.fetchComplaints !== "function") return;

    window
      .fetchComplaints()
      .then(function (list) {
        if (Array.isArray(list)) {
          currentComplaints = list;
        } else if (list && Array.isArray(list.complaints)) {
          currentComplaints = list.complaints;
        } else {
          currentComplaints = [];
        }
        renderComplaintsTable();
      })
      .catch(function (err) {
        console.error("loadComplaints error:", err);
        currentComplaints = [];
        renderComplaintsTable(true);
      });
  }

  function renderComplaintsTable(hasError) {
    var tbody = document.getElementById("complaints-table-body");
    if (!tbody) return;

    if (hasError) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align:center; font-size:0.8rem; color:#b91c1c;">Unable to load complaints.</td></tr>';
      return;
    }

    if (!currentComplaints.length) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align:center; font-size:0.8rem; color:#6b7280;">No complaints recorded yet.</td></tr>';
      return;
    }

    var html = "";
    for (var i = 0; i < currentComplaints.length; i++) {
      var c = currentComplaints[i];
      var status = c.status || "open";

      html +=
        '<tr data-id="' +
        c.id +
        '">' +
        "<td>" +
        formatDateDisplay(c.date_received) +
        "</td>" +
        "<td>" +
        (c.customer_name || "") +
        "</td>" +
        "<td>" +
        (c.product_name || "") +
        "</td>" +
        "<td>" +
        (c.complaint_type || "") +
        "</td>" +
        "<td>" +
        (c.contamination_type || "") +
        "</td>" +
        '<td><span class="status-pill ' +
        statusClass(status) +
        '">' +
        prettyStatus(status) +
        "</span></td>" +
        "<td>" +
        '<button type="button" class="btn btn-small" data-action="investigate" data-id="' +
        c.id +
        '">Investigate</button> ' +
        '<button type="button" class="btn btn-small" data-action="status" data-status="open" data-id="' +
        c.id +
        '">Open</button> ' +
        '<button type="button" class="btn btn-small" data-action="status" data-status="in_progress" data-id="' +
        c.id +
        '">In progress</button> ' +
        '<button type="button" class="btn btn-small" data-action="status" data-status="closed" data-id="' +
        c.id +
        '">Close</button> ' +
        '<button type="button" class="btn btn-small delete" data-action="delete" data-id="' +
        c.id +
        '">Delete</button>' +
        "</td>" +
        "</tr>";
    }

    tbody.innerHTML = html;
  }

  // ---------------------------------
  // New complaint form
  // ---------------------------------

  function handleComplaintFormSubmit(e) {
    e.preventDefault();

    var dateEl = document.getElementById("complaint-date");
    var customerEl = document.getElementById("complaint-customer");
    var productEl = document.getElementById("complaint-product");
    var typeEl = document.getElementById("complaint-type");
    var contEl = document.getElementById("complaint-contamination");
    var descEl = document.getElementById("complaint-description");
    var msgEl = document.getElementById("complaints-message");

    if (msgEl) {
      msgEl.textContent = "";
      msgEl.style.color = "";
    }

    var dateVal = dateEl ? dateEl.value : "";
    var customer = customerEl ? customerEl.value.trim() : "";
    var product = productEl ? productEl.value.trim() : "";
    var type = typeEl ? typeEl.value.trim() : "";
    var cont = contEl ? contEl.value.trim() : "";
    var desc = descEl ? descEl.value.trim() : "";

    if (!customer || !product || !desc) {
      if (msgEl) {
        msgEl.textContent =
          "Error: Customer, product and description are required.";
        msgEl.style.color = "red";
      }
      return;
    }

    var body = {
      date_received: dateVal || null,
      customer_name: customer,
      product_name: product,
      complaint_type: type || null,
      contamination_type: cont || null,
      description: desc
    };

    if (typeof window.createComplaint !== "function") {
      if (msgEl) {
        msgEl.textContent = "Error: API createComplaint() is not available.";
        msgEl.style.color = "red";
      }
      return;
    }

    window
      .createComplaint(body)
      .then(function (created) {
        if (created && created.id != null) {
          currentComplaints.unshift(created);
          renderComplaintsTable();
        } else {
          loadComplaints();
        }

        if (e.target && typeof e.target.reset === "function") {
          e.target.reset();
        }
        if (msgEl) {
          msgEl.textContent = "Complaint saved.";
          msgEl.style.color = "green";
        }
      })
      .catch(function (err) {
        console.error("createComplaint error:", err);
        if (msgEl) {
          msgEl.textContent = "Error saving complaint: " + err.message;
          msgEl.style.color = "red";
        }
      });
  }

  // ---------------------------------
  // Table actions
  // ---------------------------------

  function handleComplaintsTableClick(e) {
    var btn = e.target;
    while (btn && btn !== e.currentTarget && !btn.getAttribute("data-action")) {
      btn = btn.parentNode;
    }
    if (!btn || !btn.getAttribute) return;

    var action = btn.getAttribute("data-action");
    var id = btn.getAttribute("data-id");
    if (!action || !id) return;

    if (action === "investigate") {
      var complaint = findComplaintById(id);
      if (complaint) openInvestigationPanel(complaint);
      return;
    }

    if (action === "status") {
      var newStatus = btn.getAttribute("data-status");
      if (!newStatus) return;
      if (typeof window.updateComplaintStatus !== "function") {
        alert("Status update API not available.");
        return;
      }

      window
        .updateComplaintStatus(id, newStatus)
        .then(function () {
          return window.fetchComplaints();
        })
        .then(function (list) {
          if (Array.isArray(list)) {
            currentComplaints = list;
          } else if (list && Array.isArray(list.complaints)) {
            currentComplaints = list.complaints;
          } else {
            currentComplaints = [];
          }
          renderComplaintsTable();
        })
        .catch(function (err) {
          console.error("updateComplaintStatus error:", err);
          alert("Failed to update status: " + err.message);
        });
      return;
    }

    if (action === "delete") {
      if (!confirm("Delete this complaint?")) return;
      if (typeof window.deleteComplaint !== "function") {
        alert("Delete API not available.");
        return;
      }

      window
        .deleteComplaint(id)
        .then(function () {
          currentComplaints = currentComplaints.filter(function (c) {
            return String(c.id) !== String(id);
          });
          renderComplaintsTable();
          if (String(selectedComplaintId) === String(id)) {
            hideInvestigationPanel();
          }
        })
        .catch(function (err) {
          console.error("deleteComplaint error:", err);
          alert("Failed to delete complaint: " + err.message);
        });
    }
  }

  // ---------------------------------
  // Investigation + Letter
  // ---------------------------------

  function cacheInvestigationElements() {
    if (!rootCauseEl) {
      rootCauseEl = document.getElementById("investigation-root-cause");
      correctiveEl = document.getElementById("investigation-corrective");
      preventiveEl = document.getElementById("investigation-preventive");
      outcomeEl = document.getElementById("investigation-outcome");
      summaryEl = document.getElementById("investigation-summary");
      letterEditorEl = document.getElementById("complaint-letter-editor");
      investigationMsgEl = document.getElementById("investigation-message");
    }
  }

  function openInvestigationPanel(complaint) {
    cacheInvestigationElements();
    selectedComplaintId = complaint.id;

    var card = document.getElementById("complaint-investigation-card");
    var title = document.getElementById("complaint-selected-title");

    if (title) {
      title.textContent =
        "Complaint #" +
        complaint.id +
        " – " +
        (complaint.customer_name || "") +
        " (" +
        (complaint.product_name || "") +
        ")";
    }

    if (rootCauseEl) rootCauseEl.value = complaint.root_cause || "";
    if (correctiveEl) correctiveEl.value = complaint.corrective_action || "";
    if (preventiveEl) preventiveEl.value = complaint.preventive_action || "";
    if (outcomeEl) outcomeEl.value = complaint.outcome || "";
    if (summaryEl) summaryEl.value = complaint.investigation_summary || "";

    if (letterEditorEl) {
      var existing = complaint.letter_body || "";
      letterEditorEl.innerHTML = existing;
    }

    if (card) card.style.display = "block";
  }

  function hideInvestigationPanel() {
    selectedComplaintId = null;
    var card = document.getElementById("complaint-investigation-card");
    if (card) card.style.display = "none";
  }

  function handleInvestigationFormSubmit(e) {
    e.preventDefault();
    cacheInvestigationElements();

    if (!selectedComplaintId) {
      alert("Please select a complaint from the register first.");
      return;
    }

    var body = {
      root_cause: rootCauseEl ? rootCauseEl.value.trim() : "",
      corrective_action: correctiveEl ? correctiveEl.value.trim() : "",
      preventive_action: preventiveEl ? preventiveEl.value.trim() : "",
      outcome: outcomeEl ? outcomeEl.value.trim() : "",
      investigation_summary: summaryEl ? summaryEl.value.trim() : "",
      letter_body: letterEditorEl ? letterEditorEl.innerHTML : ""
    };

    if (typeof window.saveComplaintInvestigation !== "function") {
      alert("Investigation API not available.");
      return;
    }

    if (investigationMsgEl) {
      investigationMsgEl.textContent = "";
      investigationMsgEl.style.color = "";
    }

    window
      .saveComplaintInvestigation(selectedComplaintId, body)
      .then(function () {
        if (investigationMsgEl) {
          investigationMsgEl.textContent =
            "Investigation and customer letter saved.";
          investigationMsgEl.style.color = "green";
        }
        loadComplaints();
      })
      .catch(function (err) {
        console.error("saveComplaintInvestigation error:", err);
        if (investigationMsgEl) {
          investigationMsgEl.textContent =
            "Error saving investigation: " + err.message;
          investigationMsgEl.style.color = "red";
        }
      });
  }

  // ---------------------------------
  // Investigation Summary generator
  // ---------------------------------

  function generateInvestigationSummary() {
    cacheInvestigationElements();
    if (!summaryEl) return;

    var rootText = rootCauseEl ? rootCauseEl.value.trim() : "";
    var corrText = correctiveEl ? correctiveEl.value.trim() : "";
    var prevText = preventiveEl ? preventiveEl.value.trim() : "";
    var outText = outcomeEl ? outcomeEl.value.trim() : "";

    var lines = [];

    if (rootText) lines.push("Root cause: " + rootText);
    if (corrText) lines.push("Corrective action: " + corrText);
    if (prevText) lines.push("Preventive action: " + prevText);
    if (outText) lines.push("Outcome / resolution: " + outText);

    if (!lines.length) {
      lines.push(
        "Investigation has been carried out and details recorded for root cause, corrective and preventive actions, and final outcome."
      );
    }

    lines.push(
      "All records related to this complaint are filed in accordance with the company’s food safety and quality procedures."
    );

    summaryEl.value = lines.join("\n\n");
  }

  // ---------------------------------
  // Letter generation + toolbar + print
  // ---------------------------------

  function generateLetterFromData() {
    cacheInvestigationElements();
    if (!letterEditorEl) return;

    var complaint = selectedComplaintId
      ? findComplaintById(selectedComplaintId)
      : null;

    var customer = "";
    var product = "";
    var type = "";

    if (complaint) {
      customer = complaint.customer_name || "";
      product = complaint.product_name || "";
      type = complaint.complaint_type || "";
    } else {
      var cInput = document.getElementById("complaint-customer");
      var pInput = document.getElementById("complaint-product");
      var tInput = document.getElementById("complaint-type");
      customer = cInput ? cInput.value.trim() : "";
      product = pInput ? pInput.value.trim() : "";
      type = tInput ? tInput.value.trim() : "";
    }

    if (!customer) customer = "Customer";
    if (!product) product = "your product";
    if (!type) type = "your concern";

    var rootText = rootCauseEl ? rootCauseEl.value.trim() : "";
    var corrText = correctiveEl ? correctiveEl.value.trim() : "";
    var prevText = preventiveEl ? preventiveEl.value.trim() : "";
    var outText = outcomeEl ? outcomeEl.value.trim() : "";

    var html = "";
    html += "<p>Dear " + customer + ",</p>";
    html +=
      "<p>Thank you for contacting us and bringing your concern to our attention.</p>";
    html +=
      "<p>We are sorry to hear about the issue you experienced with <strong>" +
      product +
      "</strong>. We have logged your complaint under the category <strong>" +
      type +
      "</strong> and carried out a full investigation in line with our food safety and quality procedures.</p>";

    if (rootText) html += "<p><strong>Root cause:</strong> " + rootText + "</p>";
    if (corrText)
      html += "<p><strong>Corrective action:</strong> " + corrText + "</p>";
    if (prevText)
      html += "<p><strong>Preventive action:</strong> " + prevText + "</p>";
    if (outText) html += "<p><strong>Outcome:</strong> " + outText + "</p>";

    html +=
      "<p>We appreciate your feedback, as it helps us continuously improve our food safety, quality and customer service standards.</p>";
    html +=
      "<p>Kind regards,<br/>Technical / Quality Team<br/>Majra Intelligence</p>";

    letterEditorEl.innerHTML = html;
  }

  function initLetterToolbar() {
    cacheInvestigationElements();
    if (!letterEditorEl) return;

    var toolbar = document.querySelector(".letter-toolbar");
    if (toolbar) {
      toolbar.addEventListener("click", function (e) {
        var btn = e.target;
        while (btn && btn !== toolbar && !btn.getAttribute("data-cmd")) {
          btn = btn.parentNode;
        }
        if (!btn || !btn.getAttribute) return;
        var cmd = btn.getAttribute("data-cmd");
        if (!cmd) return;
        document.execCommand(cmd, false, null);
        letterEditorEl.focus();
      });
    }

    var sizeSelect = document.getElementById("letter-font-size");
    if (sizeSelect) {
      sizeSelect.addEventListener("change", function () {
        var size = sizeSelect.value || "12px";
        letterEditorEl.style.fontSize = size;
        letterEditorEl.focus();
      });
    }

    var familySelect = document.getElementById("letter-font-family");
    if (familySelect) {
      familySelect.addEventListener("change", function () {
        var family = familySelect.value || "Calibri,Arial,sans-serif";
        letterEditorEl.style.fontFamily = family;
        letterEditorEl.focus();
      });
    }

    var colourSelect = document.getElementById("letter-colour");
    if (colourSelect) {
      colourSelect.addEventListener("change", function () {
        var colour = colourSelect.value || "#111827";
        document.execCommand("foreColor", false, colour);
        letterEditorEl.focus();
      });
    }

    var colourPicker = document.getElementById("letter-colour-picker");
    if (colourPicker) {
      colourPicker.addEventListener("input", function () {
        var colour = colourPicker.value || "#111827";
        document.execCommand("foreColor", false, colour);
        letterEditorEl.focus();
      });
    }

    var printBtn = document.getElementById("btn-letter-print");
    if (printBtn) {
      printBtn.addEventListener("click", function () {
        if (!letterEditorEl) return;
        var shell = document.querySelector(".letter-editor-shell");
        var htmlToPrint = shell ? shell.innerHTML : letterEditorEl.innerHTML;

        var w = window.open("", "_blank", "width=800,height=900");
        if (!w) return;
        w.document.open();
        w.document.write(
          "<!DOCTYPE html><html><head><title>Complaint Letter</title>" +
            '<meta charset="UTF-8" />' +
            "<style>" +
            "body{font-family:Calibri,Arial,sans-serif;margin:40px;} .letter-logo-top,.letter-logo-bottom{padding:8px 0;margin-bottom:12px;font-size:0.8rem;color:#374151;} .letter-logo-bottom{margin-top:12px;text-align:center;border-top:1px solid #e5e7eb;} .logo-circle{width:26px;height:26px;border-radius:999px;background:#22c55e;display:inline-flex;align-items:center;justify-content:center;font-weight:700;color:#0f172a;margin-right:8px;} p{font-size:0.9rem;line-height:1.5;} " +
            "</style></head><body>" +
            htmlToPrint +
            "</body></html>"
        );
        w.document.close();
        w.focus();
        w.print();
      });
    }
  }

  // ---------------------------------
  // Exports (front-end only)
  // ---------------------------------

  function exportCSV(data) {
    if (!data || !data.length) return;

    var lines = [];
    lines.push(
      [
        "ID",
        "Date",
        "Customer",
        "Product",
        "Type",
        "Contamination",
        "Status",
        "Description"
      ].join(",")
    );

    data.forEach(function (c) {
      var row = [
        c.id,
        '"' + formatDateDisplay(c.date_received || "") + '"',
        '"' + (c.customer_name || "") + '"',
        '"' + (c.product_name || "") + '"',
        '"' + (c.complaint_type || "") + '"',
        '"' + (c.contamination_type || "") + '"',
        '"' + prettyStatus(c.status || "open") + '"',
        '"' + (c.description || "").replace(/"/g, '""') + '"'
      ];
      lines.push(row.join(","));
    });

    var blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;"
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "complaints.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportJSON(data) {
    var blob = new Blob([JSON.stringify(data || [], null, 2)], {
      type: "application/json"
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "complaints-backup.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportWordSummary(data) {
    if (!data || !data.length) return;

    var html =
      "<html><head><meta charset='UTF-8'><title>Complaint Report</title></head><body>";
    html += "<h2>Complaint Summary</h2>";

    data.forEach(function (c) {
      html += "<h3>Complaint #" + c.id + "</h3>";
      html +=
        "<p><strong>Date:</strong> " + formatDateDisplay(c.date_received) + "</p>";
      html += "<p><strong>Customer:</strong> " + (c.customer_name || "") + "</p>";
      html += "<p><strong>Product:</strong> " + (c.product_name || "") + "</p>";
      html += "<p><strong>Type:</strong> " + (c.complaint_type || "") + "</p>";
      html +=
        "<p><strong>Contamination:</strong> " +
        (c.contamination_type || "") +
        "</p>";
      html +=
        "<p><strong>Status:</strong> " +
        prettyStatus(c.status || "open") +
        "</p>";
      html +=
        "<p><strong>Description:</strong> " + (c.description || "") + "</p>";
      html += "<hr/>";
    });

    html += "<p>Generated by Majra Intelligence – Complaints Module.</p>";
    html += "</body></html>";

    var blob = new Blob([html], {
      type: "application/msword;charset=utf-8"
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "complaints-report.doc";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function initExports() {
    var btnCsv = document.getElementById("btn-export-csv");
    var btnWord = document.getElementById("btn-export-word");
    var btnPdf = document.getElementById("btn-export-pdf");
    var btnJson = document.getElementById("btn-export-json");

    if (btnCsv)
      btnCsv.addEventListener("click", function () {
        exportCSV(currentComplaints);
      });
    if (btnJson)
      btnJson.addEventListener("click", function () {
        exportJSON(currentComplaints);
      });
    if (btnWord)
      btnWord.addEventListener("click", function () {
        exportWordSummary(currentComplaints);
      });
    if (btnPdf)
      btnPdf.addEventListener("click", function () {
        window.print();
      });

    var btnCsvAll = document.getElementById("btn-export-csv-all");
    var btnJsonAll = document.getElementById("btn-export-json-all");
    var btnWordAll = document.getElementById("btn-export-word-all");

    if (btnCsvAll)
      btnCsvAll.addEventListener("click", function () {
        exportCSV(currentComplaints);
      });
    if (btnJsonAll)
      btnJsonAll.addEventListener("click", function () {
        exportJSON(currentComplaints);
      });
    if (btnWordAll)
      btnWordAll.addEventListener("click", function () {
        exportWordSummary(currentComplaints);
      });
  }

  // ---------------------------------
  // Init on DOMContentLoaded
  // ---------------------------------

  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("complaint-form");
    if (form) {
      form.addEventListener("submit", handleComplaintFormSubmit);
    }

    var tbody = document.getElementById("complaints-table-body");
    if (tbody) {
      tbody.addEventListener("click", handleComplaintsTableClick);
    }

    var invForm = document.getElementById("complaint-investigation-form");
    if (invForm) {
      invForm.addEventListener("submit", handleInvestigationFormSubmit);
    }

    var genLetterBtn = document.getElementById("btn-generate-letter");
    if (genLetterBtn) {
      genLetterBtn.addEventListener("click", generateLetterFromData);
    }

    var genSummaryBtn = document.getElementById("btn-generate-summary");
    if (genSummaryBtn) {
      genSummaryBtn.addEventListener("click", generateInvestigationSummary);
    }

    initLetterToolbar();
    initExports();

    if (typeof window.getToken === "function" && window.getToken()) {
      loadComplaints();
    }
  });

  // Expose for app.js
  window.MajraComplaints = {
    loadComplaints: loadComplaints
  };
})();