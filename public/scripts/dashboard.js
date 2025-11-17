// public/scripts/dashboard.js
// Handles numbers on the Dashboard cards (complaints + suppliers)

(function () {
  "use strict";

  // Safe helper to turn "not a number" into 0
  function safeNumber(v) {
    var n = Number(v);
    return isNaN(n) ? 0 : n;
  }

  async function loadDashboardStats() {
    // Elements on the Dashboard cards
    var openComplaintsEl = document.getElementById(
      "dashboard-open-complaints-count"
    );
    var trainingDueEl = document.getElementById(
      "dashboard-training-due-count"
    );
    var criticalActionsEl = document.getElementById(
      "dashboard-critical-actions-count"
    );

    // If dashboard isn’t currently in the DOM, do nothing
    if (!openComplaintsEl && !trainingDueEl && !criticalActionsEl) {
      return;
    }

    // ============================
    // 1) Complaints stats
    // ============================
    if (typeof window.fetchComplaintStats === "function" && openComplaintsEl) {
      try {
        var cStats = await window.fetchComplaintStats();
        // Expecting something like { open: 3, in_progress: 2, closed: 10 }
        if (cStats && typeof cStats.open !== "undefined") {
          openComplaintsEl.textContent = safeNumber(cStats.open);
        }
      } catch (err) {
        console.warn("Dashboard: failed to load complaint stats:", err);
        // leave whatever is there
      }
    }

    // ============================
    // 2) Supplier stats
    // ============================
    // We map:
    //   - training card  = certificates expiring in next 30 days
    //   - critical card  = certificates already expired
    if (typeof window.fetchSupplierStats === "function") {
      try {
        var sStats = await window.fetchSupplierStats();
        // Expected shape:
        // { total, missing_cert, expiring_30_days, expired }

        if (trainingDueEl && sStats) {
          trainingDueEl.textContent = safeNumber(sStats.expiring_30_days);
        }

        if (criticalActionsEl && sStats) {
          criticalActionsEl.textContent = safeNumber(sStats.expired);
        }
      } catch (err) {
        console.warn("Dashboard: failed to load supplier stats:", err);
        // again, leave existing numbers alone
      }
    }
  }

  // Run once when the DOM is ready (useful on first load after refresh)
  document.addEventListener("DOMContentLoaded", function () {
    loadDashboardStats();
  });

  // Expose so app.js can call after login / when switching company etc.
  window.refreshDashboardStats = loadDashboardStats;
})();