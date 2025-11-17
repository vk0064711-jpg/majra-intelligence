// public/scripts/suppliers.js
// Supplier UI + calls to backend (SQLite)

(function () {
  "use strict";

  // Local logo storage key
  var LOGO_KEY = "majra_supplier_logos";

  function loadLogos() {
    try {
      var txt = window.localStorage.getItem(LOGO_KEY);
      if (!txt) return {};
      return JSON.parse(txt);
    } catch (e) {
      console.warn("Unable to load supplier logos:", e);
      return {};
    }
  }

  function saveLogos(logos) {
    try {
      window.localStorage.setItem(LOGO_KEY, JSON.stringify(logos));
    } catch (e) {
      console.warn("Unable to save supplier logos:", e);
    }
  }

  function formatYMDToDMY(ymd) {
    if (!ymd) return "";
    var parts = ymd.split("-");
    if (parts.length !== 3) return ymd;
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }

  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("supplier-form");
    if (!form) return; // no suppliers section visible

    // Try multiple IDs to match your HTML
    var idInput =
      document.getElementById("supplier-id") ||
      document.getElementById("supp-id");

    var nameInput =
      document.getElementById("supp-name") ||
      document.getElementById("supplier-name");

    var productInput =
      document.getElementById("supp-product") ||
      document.getElementById("supplier-product");

    var certSelect =
      document.getElementById("supp-certificate") ||
      document.getElementById("supplier-cert-main");

    var expiryInput =
      document.getElementById("supp-expiry") ||
      document.getElementById("supplier-cert-expiry");

    var logoInput =
      document.getElementById("supp-logo-file") ||
      document.getElementById("supplier-logo-file");

    var messageEl = document.getElementById("suppliers-message");
    var tableBody = document.getElementById("suppliers-table-body");
    var resetBtn = document.getElementById("supplier-reset-btn");
    var saveBtn = document.getElementById("supplier-save-btn");

    var suppliersCache = [];
    var logoMap = loadLogos();

    function setMessage(msg, isError) {
      if (!messageEl) return;
      messageEl.textContent = msg || "";
      messageEl.style.color = isError ? "#b91c1c" : "#166534";
    }

    function clearForm() {
      if (idInput) idInput.value = "";
      if (nameInput) nameInput.value = "";
      if (productInput) productInput.value = "";
      if (certSelect) certSelect.value = "";
      if (expiryInput) expiryInput.value = "";
      if (logoInput) logoInput.value = "";
      if (saveBtn) saveBtn.textContent = "Save Supplier";
    }

    function renderSuppliers() {
      if (!tableBody) return;
      tableBody.innerHTML = "";

      if (!suppliersCache.length) {
        var trEmpty = document.createElement("tr");
        var tdEmpty = document.createElement("td");
        tdEmpty.colSpan = 6;
        tdEmpty.textContent = "No suppliers added yet.";
        trEmpty.appendChild(tdEmpty);
        tableBody.appendChild(trEmpty);
        return;
      }

      suppliersCache.forEach(function (s) {
        var tr = document.createElement("tr");

        // Logo cell
        var tdLogo = document.createElement("td");
        var logoData = logoMap[s.id];
        if (logoData) {
          var img = document.createElement("img");
          img.src = logoData;
          img.alt = "Logo";
          img.style.width = "32px";
          img.style.height = "32px";
          img.style.objectFit = "cover";
          img.style.borderRadius = "999px";
          tdLogo.appendChild(img);
        } else {
          tdLogo.textContent = "—";
        }

        var tdName = document.createElement("td");
        tdName.textContent = s.name || "";

        var tdProd = document.createElement("td");
        tdProd.textContent = s.material || "";

        var tdCert = document.createElement("td");
        tdCert.textContent = s.certificate_type || "";

        var tdExpiry = document.createElement("td");
        tdExpiry.textContent = formatYMDToDMY(s.certificate_expiry || "");

        var tdActions = document.createElement("td");

        var btnEdit = document.createElement("button");
        btnEdit.textContent = "Edit";
        btnEdit.className = "btn-table";
        btnEdit.addEventListener("click", function () {
          startEditSupplier(s);
        });

        var btnDelete = document.createElement("button");
        btnDelete.textContent = "Delete";
        btnDelete.className = "btn-table delete";
        btnDelete.style.marginLeft = "4px";
        btnDelete.addEventListener("click", function () {
          deleteSupplierHandler(s.id);
        });

        tdActions.appendChild(btnEdit);
        tdActions.appendChild(btnDelete);

        tr.appendChild(tdLogo);
        tr.appendChild(tdName);
        tr.appendChild(tdProd);
        tr.appendChild(tdCert);
        tr.appendChild(tdExpiry);
        tr.appendChild(tdActions);

        tableBody.appendChild(tr);
      });
    }

    async function loadSuppliers() {
      try {
        setMessage("");
        var list = await window.fetchSuppliers();
        suppliersCache = list || [];
        renderSuppliers();
      } catch (err) {
        console.error("Error loading suppliers:", err);
        setMessage("Failed to load suppliers", true);
      }
    }

    function startEditSupplier(s) {
      if (idInput) idInput.value = s.id;
      if (nameInput) nameInput.value = s.name || "";
      if (productInput) productInput.value = s.material || "";
      if (certSelect) certSelect.value = s.certificate_type || "";
      if (expiryInput) expiryInput.value = s.certificate_expiry || "";
      if (saveBtn) saveBtn.textContent = "Update Supplier";
      setMessage("Editing supplier: " + (s.name || ""));
    }

    async function deleteSupplierHandler(id) {
      if (!window.confirm("Delete this supplier?")) return;
      try {
        await window.deleteSupplier(id);
        delete logoMap[id];
        saveLogos(logoMap);
        suppliersCache = suppliersCache.filter(function (s) {
          return s.id !== id;
        });
        renderSuppliers();
        setMessage("Supplier deleted");
      } catch (err) {
        console.error("Error deleting supplier:", err);
        setMessage("Failed to delete supplier", true);
      }
    }

    form.addEventListener("submit", function (evt) {
      evt.preventDefault();
      saveSupplierHandler();
    });

    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        clearForm();
        setMessage("");
      });
    }

    async function saveSupplierHandler() {
      var name = nameInput ? nameInput.value.trim() : "";
      var material = productInput ? productInput.value.trim() : "";
      var certificate_type = certSelect ? (certSelect.value || "").trim() : "";
      var certificate_expiry = expiryInput ? (expiryInput.value || "").trim() : "";

      if (!name) {
        setMessage("Supplier name is required", true);
        return;
      }

      var payload = {
        name: name,
        material: material,
        certificate_type: certificate_type,
        certificate_expiry: certificate_expiry,
        risk_level: "",
        status: "",
        notes: "",
      };

      var isEdit = idInput && idInput.value;
      var supplier;

      try {
        setMessage("");

        if (isEdit) {
          supplier = await window.updateSupplier(idInput.value, payload);
        } else {
          supplier = await window.createSupplier(payload);
        }

        if (!supplier) {
          setMessage("Failed to save supplier", true);
          return;
        }

        // handle logo (local only)
        var file = logoInput && logoInput.files && logoInput.files[0];
        if (file) {
          var reader = new FileReader();
          reader.onload = function (e) {
            logoMap[supplier.id] = e.target.result;
            saveLogos(logoMap);
            renderSuppliers();
          };
          reader.readAsDataURL(file);
        }

        // update cache + UI
        if (isEdit) {
          suppliersCache = suppliersCache.map(function (s) {
            return s.id === supplier.id ? supplier : s;
          });
        } else {
          suppliersCache.push(supplier);
        }

        renderSuppliers();
        clearForm();
        setMessage(isEdit ? "Supplier updated" : "Supplier added");
      } catch (err) {
        console.error("Error saving supplier:", err);
        setMessage("Failed to save supplier: " + err.message, true);
      }
    }

    // Initial load
    loadSuppliers();
  });
})();