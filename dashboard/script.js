let requestCounter = 0;
const activityLogs = [];
let autoTrafficInterval = null;

const NODE_THEMES = {
  "server-1": { hex: "#2563eb", glow: "rgba(37, 99, 235, 0.3)", light: "#eff6ff", text: "#1d4ed8" }, // Royal Blue
  "server-2": { hex: "#10b981", glow: "rgba(16, 185, 129, 0.3)", light: "#ecfdf5", text: "#059669" }, // Emerald Green
  "server-3": { hex: "#f59e0b", glow: "rgba(245, 158, 11, 0.3)", light: "#fffbeb", text: "#d97706" }, // Amber
  "default":  { hex: "#64748b", glow: "rgba(100, 116, 139, 0.3)", light: "#f1f5f9", text: "#475569" },
};

function getNodeTheme(serverId) {
  return NODE_THEMES[serverId] || NODE_THEMES["default"];
}

function showAlert(message, type = "success", durationMs = 3000) {
  const banner = document.getElementById("alert-banner");
  if (!banner) return;
  banner.className = `alert-banner alert-${type}`;
  banner.innerHTML = `<span>${type === 'success' ? '✓' : '⚠'}</span> <span>${message}</span>`;
  banner.classList.remove("hidden");
  setTimeout(() => {
    banner.classList.add("hidden");
  }, durationMs);
}

async function fetchStats() {
  try {
    const res = await fetch("/stats");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch /stats:", err);
    return null;
  }
}

async function fetchServers() {
  try {
    const res = await fetch("/servers");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch /servers:", err);
    return null;
  }
}

async function toggleServerHealth(serverId, currentHealthy) {
  try {
    const res = await fetch(`/servers/${serverId}/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ healthy: !currentHealthy })
    });
    if (!res.ok) throw new Error("Failed to toggle server");
    showAlert(`${serverId} is now ${!currentHealthy ? 'online' : 'simulated down'}`, "success", 2000);
    await updateDashboard();
  } catch (err) {
    showAlert(`Could not toggle ${serverId}: ${err.message}`, "danger");
  }
}

async function resetTraffic() {
  const btn = document.getElementById("btn-reset-traffic");
  if (btn) {
    btn.disabled = true;
    btn.innerText = "Resetting...";
  }

  try {
    const res = await fetch("/stats/reset", { method: "POST" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    requestCounter = 0;
    activityLogs.length = 0;
    renderActivityLogs();
    showAlert("All traffic counts and metrics have been reset.", "success", 2500);

    if (btn) {
      btn.innerText = "Reset Done ✓";
      setTimeout(() => {
        btn.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          <span>Reset Traffic</span>
        `;
        btn.disabled = false;
      }, 1200);
    }
    await updateDashboard();
  } catch (err) {
    showAlert(`Could not reset traffic: ${err.message}`, "danger");
    if (btn) {
      btn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        <span>Reset Traffic</span>
      `;
      btn.disabled = false;
    }
  }
}

function pingNodeCard(serverId) {
  if (!serverId) return;
  const card = document.getElementById(`node-card-${serverId}`);
  if (card) {
    card.classList.remove("ping-active");
    void card.offsetWidth; // Force CSS reflow to re-trigger keyframe animation
    card.classList.add("ping-active");
    setTimeout(() => {
      card.classList.remove("ping-active");
    }, 650);
  }
}

async function sendProxyRequest() {
  const btn = document.getElementById("btn-send-request");
  if (btn && !autoTrafficInterval) {
    btn.disabled = true;
    btn.innerHTML = `<span>⏳ Sending...</span>`;
  }

  const startTime = performance.now();
  requestCounter += 1;
  const currentReqNum = requestCounter;

  try {
    const res = await fetch("/proxy");
    const duration = Math.round(performance.now() - startTime);
    const data = await res.json();
    const backend = data.server_id || "None";
    const statusText = res.ok ? "200 OK" : `Error ${res.status}`;

    if (backend && backend !== "None") {
      pingNodeCard(backend);
    }

    logActivity({
      reqNum: currentReqNum,
      backend: backend,
      status: statusText,
      isSuccess: res.ok,
      duration: `${duration} ms`,
      timestamp: new Date().toLocaleTimeString()
    });

    await updateDashboard();
  } catch (err) {
    const duration = Math.round(performance.now() - startTime);
    logActivity({
      reqNum: currentReqNum,
      backend: "Failed",
      status: "502 Error",
      isSuccess: false,
      duration: `${duration} ms`,
      timestamp: new Date().toLocaleTimeString()
    });
  } finally {
    if (btn && !autoTrafficInterval) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        <span>Send Test Request</span>
      `;
    }
  }
}

function toggleAutoTraffic() {
  const btn = document.getElementById("btn-auto-traffic");
  const label = document.getElementById("auto-traffic-label");

  if (autoTrafficInterval) {
    clearInterval(autoTrafficInterval);
    autoTrafficInterval = null;
    if (btn) btn.classList.remove("active");
    if (label) label.innerText = "Auto Traffic";
    showAlert("Continuous traffic generator stopped.", "success", 2000);
  } else {
    autoTrafficInterval = setInterval(sendProxyRequest, 1000);
    if (btn) btn.classList.add("active");
    if (label) label.innerText = "Stop Traffic";
    sendProxyRequest();
    showAlert("Traffic generator running (1 request / second)...", "success", 2000);
  }
}

function logActivity(item) {
  activityLogs.unshift(item);
  if (activityLogs.length > 10) {
    activityLogs.pop();
  }
  renderActivityLogs();
}

function renderActivityLogs() {
  const tbody = document.getElementById("activity-log-body");
  if (!tbody) return;

  if (activityLogs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="table-empty">
          No requests recorded yet. Click "Send Test Request" above.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = activityLogs.map(log => {
    const theme = getNodeTheme(log.backend);
    return `
      <tr>
        <td><strong>#${log.reqNum}</strong></td>
        <td>
          <span class="pill-node" style="background:${theme.light}; color:${theme.text}; border: 1px solid ${theme.hex}30;">
            ● ${log.backend}
          </span>
        </td>
        <td>
          <span class="pill-status ${log.isSuccess ? 'pill-status-success' : 'pill-status-error'}">
            ${log.isSuccess ? '✓' : '✕'} ${log.status}
          </span>
        </td>
        <td><span style="font-family: ui-monospace, monospace; font-size: 0.8rem;">${log.duration}</span></td>
        <td style="color: var(--text-subtle); font-size: 0.775rem;">${log.timestamp}</td>
      </tr>
    `;
  }).join("");
}

function updateOverview(stats, servers) {
  document.getElementById("stat-total").innerText = stats.total_requests;
  document.getElementById("stat-success").innerText = stats.successful_requests;
  document.getElementById("stat-failed").innerText = stats.failed_requests;
  document.getElementById("stat-active").innerText = `${stats.active_servers} / ${servers.length}`;

  const successRateElem = document.getElementById("stat-success-rate");
  if (successRateElem) {
    if (stats.total_requests > 0) {
      const rate = Math.round((stats.successful_requests / stats.total_requests) * 100);
      successRateElem.innerText = `${rate}% Rate`;
    } else {
      successRateElem.innerText = `100% Rate`;
    }
  }
}

function renderServers(servers, stats) {
  const grid = document.getElementById("servers-grid");
  if (!grid) return;

  const statsMap = {};
  if (stats && stats.servers) {
    stats.servers.forEach(s => { statsMap[s.id] = s; });
  }

  const totalReqs = stats ? (stats.total_requests || 0) : 0;

  grid.innerHTML = servers.map(server => {
    const sStat = statsMap[server.id] || { requests: 0, avg_response_time_ms: 0 };
    const isHealthy = server.healthy;
    const theme = getNodeTheme(server.id);
    const trafficShare = totalReqs > 0 ? ((sStat.requests / totalReqs) * 100).toFixed(1) : 0;

    return `
      <div id="node-card-${server.id}"
           class="card node-card"
           style="--node-color: ${theme.hex}; --node-glow: ${theme.glow};">
        <div class="node-header">
          <div>
            <div class="node-name">${server.id}</div>
            <div class="node-url">${server.url}</div>
          </div>
          <span class="node-status-pill ${isHealthy ? 'status-in-rotation' : 'status-outage'}">
            <span class="status-pulse-dot" style="width: 6px; height: 6px;"></span>
            <span>${isHealthy ? 'In Rotation' : 'Simulated Down'}</span>
          </span>
        </div>

        <div class="node-metrics-strip">
          <div class="node-metric-cell">
            <span class="node-metric-label">Processed</span>
            <span class="node-metric-val">${sStat.requests}</span>
          </div>
          <div class="node-metric-cell">
            <span class="node-metric-label">Share</span>
            <span class="node-metric-val" style="color: ${theme.hex}">${trafficShare}%</span>
          </div>
          <div class="node-metric-cell">
            <span class="node-metric-label">Latency</span>
            <span class="node-metric-val">${sStat.avg_response_time_ms} ms</span>
          </div>
        </div>

        <div class="node-footer">
          <button class="btn btn-sm ${isHealthy ? 'btn-simulate' : 'btn-restore'}"
                  onclick="toggleServerHealth('${server.id}', ${isHealthy})"
                  title="${isHealthy ? 'Simulate failure on this backend' : 'Restore backend to healthy status'}">
            ${isHealthy ? 'Simulate Failure' : 'Restore Server'}
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function renderDistribution(stats) {
  const segmentContainer = document.getElementById("distribution-segmented-bar");
  const legendContainer = document.getElementById("distribution-bars");
  if (!stats || !stats.servers) return;

  const totalRequests = stats.total_requests || 0;

  // Segmented multi-slice bar
  if (segmentContainer) {
    if (totalRequests === 0) {
      segmentContainer.innerHTML = `<div class="segment-slice" style="width: 100%; background: #e2e8f0;"></div>`;
    } else {
      segmentContainer.innerHTML = stats.servers.map(server => {
        const percentage = ((server.requests / totalRequests) * 100).toFixed(1);
        const theme = getNodeTheme(server.id);
        return `<div class="segment-slice" style="width: ${percentage}%; background-color: ${theme.hex};" title="${server.id}: ${percentage}%"></div>`;
      }).join("");
    }
  }

  // Legend rows
  if (legendContainer) {
    legendContainer.innerHTML = stats.servers.map(server => {
      const percentage = totalRequests > 0 ? ((server.requests / totalRequests) * 100).toFixed(1) : 0;
      const theme = getNodeTheme(server.id);

      return `
        <div class="legend-row">
          <div class="legend-node">
            <span class="legend-dot" style="background-color: ${theme.hex};"></span>
            <strong>${server.id}</strong>
          </div>
          <div class="legend-metric">
            <span>${server.requests} reqs</span> &bull; <span style="color: ${theme.hex};">${percentage}%</span>
          </div>
        </div>
      `;
    }).join("");
  }
}

async function updateDashboard() {
  const [stats, servers] = await Promise.all([fetchStats(), fetchServers()]);
  const statusChip = document.getElementById("system-status");
  const statusText = document.getElementById("system-status-text");

  if (!stats || !servers) {
    if (statusChip) statusChip.className = "status-chip status-unhealthy";
    if (statusText) statusText.innerText = "System Offline";
    return;
  }

  if (statusChip) statusChip.className = "status-chip status-healthy";
  if (statusText) statusText.innerText = "System Active";

  updateOverview(stats, servers);
  renderServers(servers, stats);
  renderDistribution(stats);
}

document.addEventListener("DOMContentLoaded", () => {
  const btnSend = document.getElementById("btn-send-request");
  if (btnSend) {
    btnSend.addEventListener("click", sendProxyRequest);
  }

  const btnAuto = document.getElementById("btn-auto-traffic");
  if (btnAuto) {
    btnAuto.addEventListener("click", toggleAutoTraffic);
  }

  const btnReset = document.getElementById("btn-reset-traffic");
  if (btnReset) {
    btnReset.addEventListener("click", resetTraffic);
  }

  updateDashboard();
  setInterval(updateDashboard, 2000);
});
