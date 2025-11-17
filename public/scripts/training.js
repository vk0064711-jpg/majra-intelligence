// public/scripts/training.js
// Training module – fully wired to backend

(function () {
  "use strict";

  window.MajraTraining = {
    loadTrainingRecords: loadTrainingRecords,
  };

  let currentStatusFilter = "";
  let currentDeptFilter = "";

  document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("training-form");
    if (form) form.addEventListener("submit", handleSave);

    const resetBtn = document.getElementById("training-reset-btn");
    if (resetBtn) resetBtn.addEventListener("click", resetForm);

    const statusFilter = document.getElementById("training-filter-status");
    const deptFilter = document.getElementById("training-filter-dept");
    const clearFilters = document.getElementById("training-filter-clear");

    if (statusFilter) {
      statusFilter.addEventListener("change", function () {
        currentStatusFilter = this.value || "";
        loadTrainingRecords();
      });
    }
    if (deptFilter) {
      deptFilter.addEventListener("change", function () {
        currentDeptFilter = this.value || "";
        loadTrainingRecords();
      });
    }
    if (clearFilters) {
      clearFilters.addEventListener("click", function () {
        currentStatusFilter = "";
        currentDeptFilter = "";
        if (statusFilter) statusFilter.value = "";
        if (deptFilter) deptFilter.value = "";
        loadTrainingRecords();
      });
    }

    const exportCsvBtn = document.getElementById("training-export-csv");
    const exportJsonBtn = document.getElementById("training-export-json");

    if (exportCsvBtn) {
      exportCsvBtn.addEventListener("click", exportCsv);
    }
    if (exportJsonBtn) {
      exportJsonBtn.addEventListener("click", exportJson);
    }
  });

  // -----------------------------
  // LOAD
  // -----------------------------
  async function loadTrainingRecords() {
    const msgEl = document.getElementById("training-message");
    if (msgEl) {
      msgEl.textContent = "";
      msgEl.style.color = "";
    }

    if (typeof window.fetchTrainingRecords !== "function") {
      console.warn("fetchTrainingRecords not available");
      return;
    }

    let records = [];
    try {
      records = await window.fetchTrainingRecords({
        status: currentStatusFilter,
        department: currentDeptFilter,
      });
    } catch (err) {
      console.error("Error loading training:", err);
      if (msgEl) {
        msgEl.textContent = "Error loading training records: " + err.message;
        msgEl.style.color = "red";
      }
      return;
    }

    renderTable(records);

    // update stats card (due soon / overdue) using API stats
    try {
      if (typeof window.fetchTrainingStats === "function") {
        const stats = await window.fetchTrainingStats();
        const dueEl = document.getElementById("training-due-soon-count");
        const overEl = document.getElementById("training-overdue-count");
        const totalEl = document.getElementById("training-total-count");

        if (dueEl && stats && stats.due_30_days !== undefined) {
          dueEl.textContent = stats.due_30_days;
        }
        if (overEl && stats && stats.overdue !== undefined) {
          overEl.textContent = stats.overdue;
        }
        if (totalEl && stats && stats.total !== undefined) {
          totalEl.textContent = stats.total;
        }
      }
    } catch (err) {
      console.warn("Training stats error:", err);
    }
  }

  // -----------------------------
  // SAVE (create / update)
  // -----------------------------
  async function handleSave(e) {
    e.preventDefault();

    const id = document.getElementById("training-id").value;

    const record = {
      employee_name: document.getElementById("training-employee-name").value,
      employee_email: document.getElementById("training-employee-email").value,
      job_title: document.getElementById("training-job-title").value,
      department: document.getElementById("training-department").value,
      training_topic: document.getElementById("training-topic").value,
      training_type: document.getElementById("training-type").value,
      provider: document.getElementById("training-provider").value,
      status: document.getElementById("training-status").value,
      due_date: document.getElementById("training-due-date").value,
      completion_date: document.getElementById("training-completion-date").value,
      validity_months: document.getElementById("training-validity-months").value
        ? parseInt(document.getElementById("training-validity-months").value, 10)
        : null,
      next_review_date: document.getElementById("training-next-review-date").value,
      certificate_location: document.getElementById("training-certificate-location").value,
      notes: document.getElementById("training-notes").value,
    };

    const msgEl = document.getElementById("training-message");
    if (msgEl) {
      msgEl.textContent = "";
      msgEl.style.color = "";
    }

    if (!record.employee_name || !record.training_topic) {
      if (msgEl) {
        msgEl.textContent =
          "Employee name and training topic are required.";
        msgEl.style.color = "red";
      }
      return;
    }

    try {
      if (id) {
        await window.updateTrainingRecord(id, record);
      } else {
        await window.createTrainingRecord(record);
      }

      if (msgEl) {
        msgEl.textContent = "Training record saved.";
        msgEl.style.color = "green";
      }

      resetForm();
      loadTrainingRecords();
    } catch (err) {
      console.error("Error saving training:", err);
      if (msgEl) {
        msgEl.textContent = "Error saving training record: " + err.message;
        msgEl.style.color = "red";
      }
    }
  }

  // -----------------------------
  // RESET FORM
  // -----------------------------
  function resetForm() {
    const form = document.getElementById("training-form");
    if (form) form.reset();
    const idEl = document.getElementById("training-id");
    if (idEl) idEl.value = "";
  }

  // -----------------------------
  // RENDER TABLE
  // -----------------------------
  function renderTable(records) {
    const tbody = document.getElementById("training-table-body");
    if (!tbody) return;

    tbody.innerHTML = "";

    records.forEach((r) => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${r.employee_name || ""}</td>
        <td>${r.employee_email || ""}</td>
        <td>${r.job_title || ""}</td>
        <td>${r.department || ""}</td>
        <td>${r.training_topic || ""}</td>
        <td>${r.status || ""}</td>
        <td>${r.due_date || ""}</td>
        <td>${r.completion_date || ""}</td>
        <td>
          <button class="btn small" data-edit="${r.id}">Edit</button>
          <button class="btn small danger" data-del="${r.id}">Delete</button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    tbody.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        editRecord(btn.getAttribute("data-edit"));
      });
    });

    tbody.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        deleteRecord(btn.getAttribute("data-del"));
      });
    });
  }

  // -----------------------------
  // EDIT
  // -----------------------------
  async function editRecord(id) {
    try {
      const records = await window.fetchTrainingRecords({});
      const r = records.find((x) => String(x.id) === String(id));
      if (!r) return;

      document.getElementById("training-id").value = r.id;
      document.getElementById("training-employee-name").value =
        r.employee_name || "";
      document.getElementById("training-employee-email").value =
        r.employee_email || "";
      document.getElementById("training-job-title").value =
        r.job_title || "";
      document.getElementById("training-department").value =
        r.department || "";
      document.getElementById("training-topic").value =
        r.training_topic || "";
      document.getElementById("training-type").value =
        r.training_type || "";
      document.getElementById("training-provider").value =
        r.provider || "";
      document.getElementById("training-status").value =
        r.status || "Planned";
      document.getElementById("training-due-date").value =
        r.due_date || "";
      document.getElementById("training-completion-date").value =
        r.completion_date || "";
      document.getElementById("training-validity-months").value =
        r.validity_months != null ? r.validity_months : "";
      document.getElementById("training-next-review-date").value =
        r.next_review_date || "";
      document.getElementById("training-certificate-location").value =
        r.certificate_location || "";
      document.getElementById("training-notes").value =
        r.notes || "";
    } catch (err) {
      console.error("Edit training error:", err);
    }
  }

  // -----------------------------
  // DELETE
  // -----------------------------
  async function deleteRecord(id) {
    if (!window.confirm("Delete this training record?")) return;
    try {
      await window.deleteTrainingRecord(id);
      loadTrainingRecords();
    } catch (err) {
      console.error("Delete training error:", err);
      alert("Error deleting training record: " + err.message);
    }
  }

  // -----------------------------
  // EXPORT CSV / JSON
  // -----------------------------
  async function exportCsv() {
    try {
      const records = await window.fetchTrainingRecords({});
      if (!records.length) {
        alert("No training records to export.");
        return;
      }

      const headers = [
        "Employee Name",
        "Employee Email",
        "Job Title",
        "Department",
        "Training Topic",
        "Training Type",
        "Provider",
        "Status",
        "Due Date",
        "Completion Date",
        "Validity Months",
        "Next Review Date",
        "Certificate Location",
        "Notes",
      ];

      const rows = records.map((r) => [
        r.employee_name || "",
        r.employee_email || "",
        r.job_title || "",
        r.department || "",
        r.training_topic || "",
        r.training_type || "",
        r.provider || "",
        r.status || "",
        r.due_date || "",
        r.completion_date || "",
        r.validity_months != null ? r.validity_months : "",
        r.next_review_date || "",
        r.certificate_location || "",
        (r.notes || "").replace(/\r?\n/g, " "),
      ]);

      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join(
        "\n"
      );

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "majra_training_records.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export CSV error:", err);
      alert("Error exporting CSV: " + err.message);
    }
  }

  async function exportJson() {
    try {
      const records = await window.fetchTrainingRecords({});
      const blob = new Blob([JSON.stringify(records, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "majra_training_records.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export JSON error:", err);
      alert("Error exporting JSON: " + err.message);
    }
  }
})();