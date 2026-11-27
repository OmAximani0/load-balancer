let requestCounter = 0;
const activityLogs = [];
let autoTrafficInterval = null;

const SERVER_COLORS = {
  "server-1": { hex: "#10b981", glow: "rgba(16, 185, 129, 0.4)", bg: "rgba(16, 185, 129, 0.12)" },
  "server-2": { hex: "#38bdf8", glow: "rgba(56, 189, 248, 0.4)", bg: "rgba(56, 189, 248, 0.12)" },
  "server-3": { hex: "#a855f7", glow: "rgba(168, 85, 247, 0.4)", bg: "rgba(168, 85, 247, 0.12)" },
  "default":  { hex: "#64748b", glow: "rgba(100, 116, 139, 0.4)", bg: "rgba(100, 116, 139, 0.12)" },
};

function getNodeColor(serverId) {
  return SERVER_COLORS[serverId] || SERVER_COLORS["default"];
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
        btn.innerHTML = `<span class="btn-icon">↺</span> <span>Reset Traffic</span>`;
        btn.disabled = false;
      }, 1200);
    }
    await updateDashboard();
  } catch (err) {
    showAlert(`Could not reset traffic: ${err.message}`, "danger");
    if (btn) {
      btn.innerHTML = `<span class="btn-icon">↺</span> <span>Reset Traffic</span>`;
      btn.disabled = false;
    }
  }
}

function pingNodeCard(serverId) {
  if (!serverId) return;
  const card = document.getElementById(`node-card-${serverId}`);
  if (card) {
    card.classList.remove("ping-active");
    // Trigger reflow to restart CSS animation
    void card.offsetWidth;
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
    btn.innerHTML = `<span class="btn-icon">⏳</span> <span>Dispatching...</span>`;
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
      status: "502 Bad Gateway",
      isSuccess: false,
      duration: `${duration} ms`,
      timestamp: new Date().toLocaleTimeString()
    });
  } finally {
    if (btn && !autoTrafficInterval) {
      btn.disabled = false;
      btn.innerHTML = `<span class="btn-icon">⚡</span> <span>Send Test Request</span>`;
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
        <td colspan="5" class="empty-state-cell">
          <div class="empty-state">
            <span class="empty-icon">⚡</span>
            <p class="empty-title">No requests recorded yet</p>
            <p class="empty-desc">Click "Send Test Request" or "Auto Traffic" above to start dispatching HTTP traffic.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = activityLogs.map(log => {
    const nodeColor = getNodeColor(log.backend);
    return `
      <tr>
        <td><strong>#${log.reqNum}</strong></td>
        <td>
          <span class="pill-node" style="color: ${nodeColor.hex}; background: ${nodeColor.bg}; border-color: ${nodeColor.hex}40;">
            ${log.backend}
          </span>
        </td>
        <td>
          <span class="pill-status ${log.isSuccess ? 'pill-status-success' : 'pill-status-error'}">
            ${log.isSuccess ? '✓' : '✕'} ${log.status}
          </span>
        </td>
        <td><span class="pill-latency">${log.duration}</span></td>
        <td>${log.timestamp}</td>
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
      successRateElem.innerText = `${rate}% success rate`;
      successRateElem.className = rate >= 95 ? "kpi-subtext text-success" : "kpi-subtext text-danger";
    } else {
      successRateElem.innerText = "100% success rate";
      successRateElem.className = "kpi-subtext text-success";
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
    const serverStat = statsMap[server.id] || { requests: 0, avg_response_time_ms: 0 };
    const isHealthy = server.healthy;
    const nodeColor = getNodeColor(server.id);
    const trafficShare = totalReqs > 0 ? ((serverStat.requests / totalReqs) * 100).toFixed(1) : 0;

    return `
      <div id="node-card-${server.id}"
           class="card node-card"
           style="--node-color: ${nodeColor.hex}; --node-glow: ${nodeColor.glow};">
        <div class="node-header">
          <div>
            <div class="node-title-group">
              <span class="node-title">${server.id}</span>
            </div>
            <span class="node-url-tag">${server.url}</span>
          </div>
          <span class="node-status-pill ${isHealthy ? 'node-status-healthy' : 'node-status-unhealthy'}">
            <span class="status-dot"></span>
            ${isHealthy ? 'In Rotation' : 'Offline'}
          </span>
        </div>

        <div class="node-metrics-bar">
          <div class="node-metric">
            <span class="node-metric-label">Processed</span>
            <span class="node-metric-value">${serverStat.requests}</span>
          </div>
          <div class="node-metric">
            <span class="node-metric-label">Traffic Share</span>
            <span class="node-metric-value" style="color: ${nodeColor.hex}">${trafficShare}%</span>
          </div>
          <div class="node-metric">
            <span class="node-metric-label">Avg Response</span>
            <span class="node-metric-value">${serverStat.avg_response_time_ms} ms</span>
          </div>
        </div>

        <div class="node-actions">
          <button class="btn btn-sm ${isHealthy ? 'btn-node-toggle' : 'btn-node-restore'}"
                  onclick="toggleServerHealth('${server.id}', ${isHealthy})"
                  title="${isHealthy ? 'Simulate server crash or network failure' : 'Restore node to healthy rotation'}">
            ${isHealthy ? 'Simulate Outage' : 'Bring Online'}
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
      segmentContainer.innerHTML = `<div class="segment-slice" style="width: 100%; background: rgba(255, 255, 255, 0.05);"></div>`;
    } else {
      segmentContainer.innerHTML = stats.servers.map(server => {
        const percentage = ((server.requests / totalRequests) * 100).toFixed(1);
        const nodeColor = getNodeColor(server.id);
        return `<div class="segment-slice" style="width: ${percentage}%; background-color: ${nodeColor.hex};" title="${server.id}: ${percentage}%"></div>`;
      }).join("");
    }
  }

  // Legend rows
  if (legendContainer) {
    legendContainer.innerHTML = stats.servers.map(server => {
      const percentage = totalRequests > 0 ? ((server.requests / totalRequests) * 100).toFixed(1) : 0;
      const nodeColor = getNodeColor(server.id);

      return `
        <div class="legend-item">
          <div class="legend-title">
            <span class="legend-color-dot" style="background-color: ${nodeColor.hex};"></span>
            <strong>${server.id}</strong>
          </div>
          <div class="legend-stat">
            <span>${server.requests} reqs</span> &bull; <span style="color: ${nodeColor.hex};">${percentage}%</span>
          </div>
        </div>
      `;
    }).join("");
  }
}

async function updateDashboard() {
  const [stats, servers] = await Promise.all([fetchStats(), fetchServers()]);
  const systemStatus = document.getElementById("system-status");
  const systemStatusText = document.getElementById("system-status-text");

  if (!stats || !servers) {
    if (systemStatus) systemStatus.className = "status-indicator status-offline";
    if (systemStatusText) systemStatusText.innerText = "Cluster Offline";
    return;
  }

  if (systemStatus) systemStatus.className = "status-indicator status-online";
  if (systemStatusText) systemStatusText.innerText = "Cluster Active";

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
