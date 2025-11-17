// public/scripts/documents.js
// Document Control UI + API integration

(function () {
  "use strict";

  var documentsCache = [];

  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("document-form");
    if (!form) return; // documents view not on this page

    var idInput = document.getElementById("doc-id");
    var codeInput = document.getElementById("doc-code");
    var titleInput = document.getElementById("doc-title");
    var deptInput = document.getElementById("doc-department");
    var procInput = document.getElementById("doc-process");
    var standardSelect = document.getElementById("doc-standard");
    var standardOtherInput = document.getElementById("doc-standard-other");
    var clauseInput = document.getElementById("doc-clause");
    var typeSelect = document.getElementById("doc-type");
    var versionInput = document.getElementById("doc-version");
    var issueInput = document.getElementById("doc-issue");
    var reviewInput = document.getElementById("doc-review");
    var statusSelect = document.getElementById("doc-status");
    var ownerInput = document.getElementById("doc-owner");
    var locationInput = document.getElementById("doc-location");
    var notesInput = document.getElementById("doc-notes");

    var msgEl = document.getElementById("documents-message");
    var tableBody = document.getElementById("documents-table-body");

    var filterStatus = document.getElementById("doc-filter-status");
    var filterStandard = document.getElementById("doc-filter-standard");
    var filterClearBtn = document.getElementById("doc-filter-clear");

    var exportCsvBtn = document.getElementById("doc-export-csv");
    var exportJsonBtn = document.getElementById("doc-export-json");

    function setMessage(text, isError) {
      if (!msgEl) return;
      msgEl.textContent = text || "";
      msgEl.style.color = isError ? "#b91c1c" : "#166534";
    }

    function clearForm() {
      if (idInput) idInput.value = "";
      if (codeInput) codeInput.value = "";
      if (titleInput) titleInput.value = "";
      if (deptInput) deptInput.value = "";
      if (procInput) procInput.value = "";
      if (standardSelect) standardSelect.value = "";
      if (standardOtherInput) standardOtherInput.value = "";
      if (clauseInput) clauseInput.value = "";
      if (typeSelect) typeSelect.value = "";
      if (versionInput) versionInput.value = "";
      if (issueInput) issueInput.value = "";
      if (reviewInput) reviewInput.value = "";
      if (statusSelect) statusSelect.value = "Active";
      if (ownerInput) ownerInput.value = "";
      if (locationInput) locationInput.value = "";
      if (notesInput) notesInput.value = "";
      setMessage("");
    }

    function renderDocuments() {
      if (!tableBody) return;
      tableBody.innerHTML = "";

      if (!documentsCache.length) {
        var trEmpty = document.createElement("tr");
        var tdEmpty = document.createElement("td");
        tdEmpty.colSpan = 12;
        tdEmpty.textContent = "No documents added yet.";
        trEmpty.appendChild(tdEmpty);
        tableBody.appendChild(trEmpty);
        return;
      }

      documentsCache.forEach(function (doc) {
        var tr = document.createElement("tr");

        function td(text) {
          var td = document.createElement("td");
          td.textContent = text || "";
          return td;
        }

        tr.appendChild(td(doc.code || ""));
        tr.appendChild(td(doc.title || ""));
        tr.appendChild(td(doc.department || ""));
        tr.appendChild(td(doc.standard || ""));
        tr.appendChild(td(doc.clause || ""));
        tr.appendChild(td(doc.doc_type || ""));
        tr.appendChild(td(doc.version || ""));
        tr.appendChild(td(doc.issue_date || ""));
        tr.appendChild(td(doc.review_date || ""));
        tr.appendChild(td(doc.status || ""));
        tr.appendChild(td(doc.owner || ""));

        var tdActions = document.createElement("td");

        var editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.textContent = "Edit";
        editBtn.className = "btn-table";
        editBtn.addEventListener("click", function () {
          startEditDocument(doc);
        });

        var delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.textContent = "Delete";
        delBtn.className = "btn-table delete";
        delBtn.style.marginLeft = "4px";
        delBtn.addEventListener("click", function () {
          deleteDocumentConfirm(doc.id);
        });

        tdActions.appendChild(editBtn);
        tdActions.appendChild(delBtn);
        tr.appendChild(tdActions);

        tableBody.appendChild(tr);
      });
    }

    function startEditDocument(doc) {
      if (idInput) idInput.value = doc.id;
      if (codeInput) codeInput.value = doc.code || "";
      if (titleInput) titleInput.value = doc.title || "";
      if (deptInput) deptInput.value = doc.department || "";
      if (procInput) procInput.value = doc.process_area || "";
      if (standardSelect) {
        var s = doc.standard || "";
        var known = [
          "SALSA",
          "BRCGS Food",
          "ISO 22000",
          "FSSC 22000",
          "Customer standard",
          "Internal"
        ];
        if (known.indexOf(s) !== -1) {
          standardSelect.value = s;
          if (standardOtherInput) standardOtherInput.value = "";
        } else if (s) {
          standardSelect.value = "Other";
          if (standardOtherInput) standardOtherInput.value = s;
        } else {
          standardSelect.value = "";
          if (standardOtherInput) standardOtherInput.value = "";
        }
      }
      if (clauseInput) clauseInput.value = doc.clause || "";
      if (typeSelect) typeSelect.value = doc.doc_type || "";
      if (versionInput) versionInput.value = doc.version || "";
      if (issueInput) issueInput.value = doc.issue_date || "";
      if (reviewInput) reviewInput.value = doc.review_date || "";
      if (statusSelect) statusSelect.value = doc.status || "Active";
      if (ownerInput) ownerInput.value = doc.owner || "";
      if (locationInput) locationInput.value = doc.location || "";
      if (notesInput) notesInput.value = doc.notes || "";
      setMessage("Editing document: " + (doc.title || ""));
    }

    async function deleteDocumentConfirm(id) {
      if (!window.confirm("Delete this document?")) return;
      try {
        await window.deleteDocument(id);
        documentsCache = documentsCache.filter(function (d) {
          return d.id !== id;
        });
        renderDocuments();
        updateDocumentStats();
        setMessage("Document deleted");
      } catch (err) {
        console.error("Delete document error:", err);
        setMessage("Failed to delete document: " + err.message, true);
      }
    }

    async function saveDocumentHandler(e) {
      e.preventDefault();

      if (!titleInput || !titleInput.value.trim()) {
        setMessage("Document title is required", true);
        return;
      }

      var standardValue = "";
      if (standardSelect) {
        if (standardSelect.value === "Other") {
          standardValue = (standardOtherInput && standardOtherInput.value.trim()) || "";
        } else {
          standardValue = standardSelect.value || "";
        }
      }

      var payload = {
        code: codeInput ? codeInput.value.trim() : "",
        title: titleInput.value.trim(),
        department: deptInput ? deptInput.value.trim() : "",
        process_area: procInput ? procInput.value.trim() : "",
        standard: standardValue,
        clause: clauseInput ? clauseInput.value.trim() : "",
        doc_type: typeSelect ? typeSelect.value : "",
        version: versionInput ? versionInput.value.trim() : "",
        issue_date: issueInput ? issueInput.value : "",
        review_date: reviewInput ? reviewInput.value : "",
        status: statusSelect ? statusSelect.value : "Active",
        owner: ownerInput ? ownerInput.value.trim() : "",
        location: locationInput ? locationInput.value.trim() : "",
        notes: notesInput ? notesInput.value.trim() : ""
      };

      var isEdit = idInput && idInput.value;
      try {
        setMessage("");
        var saved;
        if (isEdit) {
          saved = await window.updateDocument(idInput.value, payload);
        } else {
          saved = await window.createDocument(payload);
        }

        if (!saved) {
          setMessage("Failed to save document", true);
          return;
        }

        if (isEdit) {
          documentsCache = documentsCache.map(function (d) {
            return d.id === saved.id ? saved : d;
          });
        } else {
          documentsCache.push(saved);
        }

        renderDocuments();
        updateDocumentStats();
        clearForm();
        setMessage(isEdit ? "Document updated" : "Document added");
      } catch (err) {
        console.error("Save document error:", err);
        setMessage("Failed to save document: " + err.message, true);
      }
    }

    async function loadDocuments() {
      try {
        setMessage("");
        var params = {};
        if (filterStatus && filterStatus.value) {
          params.status = filterStatus.value;
        }
        if (filterStandard && filterStandard.value) {
          params.standard = filterStandard.value;
        }
        var list = await window.fetchDocuments(params);
        documentsCache = list || [];
        renderDocuments();
        updateDocumentStats();
      } catch (err) {
        console.error("Load documents error:", err);
        setMessage("Failed to load documents", true);
      }
    }

    async function updateDocumentStats() {
      try {
        var stats = await window.fetchDocumentStats();
        var activeEl = document.getElementById("docs-active-count");
        var draftEl = document.getElementById("docs-draft-count");
        var obsEl = document.getElementById("docs-obsolete-count");
        var overdueEl = document.getElementById("docs-overdue-count");

        if (activeEl) activeEl.textContent = stats.active || 0;
        if (draftEl) draftEl.textContent = stats.draft || 0;
        if (obsEl) obsEl.textContent = stats.obsolete || 0;
        if (overdueEl) overdueEl.textContent = stats.overdue_review || 0;
      } catch (err) {
        console.error("Document stats error:", err);
      }
    }

    function exportCsv() {
      if (!documentsCache.length) {
        alert("No documents to export.");
        return;
      }

      var header = [
        "Code",
        "Title",
        "Department",
        "Process Area",
        "Standard",
        "Clause",
        "Type",
        "Version",
        "Issue Date",
        "Review Date",
        "Status",
        "Owner",
        "Location",
        "Notes"
      ];

      var rows = [header];

      documentsCache.forEach(function (d) {
        rows.push([
          d.code || "",
          d.title || "",
          d.department || "",
          d.process_area || "",
          d.standard || "",
          d.clause || "",
          d.doc_type || "",
          d.version || "",
          d.issue_date || "",
          d.review_date || "",
          d.status || "",
          d.owner || "",
          d.location || "",
          (d.notes || "").replace(/\r?\n/g, " ")
        ]);
      });

      var csv = rows
        .map(function (row) {
          return row
            .map(function (cell) {
              var v = String(cell || "");
              if (v.indexOf('"') !== -1) {
                v = v.replace(/"/g, '""');
              }
              if (v.search(/[",\n]/) !== -1) {
                v = '"' + v + '"';
              }
              return v;
            })
            .join(",");
        })
        .join("\r\n");

      var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "documents.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    function exportJson() {
      var blob = new Blob([JSON.stringify(documentsCache, null, 2)], {
        type: "application/json"
      });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "documents.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    // ----- Event wiring -----
    form.addEventListener("submit", saveDocumentHandler);

    var resetBtn = document.getElementById("doc-reset-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        clearForm();
      });
    }

    if (filterStatus) {
      filterStatus.addEventListener("change", loadDocuments);
    }
    if (filterStandard) {
      filterStandard.addEventListener("change", loadDocuments);
    }
    if (filterClearBtn) {
      filterClearBtn.addEventListener("click", function () {
        if (filterStatus) filterStatus.value = "";
        if (filterStandard) filterStandard.value = "";
        loadDocuments();
      });
    }

    if (exportCsvBtn) {
      exportCsvBtn.addEventListener("click", exportCsv);
    }
    if (exportJsonBtn) {
      exportJsonBtn.addEventListener("click", exportJson);
    }

    // Initial load after DOM
    loadDocuments();

    // expose for app.js
    window.MajraDocuments = {
      loadDocuments: loadDocuments
    };
  });
})();