// public/scripts/app.js
// Main app shell: auth, navigation, dashboard, branding

(function () {
  "use strict";

  var currentUser = null;
  var authCompanyName = null;

  var BRANDING_KEY = "majra_branding";
  var currentBranding = null;

  // -----------------------------
  // Branding helpers
  // -----------------------------
  function saveBrandingToStorage(branding) {
    try {
      window.localStorage.setItem(BRANDING_KEY, JSON.stringify(branding));
    } catch (err) {
      console.warn("Unable to save branding:", err);
    }
  }

  function loadBrandingFromStorage() {
    try {
      var raw = window.localStorage.getItem(BRANDING_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      console.warn("Unable to read branding:", err);
      return null;
    }
  }

  function applyBranding(branding) {
    branding = branding || {};

    var displayName =
      branding.companyDisplayName ||
      authCompanyName ||
      "Company";

    // Top bar company name
    var topCompanyEl = document.getElementById("top-company-name");
    if (topCompanyEl && displayName) {
      topCompanyEl.textContent = displayName;
    }

    // Letter company name
    var letterNameEl = document.getElementById("letter-company-name-display");
    if (letterNameEl) {
      letterNameEl.textContent = displayName;
    }

    // Letter footer
    var footerEl = document.getElementById("letter-company-footer");
    if (footerEl) {
      footerEl.textContent = "© 2025 " + displayName + " · Company Logo";
    }

    // Logos
    var topLogoImg = document.getElementById("top-logo-img");
    var topLogoCircle = document.getElementById("top-logo-circle");
    var letterLogoImg = document.getElementById("letter-logo-img");
    var letterLogoCircle = document.getElementById("letter-logo-circle");

    var hasLogo = !!branding.logoDataUrl;

    if (topLogoImg && topLogoCircle) {
      if (hasLogo) {
        topLogoImg.src = branding.logoDataUrl;
        topLogoImg.style.display = "inline-block";
        topLogoCircle.style.display = "none";
      } else {
        topLogoImg.style.display = "none";
        topLogoCircle.style.display = "flex";
      }
    }

    if (letterLogoImg && letterLogoCircle) {
      if (hasLogo) {
        letterLogoImg.src = branding.logoDataUrl;
        letterLogoImg.style.display = "inline-block";
        letterLogoCircle.style.display = "none";
      } else {
        letterLogoImg.style.display = "none";
        letterLogoCircle.style.display = "flex";
      }
    }
  }

  function initBrandingForm() {
    var form = document.getElementById("branding-form");
    if (!form) return;

    var nameInput = document.getElementById("settings-company-display-name");
    var fileInput = document.getElementById("settings-logo-file");
    var msgEl = document.getElementById("settings-branding-message");

    // Prefill from stored branding
    if (currentBranding && nameInput) {
      nameInput.value = currentBranding.companyDisplayName || "";
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      if (msgEl) {
        msgEl.textContent = "";
        msgEl.style.color = "";
      }

      var displayName = nameInput ? nameInput.value.trim() : "";

      var brandingToSave = {
        companyDisplayName:
          displayName ||
          (currentBranding && currentBranding.companyDisplayName) ||
          null,
        logoDataUrl:
          (currentBranding && currentBranding.logoDataUrl) || null
      };

      var file =
        fileInput && fileInput.files && fileInput.files.length
          ? fileInput.files[0]
          : null;

      function finishSave() {
        currentBranding = brandingToSave;
        saveBrandingToStorage(currentBranding);
        applyBranding(currentBranding);

        if (msgEl) {
          msgEl.textContent = "Branding saved.";
          msgEl.style.color = "green";
        }

        if (fileInput) {
          fileInput.value = "";
        }
      }

      if (file) {
        var reader = new FileReader();
        reader.onload = function (evt) {
          brandingToSave.logoDataUrl = evt.target.result;
          finishSave();
        };
        reader.onerror = function () {
          if (msgEl) {
            msgEl.textContent = "Error reading logo file.";
            msgEl.style.color = "red";
          }
        };
        reader.readAsDataURL(file);
      } else {
        finishSave();
      }
    });
  }

  // -----------------------------
  // Auth + main layout
  // -----------------------------
  function showAuthOnly() {
    var authContainer = document.getElementById("auth-container");
    var dashboard = document.getElementById("dashboard");
    if (authContainer) authContainer.style.display = "block";
    if (dashboard) dashboard.style.display = "none";
  }

  function showDashboardOnly() {
    var authContainer = document.getElementById("auth-container");
    var dashboard = document.getElementById("dashboard");
    if (authContainer) authContainer.style.display = "none";
    if (dashboard) dashboard.style.display = "block";
  }

  function updateUserUI() {
    if (!currentUser) return;

    var companyName =
      currentUser.company_name || authCompanyName || "Company";
    authCompanyName = companyName;

    var dashUser = document.getElementById("dashboard-user");
    var dashCompany = document.getElementById("dashboard-company");
    var topCompanyEl = document.getElementById("top-company-name");
    var topEmailEl = document.getElementById("top-user-email");

    if (dashUser) {
      dashUser.textContent =
        "Logged in as: " +
        (currentUser.name || currentUser.email || "User");
    }
    if (dashCompany) {
      dashCompany.textContent = "Company: " + companyName;
    }
    if (topCompanyEl) {
      topCompanyEl.textContent = companyName;
    }
    if (topEmailEl && currentUser.email) {
      topEmailEl.textContent = currentUser.email;
    }

    // Apply branding with known company name
    applyBranding(currentBranding || {});
  }

  function handleRegisterSubmit(e) {
    e.preventDefault();

    var companyEl = document.getElementById("reg-company");
    var nameEl = document.getElementById("reg-name");
    var emailEl = document.getElementById("reg-email");
    var passEl = document.getElementById("reg-password");
    var msgEl = document.getElementById("register-message");

    if (msgEl) {
      msgEl.textContent = "";
      msgEl.style.color = "";
    }

    var companyName = companyEl ? companyEl.value.trim() : "";
    var personName = nameEl ? nameEl.value.trim() : "";
    var email = emailEl ? emailEl.value.trim() : "";
    var password = passEl ? passEl.value : "";

    if (!companyName || !personName || !email || !password) {
      if (msgEl) {
        msgEl.textContent = "Registration failed: Missing required fields.";
        msgEl.style.color = "red";
      }
      return;
    }

    if (typeof window.registerUser !== "function") {
      if (msgEl) {
        msgEl.textContent = "Registration API not available.";
        msgEl.style.color = "red";
      }
      return;
    }

    window
      .registerUser(companyName, personName, email, password)
      .then(function () {
        if (msgEl) {
          msgEl.textContent =
            "Registered successfully. You can now log in with this email.";
          msgEl.style.color = "green";
        }

        var loginEmail = document.getElementById("login-email");
        if (loginEmail) {
          loginEmail.value = email;
        }
      })
      .catch(function (err) {
        console.error("registerUser error:", err);
        if (msgEl) {
          msgEl.textContent =
            "Registration failed: " + (err.message || "Unknown error");
          msgEl.style.color = "red";
        }
      });
  }

  function handleLoginSubmit(e) {
    e.preventDefault();

    var emailEl = document.getElementById("login-email");
    var passEl = document.getElementById("login-password");
    var msgEl = document.getElementById("login-message");

    if (msgEl) {
      msgEl.textContent = "";
      msgEl.style.color = "";
    }

    var email = emailEl ? emailEl.value.trim() : "";
    var password = passEl ? passEl.value : "";

    if (!email || !password) {
      if (msgEl) {
        msgEl.textContent = "Login failed: Email and password are required.";
        msgEl.style.color = "red";
      }
      return;
    }

    if (typeof window.loginUser !== "function") {
      if (msgEl) {
        msgEl.textContent = "Login API not available.";
        msgEl.style.color = "red";
      }
      return;
    }

    window
      .loginUser(email, password)
      .then(function () {
        if (msgEl) {
          msgEl.textContent = "Login successful.";
          msgEl.style.color = "green";
        }
        fetchCurrentUserAndEnterApp();
      })
      .catch(function (err) {
        console.error("loginUser error:", err);
        if (msgEl) {
          msgEl.textContent =
            "Login failed: " + (err.message || "Unknown error");
          msgEl.style.color = "red";
        }
      });
  }

  function fetchCurrentUserAndEnterApp() {
    if (typeof window.getCurrentUser !== "function") {
      showAuthOnly();
      return;
    }

    window
      .getCurrentUser()
      .then(function (user) {
        currentUser = user || null;
        if (!currentUser) {
          showAuthOnly();
          return;
        }

        authCompanyName = currentUser.company_name || "Company";

        showDashboardOnly();
        updateUserUI();
        initAfterLogin();
      })
      .catch(function (err) {
        console.warn("getCurrentUser error:", err);
        if (typeof window.clearToken === "function") {
          window.clearToken();
        }
        showAuthOnly();
      });
  }

  function initAuth() {
    var regForm = document.getElementById("register-form");
    var loginForm = document.getElementById("login-form");
    var logoutBtn = document.getElementById("logout-btn");

    if (regForm) {
      regForm.addEventListener("submit", handleRegisterSubmit);
    }
    if (loginForm) {
      loginForm.addEventListener("submit", handleLoginSubmit);
    }
    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        if (typeof window.clearToken === "function") {
          window.clearToken();
        }
        currentUser = null;
        authCompanyName = null;
        showAuthOnly();
      });
    }
  }

  // -----------------------------
  // Navigation
  // -----------------------------
  function showView(viewId) {
    var views = document.querySelectorAll(".app-view");
    for (var i = 0; i < views.length; i++) {
      var v = views[i];
      if (v.id === viewId) v.classList.add("active");
      else v.classList.remove("active");
    }

    var buttons = document.querySelectorAll(".nav-btn");
    for (var j = 0; j < buttons.length; j++) {
      var btn = buttons[j];
      var target = btn.getAttribute("data-view");
      if (target === viewId) btn.classList.add("active");
      else btn.classList.remove("active");
    }
  }

  function initNavigation() {
    var buttons = document.querySelectorAll(".nav-btn");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function (e) {
        var target = e.currentTarget.getAttribute("data-view");
        if (!target) return;
        showView(target);
      });
    }

    // Card shortcut: Open Complaints
    var openComplaintsCard = document.getElementById(
      "card-open-complaints"
    );
    if (openComplaintsCard) {
      openComplaintsCard.addEventListener("click", function () {
        showView("view-complaints");
      });
    }

    // Card shortcut: Suppliers
    var suppliersCard = document.getElementById("card-suppliers");
    if (suppliersCard) {
      suppliersCard.addEventListener("click", function () {
        showView("view-suppliers");
      });
    }

    // Card shortcut: Audits (if you later add a card with id="card-audits")
    var auditsCard = document.getElementById("card-audits");
    if (auditsCard) {
      auditsCard.addEventListener("click", function () {
        showView("view-audits");
      });
    }
  }

  // -----------------------------
  // Dashboard stats
  // -----------------------------
  async function loadDashboardStats() {
    try {
      // Complaints open count (simple field 'open')
      if (typeof window.fetchComplaintStats === "function") {
        var complaintStats = await window.fetchComplaintStats();
        if (complaintStats && complaintStats.open !== undefined) {
          var el = document.getElementById(
            "dashboard-open-complaints-count"
          );
          if (el) el.textContent = complaintStats.open;
        }
      }

      // Suppliers total (if card exists)
      if (typeof window.fetchSupplierStats === "function") {
        var supplierStats = await window.fetchSupplierStats();
        if (supplierStats && supplierStats.total !== undefined) {
          var sEl = document.getElementById("dashboard-supplier-count");
          if (sEl) sEl.textContent = supplierStats.total;
        }

        // Optional: suppliers needing attention
        var attEl = document.getElementById(
          "dashboard-supplier-attention-count"
        );
        if (attEl && supplierStats) {
          var att =
            (supplierStats.expired || 0) +
            (supplierStats.expiring_30_days || 0) +
            (supplierStats.missing_cert || 0);
          attEl.textContent = att;
        }
      }

      // ✅ Training due soon (30 days)
      if (typeof window.fetchTrainingStats === "function") {
        var trainingStats = await window.fetchTrainingStats();
        if (trainingStats && trainingStats.due_30_days !== undefined) {
          var tEl = document.getElementById("dashboard-training-due-count");
          if (tEl) tEl.textContent = trainingStats.due_30_days;
        }
      }

      // Audits stats
      if (typeof window.fetchAuditStats === "function") {
        var auditStats = await window.fetchAuditStats();
        if (auditStats && auditStats.open !== undefined) {
          var aEl = document.getElementById("dashboard-open-audits-count");
          if (aEl) aEl.textContent = auditStats.open;
        }
      }
    } catch (err) {
      console.warn("Dashboard stats error:", err);
    }
  }

  // Your existing function that calculates open complaints from statusCounts
  function updateDashboardStats() {
    var openComplaintsEl = document.getElementById(
      "dashboard-open-complaints-count"
    );

    if (typeof window.fetchComplaintStats === "function") {
      window
        .fetchComplaintStats()
        .then(function (stats) {
          if (!stats || !Array.isArray(stats.statusCounts)) return;

          var openCount = 0;
          for (var i = 0; i < stats.statusCounts.length; i++) {
            var row = stats.statusCounts[i];
            var status = (row.status || "").toLowerCase();
            var count = row.count || 0;
            if (status !== "closed") {
              openCount += count;
            }
          }
          if (openComplaintsEl) {
            openComplaintsEl.textContent = openCount;
          }
        })
        .catch(function (err) {
          console.warn("fetchComplaintStats error:", err);
        });
    }
  }

  // -----------------------------
  // After login
  // -----------------------------
  function initAfterLogin() {
    // Complaints module
    if (window.MajraComplaints && window.MajraComplaints.loadComplaints) {
      window.MajraComplaints.loadComplaints();
    }

    // Suppliers module
    if (window.MajraSuppliers && window.MajraSuppliers.loadSuppliers) {
      window.MajraSuppliers.loadSuppliers();
    }

    // Documents
    if (window.MajraDocuments && window.MajraDocuments.loadDocuments) {
      window.MajraDocuments.loadDocuments();
    }

    // Audits module
    if (window.MajraAudits && window.MajraAudits.loadAudits) {
      window.MajraAudits.loadAudits();
    }

  // ✅ Allergen awareness (frontend only)
    if (window.MajraAllergens && window.MajraAllergens.init) {
      window.MajraAllergens.init();
    }

    // Dashboard numbers
    loadDashboardStats();
    updateDashboardStats();

    // Default view
    showView("view-dashboard");
  }

  // -----------------------------
  // DOMContentLoaded
  // -----------------------------
  document.addEventListener("DOMContentLoaded", function () {
    // Load branding from storage first
    currentBranding = loadBrandingFromStorage() || {};

    initAuth();
    initNavigation();
    initBrandingForm();

    // Apply branding once (will refresh after user info loads)
    applyBranding(currentBranding);

    // If token already stored, try auto-login
    if (typeof window.getToken === "function" && window.getToken()) {
      fetchCurrentUserAndEnterApp();
    } else {
      showAuthOnly();
    }
  });
})();