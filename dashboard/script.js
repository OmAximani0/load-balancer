let requestCounter = 0;
const activityLogs = [];

async function fetchStats() {
  try {
    const res = await fetch("/stats");
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch /stats:", err);
    return null;
  }
}

async function fetchServers() {
  try {
    const res = await fetch("/servers");
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
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
    await updateDashboard();
  } catch (err) {
    alert(`Could not toggle ${serverId}: ${err.message}`);
  }
}

async function sendProxyRequest() {
  const btn = document.getElementById("btn-send-request");
  btn.disabled = true;
  btn.innerText = "Sending...";

  const startTime = performance.now();
  requestCounter += 1;
  const currentReqNum = requestCounter;

  try {
    const res = await fetch("/proxy");
    const duration = Math.round(performance.now() - startTime);
    const data = await res.json();

    const backend = data.server_id || "None";
    const statusText = res.ok ? "Success (200)" : `Error (${res.status})`;

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
      status: "Error",
      isSuccess: false,
      duration: `${duration} ms`,
      timestamp: new Date().toLocaleTimeString()
    });
  } finally {
    btn.disabled = false;
    btn.innerText = "Send Test Request";
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
    tbody.innerHTML = `<tr><td colspan="5" class="text-muted">No recent requests recorded yet. Click "Send Test Request" above.</td></tr>`;
    return;
  }

  tbody.innerHTML = activityLogs.map(log => `
    <tr>
      <td>#${log.reqNum}</td>
      <td><strong>${log.backend}</strong></td>
      <td class="${log.isSuccess ? 'text-success' : 'text-danger'}">${log.status}</td>
      <td>${log.duration}</td>
      <td>${log.timestamp}</td>
    </tr>
  `).join("");
}

function updateOverview(stats, servers) {
  document.getElementById("stat-total").innerText = stats.total_requests;
  document.getElementById("stat-success").innerText = stats.successful_requests;
  document.getElementById("stat-failed").innerText = stats.failed_requests;
  document.getElementById("stat-active").innerText = `${stats.active_servers} / ${servers.length}`;
}

function renderServers(servers, stats) {
  const grid = document.getElementById("servers-grid");
  if (!grid) return;

  const statsMap = {};
  if (stats && stats.servers) {
    stats.servers.forEach(s => { statsMap[s.id] = s; });
  }

  grid.innerHTML = servers.map(server => {
    const serverStat = statsMap[server.id] || { requests: 0, avg_response_time_ms: 0 };
    const isHealthy = server.healthy;

    return `
      <div class="card server-card ${isHealthy ? 'healthy' : 'unhealthy'}">
        <div class="server-header">
          <div>
            <div class="server-title">${server.id}</div>
            <div class="server-url">${server.url}</div>
          </div>
          <div class="status-badge ${isHealthy ? 'status-healthy' : 'status-unhealthy'}">
            <span class="status-dot"></span>
            <span>${isHealthy ? 'Healthy' : 'Unavailable'}</span>
          </div>
        </div>
        <div class="server-metrics">
          <div class="metric-item">
            <span class="metric-label">Processed Requests</span>
            <span class="metric-value">${serverStat.requests}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Avg Latency</span>
            <span class="metric-value">${serverStat.avg_response_time_ms} ms</span>
          </div>
        </div>
        <div class="server-actions">
          <button class="btn btn-sm ${isHealthy ? 'btn-toggle-active' : 'btn-toggle-inactive'}"
                  onclick="toggleServerHealth('${server.id}', ${isHealthy})">
            ${isHealthy ? 'Simulate Failure' : 'Restore Server'}
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function renderDistribution(stats) {
  const container = document.getElementById("distribution-bars");
  if (!container || !stats || !stats.servers) return;

  const totalRequests = stats.total_requests || 0;

  container.innerHTML = stats.servers.map(server => {
    const percentage = totalRequests > 0 ? ((server.requests / totalRequests) * 100).toFixed(1) : 0;

    return `
      <div class="dist-bar-item">
        <div class="dist-bar-header">
          <span><strong>${server.id}</strong> (${server.requests} requests)</span>
          <span>${percentage}%</span>
        </div>
        <div class="dist-bar-track">
          <div class="dist-bar-fill" style="width: ${percentage}%"></div>
        </div>
      </div>
    `;
  }).join("");
}

async function updateDashboard() {
  const [stats, servers] = await Promise.all([fetchStats(), fetchServers()]);
  const alertBanner = document.getElementById("alert-banner");
  const systemStatus = document.getElementById("system-status");
  const systemStatusText = document.getElementById("system-status-text");

  if (!stats || !servers) {
    alertBanner.className = "alert-banner alert-danger";
    alertBanner.innerText = "Error: Cannot reach Load Balancer API. Check if the server is running.";
    systemStatus.className = "status-badge status-unhealthy";
    systemStatusText.innerText = "API Offline";
    return;
  }

  alertBanner.className = "alert-banner hidden";
  systemStatus.className = "status-badge status-healthy";
  systemStatusText.innerText = "System Active";

  updateOverview(stats, servers);
  renderServers(servers, stats);
  renderDistribution(stats);
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btn-send-request");
  if (btn) {
    btn.addEventListener("click", sendProxyRequest);
  }
  updateDashboard();
  setInterval(updateDashboard, 2000);
});
