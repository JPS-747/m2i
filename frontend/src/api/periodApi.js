const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

async function request(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
  };

  if (
    options.body !== undefined &&
    !(options.body instanceof FormData) &&
    !headers["Content-Type"]
  ) {
    headers["Content-Type"] = "application/json";
  }

  const fullUrl = `${API_BASE_URL}${path}`;
  console.log(`[request] ${options.method || "GET"} ${fullUrl}`);

  const response = await fetch(fullUrl, {
    headers,
    ...options,
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      detail = payload.detail || payload.message || detail;
    } catch {
      // ignore parse error
    }
    throw new Error(detail);
  }

  return response.json();
}

export const PeriodApi = {
  latest: () => request("/periods/latest"),
  latest12: () => request("/periods/latest-12"),
  systemFilesSummary: () => request("/files/system"),
  bankFilesSummary: () => request("/files/bank"),
  previewFile: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request("/files/preview", { method: "POST", body: formData });
  },
  importSystemFileWithMapping: (file, columnMapping, columnTransformations, onProgress) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async () => {
        try {
          const text = reader.result;
          const rowCount = Math.max(1, text.split("\n").length - 2); // Subtract header and potential blank line

          const formData = new FormData();
          formData.append("file", file);
          formData.append("mapping", JSON.stringify(columnMapping));
          formData.append(
            "transformations",
            JSON.stringify(columnTransformations || {})
          );

          // Time-based progress simulation
          const startTime = Date.now();
          if (onProgress) {
            onProgress(Math.ceil(rowCount * 0.05), rowCount);
          }

          const progressInterval = setInterval(() => {
            // Smooth progress based on elapsed time, asymptotically approaching 99%
            const elapsedSeconds = (Date.now() - startTime) / 1000;
            // Use exponential curve: 0.05 + (0.94 * (1 - e^(-elapsed/2)))
            const simulatedProgress =
              5 + 94 * (1 - Math.exp(-elapsedSeconds / 2));
            if (onProgress) {
              onProgress(
                Math.ceil(rowCount * (simulatedProgress / 100)),
                rowCount
              );
            }
          }, 300);

          try {
            const result = await request("/files/system/import-mapped", {
              method: "POST",
              body: formData,
            });

            clearInterval(progressInterval);
            // Set final progress to actual inserted + skipped count (100%)
            if (onProgress && result.inserted_count !== undefined) {
              const totalProcessed =
                result.inserted_count + (result.skipped_count || 0);
              onProgress(totalProcessed, rowCount);
            }

            resolve(result);
          } catch (error) {
            clearInterval(progressInterval);
            reject(error);
          }
        } catch (error) {
          reject(error);
        }
      };

      reader.readAsText(file);
    });
  },
  importBankFileWithMapping: (
    file,
    columnMapping,
    columnTransformations,
    onProgress
  ) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async () => {
        try {
          const text = reader.result;
          const rowCount = Math.max(1, text.split("\n").length - 2); // Subtract header and potential blank line

          const formData = new FormData();
          formData.append("file", file);
          formData.append("mapping", JSON.stringify(columnMapping));
          formData.append(
            "transformations",
            JSON.stringify(columnTransformations || {})
          );

          // Time-based progress simulation
          const startTime = Date.now();
          if (onProgress) {
            onProgress(Math.ceil(rowCount * 0.05), rowCount);
          }

          const progressInterval = setInterval(() => {
            // Smooth progress based on elapsed time, asymptotically approaching 99%
            const elapsedSeconds = (Date.now() - startTime) / 1000;
            // Use exponential curve: 0.05 + (0.94 * (1 - e^(-elapsed/2)))
            const simulatedProgress =
              5 + 94 * (1 - Math.exp(-elapsedSeconds / 2));
            if (onProgress) {
              onProgress(
                Math.ceil(rowCount * (simulatedProgress / 100)),
                rowCount
              );
            }
          }, 300);

          try {
            const result = await request("/files/bank/import-mapped", {
              method: "POST",
              body: formData,
            });

            clearInterval(progressInterval);
            // Set final progress to actual inserted + skipped count (100%)
            if (onProgress && result.inserted_count !== undefined) {
              const totalProcessed =
                result.inserted_count + (result.skipped_count || 0);
              onProgress(totalProcessed, rowCount);
            }

            resolve(result);
          } catch (error) {
            clearInterval(progressInterval);
            reject(error);
          }
        } catch (error) {
          reject(error);
        }
      };

      reader.readAsText(file);
    });
  },
  importSystemFile: (file, onProgress) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async () => {
        try {
          const text = reader.result;
          const rowCount = Math.max(1, text.split("\n").length - 2); // Subtract header and potential blank line

          const formData = new FormData();
          formData.append("file", file);

          // Time-based progress simulation
          const startTime = Date.now();
          if (onProgress) {
            onProgress(Math.ceil(rowCount * 0.05), rowCount);
          }

          const progressInterval = setInterval(() => {
            // Smooth progress based on elapsed time, asymptotically approaching 99%
            const elapsedSeconds = (Date.now() - startTime) / 1000;
            // Use exponential curve: 0.05 + (0.94 * (1 - e^(-elapsed/2)))
            const simulatedProgress =
              5 + 94 * (1 - Math.exp(-elapsedSeconds / 2));
            if (onProgress) {
              onProgress(
                Math.ceil(rowCount * (simulatedProgress / 100)),
                rowCount
              );
            }
          }, 300);

          try {
            const result = await request("/files/system/import", {
              method: "POST",
              body: formData,
            });

            clearInterval(progressInterval);
            // Set final progress to actual inserted + skipped count (100%)
            if (onProgress && result.inserted_count !== undefined) {
              const totalProcessed =
                result.inserted_count + (result.skipped_count || 0);
              onProgress(totalProcessed, rowCount);
            }

            resolve(result);
          } catch (error) {
            clearInterval(progressInterval);
            reject(error);
          }
        } catch (error) {
          reject(error);
        }
      };

      reader.readAsText(file);
    });
  },
  importBankFile: (file, movementType, onProgress) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async () => {
        try {
          const text = reader.result;
          const rowCount = Math.max(1, text.split("\n").length - 2); // Subtract header and potential blank line

          const formData = new FormData();
          formData.append("file", file);
          formData.append("movement_type", movementType);

          // Time-based progress simulation
          const startTime = Date.now();
          if (onProgress) {
            onProgress(Math.ceil(rowCount * 0.05), rowCount);
          }

          const progressInterval = setInterval(() => {
            // Smooth progress based on elapsed time, asymptotically approaching 99%
            const elapsedSeconds = (Date.now() - startTime) / 1000;
            // Use exponential curve: 0.05 + (0.94 * (1 - e^(-elapsed/2)))
            const simulatedProgress =
              5 + 94 * (1 - Math.exp(-elapsedSeconds / 2));
            if (onProgress) {
              onProgress(
                Math.ceil(rowCount * (simulatedProgress / 100)),
                rowCount
              );
            }
          }, 300);

          try {
            const result = await request("/files/bank/import", {
              method: "POST",
              body: formData,
            });

            clearInterval(progressInterval);
            // Set final progress to actual inserted + skipped count (100%)
            if (onProgress && result.inserted_count !== undefined) {
              const totalProcessed =
                result.inserted_count + (result.skipped_count || 0);
              onProgress(totalProcessed, rowCount);
            }

            resolve(result);
          } catch (error) {
            clearInterval(progressInterval);
            reject(error);
          }
        } catch (error) {
          reject(error);
        }
      };

      reader.readAsText(file);
    });
  },
  deleteSystemFile: ({ FileOrigin, file_index }) =>
    request("/files/system/delete", {
      method: "POST",
      body: JSON.stringify({ FileOrigin, file_index }),
    }),
  deleteBankFile: ({ FileOrigin, file_index }) =>
    request("/files/bank/delete", {
      method: "POST",
      body: JSON.stringify({ FileOrigin, file_index }),
    }),
  close: (period) =>
    request("/periods/close", {
      method: "POST",
      body: JSON.stringify({ period }),
    }),
  activate: (period) =>
    request("/periods/activate", {
      method: "POST",
      body: JSON.stringify({ period }),
    }),
  open: (period) =>
    request("/periods/open", {
      method: "POST",
      body: JSON.stringify({ period }),
    }),
  matchFromFile: (key, data) =>
    request(`/match/from-file?key=${key}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  // OneToMany match endpoint for agency and pattern-based matching
  matchOneToMany: (key) =>
    request(`/match/one-to-many/${key}`, {
      method: "POST",
    }),
  // Universal match endpoint for any match type by key
  matchOneToOne: (key) =>
    request(`/match/one-to-one/${key}`, {
      method: "POST",
    }),

  // Universal reset endpoint for any match type by key
  resetByKey: (key) =>
    request(`/match/reset-by-key/${key}`, {
      method: "POST",
    }),

  // Global reset endpoint to reset ALL transactions to unreconciled
  resetAll: () =>
    request("/match/reset-all", {
      method: "POST",
    }),

  updateMatchTypeOrder: (match_type_keys) =>
    request("/match/update-order", {
      method: "POST",
      body: JSON.stringify({ match_type_keys }),
    }),
  updateMatchTypeSettings: (key, settings) =>
    request(`/match/update-settings/${key}`, {
      method: "PUT",
      body: JSON.stringify(settings),
    }),

  getReconciledTotals: () => request("/match/reconciled-totals"),
  getMatchTypeTotals: () => request("/match/match-type-totals"),

  // Settings endpoints for match type configuration from JSON
  getSettingsMatchTypes: () => request("/settings/match-types"),
  getSettingsMatchType: (key) => request(`/settings/match-types/${key}`),
  getSettingsCategories: () => request("/settings/categories"),
  getSettingsStats: () => request("/settings/stats"),



  // Get paginated unreconciled transactions with optional search, filters, and sorting
  getUnreconciledTransactions: (
    page = 1,
    pageSize = 100,
    search = "",
    status = "",
    source = "",
    policyNo = "",
    period = "",
    sortKey = "",
    sortDirection = "asc"
  ) => {
    const params = new URLSearchParams({
      page,
      page_size: pageSize,
      ...(search && { search: encodeURIComponent(search) }),
      ...(status && status !== "all" && { status }),
      ...(source && source !== "all" && { source }),
      ...(policyNo && { policy_no: policyNo }),
      ...(period && { period }),
      ...(sortKey && { sort_key: sortKey }),
      ...(sortKey && { sort_direction: sortDirection }),
    });
    const url = `/transactions/unreconciled?${params}`;
    console.log(`[API Call] GET ${url}`);
    return request(url);
  },

  // Get paginated transaction history with optional search, filters, and sorting
  getTransactionHistory: (
    page = 1,
    pageSize = 100,
    search = "",
    status = "",
    source = "",
    policyNo = "",
    period = "",
    sortKey = "",
    sortDirection = "asc"
  ) => {
    const params = new URLSearchParams({
      page,
      page_size: pageSize,
      ...(search && { search: encodeURIComponent(search) }),
      ...(status && status !== "all" && { status }),
      ...(source && source !== "all" && { source }),
      ...(policyNo && { policy_no: policyNo }),
      ...(period && { period }),
      ...(sortKey && { sort_key: sortKey }),
      ...(sortKey && { sort_direction: sortDirection }),
    });
    const url = `/transactions/history?${params}`;
    console.log(`[API Call] GET ${url}`);
    return request(url);
  },
};
