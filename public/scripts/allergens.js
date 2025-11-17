// public/scripts/allergens.js
// Simple Allergen Awareness module (no backend / no database)

(function () {
  "use strict";

  // Expose a small API for app.js
  window.MajraAllergens = {
    init: initAllergens,
  };

  var initialised = false;

  // 14 UK allergens – short, practical text
  var ALLERGENS = [
    {
      key: "gluten",
      name: "Cereals containing gluten",
      examples: "Wheat, rye, barley, oats, spelt, khorasan (and their hybrid strains)",
      typicalFoods: "Bread, pastries, cakes, coatings, batter, pasta, breakfast cereals",
      handling:
        "Store gluten flours securely, control dust, schedule gluten-free last where possible, separate utensils where you can.",
    },
    {
      key: "crustaceans",
      name: "Crustaceans",
      examples: "Prawns, crab, lobster, crayfish",
      typicalFoods: "Seafood mixes, ready meals, soups, sauces",
      handling:
        "Prevent cross-contact with non-fish products, clean equipment thoroughly after use.",
    },
    {
      key: "eggs",
      name: "Eggs",
      examples: "Whole egg, egg white, egg yolk, dried or liquid egg",
      typicalFoods: "Cakes, pastries, mayonnaise, sauces, glazes, wash for bakery items",
      handling:
        "Control raw egg handling, avoid splashes, clean surfaces after egg use, keep recipes updated.",
    },
    {
      key: "fish",
      name: "Fish",
      examples: "All fish species and fish products",
      typicalFoods: "Fish pies, sauces, stocks, powders, anchovy in dressings",
      handling:
        "Prevent cross-contact through shared oil, shared utensils and surfaces, especially for non-fish products.",
    },
    {
      key: "peanuts",
      name: "Peanuts",
      examples: "Groundnuts, peanut butter, peanut oil (unrefined)",
      typicalFoods: "Snacks, bars, confectionery, sauces",
      handling:
        "Very strong allergen. Keep peanut ingredients completely separated and labelled. Consider dedicated tools and storage.",
    },
    {
      key: "soybeans",
      name: "Soybeans",
      examples: "Soya flour, soy protein, tofu, soy sauce, edamame",
      typicalFoods: "Bakery improvers, sauces, marinades, vegetarian/vegan products",
      handling:
        "Check improvers and mixes. Keep records of soya-containing ingredients and control cross-contact.",
    },
    {
      key: "milk",
      name: "Milk",
      examples: "Milk, cream, butter, cheese, yoghurt, whey, casein",
      typicalFoods: "Most bakery items, chocolate, desserts, sauces, toppings",
      handling:
        "Control use of milk powders and liquid spills. Validate cleaning between dairy and non-dairy runs.",
    },
    {
      key: "nuts",
      name: "Tree nuts",
      examples: "Almond, hazelnut, walnut, cashew, pecan, Brazil, pistachio, macadamia",
      typicalFoods: "Baked goods, pralines, nut mixes, desserts, pesto",
      handling:
        "Very strong allergen. Segregate storage, consider dedicated tools, and control dust and fragments.",
    },
    {
      key: "celery",
      name: "Celery",
      examples: "Celery sticks, leaf, root (celeriac), celery salt",
      typicalFoods: "Soups, stocks, sauces, seasonings, ready meals",
      handling:
        "Watch out for celery in seasonings and powders. Ensure it is declared correctly on label.",
    },
    {
      key: "mustard",
      name: "Mustard",
      examples: "Mustard flour, seeds, powder, prepared mustard, mustard oil",
      typicalFoods: "Dressings, sauces, marinades, spice blends, bakery mixes",
      handling:
        "Control powders and seeds to avoid cross-contact. Check mixed spice declarations.",
    },
    {
      key: "sesame",
      name: "Sesame",
      examples: "Sesame seeds, tahini, sesame oil (unrefined)",
      typicalFoods: "Bread toppings, bakery, snack bars, hummus, dressings",
      handling:
        "Seeds travel easily. Use trays/lids where possible, manage toppings, clean down thoroughly.",
    },
    {
      key: "sulphites",
      name: "Sulphur dioxide / Sulphites",
      examples: "E220–E228 when added at ≥10 mg/kg or 10 mg/litre",
      typicalFoods: "Dried fruit, wine, some sauces, some processed potatoes",
      handling:
        "Check specifications for sulphites. Required on label if at or above legal threshold.",
    },
    {
      key: "lupin",
      name: "Lupin",
      examples: "Lupin flour, lupin seeds",
      typicalFoods: "Some specialty bakery products and gluten-free items",
      handling:
        "Check gluten-free mixes and speciality flours. Ensure correct allergen declaration.",
    },
    {
      key: "molluscs",
      name: "Molluscs",
      examples: "Mussels, squid, octopus, snails, clams, oysters",
      typicalFoods: "Seafood mixes, chowders, some sauces and ready meals",
      handling:
        "Handle similarly to crustaceans – avoid cross-contact with non-seafood products.",
    },
  ];

  // -------------------------
  // INIT
  // -------------------------
  function initAllergens() {
    if (initialised) return;
    initialised = true;

    var tbody = document.getElementById("allergen-list-body");
    if (!tbody) {
      // View not on this page – nothing to do
      return;
    }

    renderAllergenList("");

    var searchInput = document.getElementById("allergen-search");
    if (searchInput) {
      searchInput.addEventListener("input", function () {
        var term = searchInput.value || "";
        renderAllergenList(term);
      });
    }

    setupLabelHelper();
  }

  // -------------------------
  // RENDER LIST
  // -------------------------
  function renderAllergenList(searchTerm) {
    var tbody = document.getElementById("allergen-list-body");
    if (!tbody) return;

    searchTerm = (searchTerm || "").toLowerCase();
    tbody.innerHTML = "";

    var filtered = ALLERGENS.filter(function (a) {
      if (!searchTerm) return true;
      return (
        a.name.toLowerCase().includes(searchTerm) ||
        a.examples.toLowerCase().includes(searchTerm) ||
        a.typicalFoods.toLowerCase().includes(searchTerm)
      );
    });

    filtered.forEach(function (a, idx) {
      var tr = document.createElement("tr");
      tr.style.cursor = "pointer";
      tr.setAttribute("data-allergen-key", a.key);

      tr.innerHTML =
        "<td>" +
        (idx + 1) +
        "</td>" +
        "<td>" +
        a.name +
        "</td>" +
        "<td>" +
        a.typicalFoods +
        "</td>";

      tr.addEventListener("click", function () {
        showAllergenDetails(a.key);
      });

      tbody.appendChild(tr);
    });
  }

  // -------------------------
  // SHOW DETAILS
  // -------------------------
  function showAllergenDetails(key) {
    var allergen = ALLERGENS.find(function (a) {
      return a.key === key;
    });
    if (!allergen) return;

    var titleEl = document.getElementById("allergen-detail-title");
    var descEl = document.getElementById("allergen-detail-description");
    var extraEl = document.getElementById("allergen-detail-extra");

    if (titleEl) {
      titleEl.textContent = allergen.name;
    }

    if (descEl) {
      descEl.textContent =
        allergen.examples +
        ". Typical foods: " +
        allergen.typicalFoods +
        ".";
    }

    if (extraEl) {
      extraEl.innerHTML =
        "<strong>Handling tips:</strong> " + escapeHtml(allergen.handling);
    }
  }

  // -------------------------
  // LABEL HELPER
  // -------------------------
  function setupLabelHelper() {
    var container = document.getElementById("allergen-label-checkboxes");
    var output = document.getElementById("allergen-label-output");
    if (!container || !output) return;

    container.innerHTML = "";

    ALLERGENS.forEach(function (a) {
      var label = document.createElement("label");
      label.style.display = "inline-flex";
      label.style.alignItems = "center";
      label.style.gap = "4px";
      label.style.fontSize = "0.8rem";
      label.style.padding = "2px 6px";
      label.style.borderRadius = "999px";
      label.style.background = "#e5e7eb";

      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = a.name;
      cb.addEventListener("change", updateLabelOutput);

      label.appendChild(cb);
      var span = document.createElement("span");
      span.textContent = a.name;
      label.appendChild(span);

      container.appendChild(label);
    });

    // Radio buttons
    var radios = document.querySelectorAll(
      "input[name='allergen-label-type']"
    );
    radios.forEach(function (r) {
      r.addEventListener("change", updateLabelOutput);
    });

    // Initial text
    updateLabelOutput();

    function updateLabelOutput() {
      var selected = [];
      container
        .querySelectorAll("input[type='checkbox']")
        .forEach(function (cb) {
          if (cb.checked) selected.push(cb.value);
        });

      var labelType = "contains";
      radios.forEach(function (r) {
        if (r.checked) labelType = r.value;
      });

      if (!selected.length) {
        output.value =
          "Contains: (select allergens above) OR May contain: (for cross-contact only).";
        return;
      }

      var joined = selected.join(", ");

      if (labelType === "may_contain") {
        output.value = "May contain: " + joined + ".";
      } else {
        output.value = "Contains: " + joined + ".";
      }
    }
  }

  // -------------------------
  // Small helper
  // -------------------------
  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
})();