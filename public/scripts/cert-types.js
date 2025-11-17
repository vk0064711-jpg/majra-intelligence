// public/scripts/cert-types.js
// Manage editable certificate types for Suppliers (localStorage only)

(function () {
  "use strict";

  var DEFAULT_CERT_TYPES = [
    "SALSA",
    "BRCGS",
    "ISO 22000",
    "FSSC 22000",
    "Red Tractor",
    "Organic",
    "Soil Association",
    "Fairtrade",
    "RSPO",
    "Halal",
    "Kosher"
  ];

  var STORAGE_KEY = "majra_cert_types_v1";
  var certTypes = [];

  function loadCertTypes() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          certTypes = parsed;
          return;
        }
      }
    } catch (err) {
      console.warn("Unable to read cert types from storage:", err);
    }
    // Fallback to defaults
    certTypes = DEFAULT_CERT_TYPES.slice();
  }

  function saveCertTypes() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(certTypes));
    } catch (err) {
      console.warn("Unable to save cert types:", err);
    }
  }

  function renderSelect() {
    var select = document.getElementById("supplier-cert-type");
    if (!select) return;

    var previous = select.value;
    select.innerHTML = "";

    var placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "-- Select certificate --";
    select.appendChild(placeholder);

    certTypes.forEach(function (name) {
      var opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });

    if (previous && certTypes.indexOf(previous) !== -1) {
      select.value = previous;
    } else {
      select.value = "";
    }
  }

  function renderList() {
    var list = document.getElementById("cert-type-list");
    if (!list) return;

    list.innerHTML = "";

    if (!certTypes.length) {
      list.textContent = "No certificate types defined yet.";
      list.style.fontSize = "0.8rem";
      list.style.color = "#6b7280";
      return;
    }

    certTypes.forEach(function (name) {
      var pill = document.createElement("span");
      pill.className = "tag-pill";

      var txt = document.createElement("span");
      txt.textContent = name;
      pill.appendChild(txt);

      // Only allow removing non-default types
      if (DEFAULT_CERT_TYPES.indexOf(name) === -1) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "tag-remove";
        btn.textContent = "×";
        btn.setAttribute("data-name", name);
        pill.appendChild(btn);
      }

      list.appendChild(pill);
    });
  }

  function addCertType(name) {
    if (!name) return;
    name = name.trim();
    if (!name) return;

    // Normalise spaces
    name = name.replace(/\s+/g, " ");

    if (certTypes.indexOf(name) !== -1) {
      alert("This certificate type already exists.");
      return;
    }

    certTypes.push(name);
    certTypes.sort(function (a, b) {
      return a.localeCompare(b);
    });

    saveCertTypes();
    renderSelect();
    renderList();
  }

  function removeCertType(name) {
    var idx = certTypes.indexOf(name);
    if (idx === -1) return;

    if (DEFAULT_CERT_TYPES.indexOf(name) !== -1) {
      alert("Built-in certificate types cannot be removed.");
      return;
    }

    if (!window.confirm('Remove certificate type "' + name + '"?')) {
      return;
    }

    certTypes.splice(idx, 1);
    saveCertTypes();
    renderSelect();
    renderList();
  }

  function initUI() {
    var addBtn = document.getElementById("cert-type-add-btn");
    var input = document.getElementById("cert-type-new");
    var list = document.getElementById("cert-type-list");

    if (addBtn && input) {
      addBtn.addEventListener("click", function () {
        addCertType(input.value);
        input.value = "";
        input.focus();
      });

      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          addCertType(input.value);
          input.value = "";
        }
      });
    }

    if (list) {
      list.addEventListener("click", function (e) {
        var btn = e.target.closest("button[data-name]");
        if (!btn) return;
        var name = btn.getAttribute("data-name");
        removeCertType(name);
      });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    loadCertTypes();
    initUI();
    renderSelect();
    renderList();
  });
})();