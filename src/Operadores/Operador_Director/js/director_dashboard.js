const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
    // Security check
    const role = sessionStorage.getItem('userRole');
    if (!role || (role !== 'Administrador' && role !== 'Director')) {
        window.location.href = '../login.html';
    }

    init();
});

async function init() {
    const userName = sessionStorage.getItem('username') || 'Director';
    const userNameEl = document.getElementById('user-name');
    const userAvatarEl = document.getElementById('user-avatar');
    const currentDateEl = document.getElementById('current-date');

    if (userNameEl) userNameEl.textContent = userName;
    if (userAvatarEl) userAvatarEl.src = `https://ui-avatars.com/api/?name=${userName}&background=0a9396&color=fff`;

    if (currentDateEl) {
        currentDateEl.textContent = new Date().toLocaleDateString('es-ES', {
            weekday: 'long', day: 'numeric', month: 'long'
        });
    }

    await refreshDashboard();
    setInterval(refreshDashboard, 30000); // 30s auto-sync
}

async function refreshDashboard() {
    try {
        const stats = await ipcRenderer.invoke('get-dashboard-stats-director');

        // Main Counters
        updateCounter('stat-staff', stats.users); // Replacing Staff with Users for context
        updateCounter('stat-patients', stats.patients);
        updateCounter('stat-audit', stats.audit_events);
        updateCounter('stat-depts', stats.depts);

        // Real-time Flow (Removed Triaje, using Consultations and Items)
        // Re-mapping these IDs to match what's available
        updateCounter('flow-triage', stats.consultations); // Total Consultations
        updateCounter('flow-waiting', stats.pharmacy_items); // Pharmacy items count
        updateCounter('flow-attended', stats.patients); // Total Patients

        // Activity Feed Rendering
        const activityContainer = document.getElementById('recent-activity');
        if (activityContainer && stats.recent_logs) {
            if (stats.recent_logs.length === 0) {
                activityContainer.innerHTML = '<div class="text-center py-5 text-muted small">Sin actividad reciente.</div>';
                return;
            }

            activityContainer.innerHTML = '';
            stats.recent_logs.forEach(log => {
                const item = document.createElement('div');
                item.className = 'activity-item';
                const time = new Date(log.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                item.innerHTML = `
                    <div class="d-flex justify-content-between mb-1">
                        <span class="fw-bold x-small text-primary">${log.nombre_usuario || 'Sistema'}</span>
                        <span class="text-muted" style="font-size: 0.65rem;">${time}</span>
                    </div>
                    <p class="mb-0 x-small text-secondary fw-medium">${log.nombre_movimiento}</p>
                `;
                activityContainer.appendChild(item);
            });
        }

    } catch (err) {
        console.error('Director Sync Failure:', err);
    }
}

function updateCounter(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    const current = parseInt(el.textContent) || 0;
    if (current !== value) {
        el.textContent = value || 0;
        el.classList.add('animate-pulse');
        setTimeout(() => el.classList.remove('animate-pulse'), 1000);
    }
}
