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

export const AgentApi = {
  /**
   * Get paginated agent history with optional filters and sorting
   * Returns same transaction columns as active_transactions with special agent filters
   * @param {number} page - Page number (1-indexed)
   * @param {number} pageSize - Records per page
   * @param {string} search - Search term for transactions
   * @param {string} status - Filter by status (unreconciled, reconciled)
   * @param {string} source - Filter by source (Bank, System)
   * @param {string} policyNo - Filter by PolicyNo
   * @param {string} period - Filter by period
   * @param {string} agentName - SPECIAL: Filter by agent name
   * @param {string} action - SPECIAL: Filter by action
   * @param {string} sortKey - Column to sort by
   * @param {string} sortDirection - Sort direction (asc or desc)
   */
  getAgentHistory: (
    page = 1,
    pageSize = 100,
    search = "",
    status = "",
    source = "",
    policyNo = "",
    period = "",
    agentName = "",
    action = "",
    sortKey = "",
    sortDirection = "asc"
  ) => {
    const params = new URLSearchParams();
    params.append("page", page);
    params.append("page_size", pageSize);
    if (search) params.append("search", search);
    if (status) params.append("status", status);
    if (source) params.append("source", source);
    if (policyNo) params.append("policy_no", policyNo);
    if (period) params.append("period", period);
    if (agentName) params.append("agent_name", agentName);
    if (action) params.append("action", action);
    if (sortKey) params.append("sort_key", sortKey);
    if (sortDirection) params.append("sort_direction", sortDirection);

    return request(`/agents/history?${params.toString()}`);
  },
};
