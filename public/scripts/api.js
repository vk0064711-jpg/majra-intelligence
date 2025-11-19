// public/scripts/api.js
// Central API helper for Majra Intelligence

(function () {
  "use strict";

  var API_BASE_URL ="https://majra-intelligence.onrender.com";
  window.API_BASE_URL = API_BASE_URL;

  // ---------------- Token helpers ----------------
  function saveToken(token) {
    try {
      window.localStorage.setItem("majra_token", token);
    } catch (err) {
      console.warn("Unable to save token:", err);
    }
  }

  function getToken() {
    try {
      return window.localStorage.getItem("majra_token");
    } catch (err) {
      console.warn("Unable to read token:", err);
      return null;
    }
  }

  function clearToken() {
    try {
      window.localStorage.removeItem("majra_token");
    } catch (err) {
      console.warn("Unable to clear token:", err);
    }
  }

  window.saveToken = saveToken;
  window.getToken = getToken;
  window.clearToken = clearToken;

  // ---------------- Generic request ----------------
  async function apiRequest(path, options) {
    options = options || {};
    var method = options.method || "GET";
    var headers = options.headers || {};

    if (options.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    var token = getToken();
    if (token) {
      headers.Authorization = "Bearer " + token;
    }

    var fetchOptions = { method: method, headers: headers };

    if (options.body) {
      fetchOptions.body =
        typeof options.body === "string"
          ? options.body
          : JSON.stringify(options.body);
    }

    var res = await fetch(API_BASE_URL + "/api" + path, fetchOptions);

    if (!res.ok) {
      var message = "HTTP " + res.status;
      try {
        var data = await res.json();
        if (data && data.error) message = data.error;
      } catch (e) {}
      throw new Error(message);
    }

    if (res.status === 204) return null;
    return res.json();
  }

  // ---------------- AUTH ----------------
  async function registerUser(companyName, name, email, password) {
    var body = {
      company_name: companyName,
      name: name,
      companyName: companyName,
      fullName: name,
      email: email,
      password: password
    };

    var data = await apiRequest("/auth/register", {
      method: "POST",
      body: body
    });

    if (data && data.token) saveToken(data.token);
    return data;
  }

  async function loginUser(email, password) {
    var data = await apiRequest("/auth/login", {
      method: "POST",
      body: { email: email, password: password }
    });

    if (data && data.token) saveToken(data.token);
    return data;
  }

  async function getCurrentUser() {
    return apiRequest("/auth/me", { method: "GET" });
  }

  // ---------------- COMPLAINTS ----------------
  async function fetchComplaints() {
    var data = await apiRequest("/complaints", { method: "GET" });
    if (data && Array.isArray(data.complaints)) return data.complaints;
    return [];
  }

  async function createComplaint(body) {
    var data = await apiRequest("/complaints", {
      method: "POST",
      body: body
    });
    return data && data.complaint ? data.complaint : null;
  }

  async function updateComplaintStatus(id, status) {
    return apiRequest("/complaints/" + id + "/status", {
      method: "PATCH",
      body: { status: status }
    });
  }

  async function deleteComplaint(id) {
    return apiRequest("/complaints/" + id, { method: "DELETE" });
  }

  async function saveComplaintInvestigation(id, body) {
    return apiRequest("/complaints/" + id + "/investigation", {
      method: "PATCH",
      body: body
    });
  }

  async function fetchComplaintStats() {
    return apiRequest("/complaints/stats", { method: "GET" });
  }

  // ---------------- SUPPLIERS ----------------
  async function fetchSuppliers() {
    var data = await apiRequest("/suppliers", { method: "GET" });
    if (data && Array.isArray(data.suppliers)) return data.suppliers;
    return [];
  }

  async function createSupplier(body) {
    var data = await apiRequest("/suppliers", {
      method: "POST",
      body: body
    });
    return data && data.supplier ? data.supplier : null;
  }

  async function updateSupplier(id, body) {
    var data = await apiRequest("/suppliers/" + id, {
      method: "PATCH",
      body: body
    });
    return data && data.supplier ? data.supplier : null;
  }

  async function deleteSupplier(id) {
    return apiRequest("/suppliers/" + id, { method: "DELETE" });
  }

  async function fetchSupplierStats() {
    return apiRequest("/suppliers/stats", { method: "GET" });
  }

  // ---------------- DOCUMENTS ----------------
  async function fetchDocuments(params) {
    params = params || {};
    var queryParts = [];
    if (params.status) {
      queryParts.push("status=" + encodeURIComponent(params.status));
    }
    if (params.standard) {
      queryParts.push("standard=" + encodeURIComponent(params.standard));
    }
    var path = "/documents";
    if (queryParts.length) {
      path += "?" + queryParts.join("&");
    }

    var data = await apiRequest(path, { method: "GET" });
    if (data && Array.isArray(data.documents)) return data.documents;
    return [];
  }

  async function createDocument(body) {
    var data = await apiRequest("/documents", {
      method: "POST",
      body: body
    });
    return data && data.document ? data.document : null;
  }

  async function updateDocument(id, body) {
    var data = await apiRequest("/documents/" + id, {
      method: "PATCH",
      body: body
    });
    return data && data.document ? data.document : null;
  }

  async function deleteDocument(id) {
    return apiRequest("/documents/" + id, { method: "DELETE" });
  }

  async function fetchDocumentStats() {
    return apiRequest("/documents/stats", { method: "GET" });
  }

  // ---------------- TRAINING ----------------
  async function fetchTrainingRecords(params) {
    params = params || {};
    var parts = [];
    if (params.status) {
      parts.push("status=" + encodeURIComponent(params.status));
    }
    if (params.department) {
      parts.push("department=" + encodeURIComponent(params.department));
    }

    var path = "/training";
    if (parts.length) {
      path += "?" + parts.join("&");
    }

    var data = await apiRequest(path, { method: "GET" });
    if (data && Array.isArray(data.trainingRecords)) return data.trainingRecords;
    return [];
  }

  async function createTrainingRecord(body) {
    var data = await apiRequest("/training", {
      method: "POST",
      body: body
    });
    return data && data.training ? data.training : null;
  }

  async function updateTrainingRecord(id, body) {
    var data = await apiRequest("/training/" + id, {
      method: "PATCH",
      body: body
    });
    return data && data.training ? data.training : null;
  }

  async function deleteTrainingRecord(id) {
    return apiRequest("/training/" + id, { method: "DELETE" });
  }

  async function fetchTrainingStats() {
    return apiRequest("/training/stats", { method: "GET" });
  }

  // ---------------- AUDITS ----------------
  async function fetchAudits(status) {
    var path = "/audits";
    if (status) {
      path += "?status=" + encodeURIComponent(status);
    }
    var data = await apiRequest(path, { method: "GET" });
    if (data && Array.isArray(data.audits)) return data.audits;
    return [];
  }

  async function createAudit(body) {
    var data = await apiRequest("/audits", {
      method: "POST",
      body: body
    });
    return data && data.audit ? data.audit : null;
  }

  async function updateAudit(id, body) {
    var data = await apiRequest("/audits/" + id, {
      method: "PATCH",
      body: body
    });
    return data && data.audit ? data.audit : null;
  }

  async function deleteAudit(id) {
    return apiRequest("/audits/" + id, { method: "DELETE" });
  }

  async function fetchAuditStats() {
    return apiRequest("/audits/stats", { method: "GET" });
  }

  // ---------------- Expose globally ----------------
  window.registerUser = registerUser;
  window.loginUser = loginUser;
  window.getCurrentUser = getCurrentUser;

  window.fetchComplaints = fetchComplaints;
  window.createComplaint = createComplaint;
  window.updateComplaintStatus = updateComplaintStatus;
  window.deleteComplaint = deleteComplaint;
  window.saveComplaintInvestigation = saveComplaintInvestigation;
  window.fetchComplaintStats = fetchComplaintStats;

  window.fetchSuppliers = fetchSuppliers;
  window.createSupplier = createSupplier;
  window.updateSupplier = updateSupplier;
  window.deleteSupplier = deleteSupplier;
  window.fetchSupplierStats = fetchSupplierStats;

  window.fetchDocuments = fetchDocuments;
  window.createDocument = createDocument;
  window.updateDocument = updateDocument;
  window.deleteDocument = deleteDocument;
  window.fetchDocumentStats = fetchDocumentStats;

  window.fetchTrainingRecords = fetchTrainingRecords;
  window.createTrainingRecord = createTrainingRecord;
  window.updateTrainingRecord = updateTrainingRecord;
  window.deleteTrainingRecord = deleteTrainingRecord;
  window.fetchTrainingStats = fetchTrainingStats;

  window.fetchAudits = fetchAudits;
  window.createAudit = createAudit;
  window.updateAudit = updateAudit;
  window.deleteAudit = deleteAudit;
  window.fetchAuditStats = fetchAuditStats;
  window.fetchAuditScore = fetchAuditScore;
})();