const { ipcRenderer } = require('electron');

let recordModal;

document.addEventListener('DOMContentLoaded', () => {
    const role = sessionStorage.getItem('userRole');
    if (!role || (role !== 'Operador' && role !== 'Administrador' && role !== 'Director')) {
        window.location.href = '../login.html';
    }

    init();
});

async function init() {
    const name = sessionStorage.getItem('username') || 'Usuario';
    const userDisplayNameEl = document.getElementById('user-display-name'); // Welcome message
    const userNameEl = document.getElementById('user-name'); // Pill
    const userAvatarEl = document.getElementById('user-avatar');
    const currentDateEl = document.getElementById('current-date');

    if (userDisplayNameEl) userDisplayNameEl.textContent = name;
    if (userNameEl) userNameEl.textContent = name;
    if (userAvatarEl) userAvatarEl.src = `https://ui-avatars.com/api/?name=${name}&background=0a9396&color=fff`;
    if (currentDateEl) {
        currentDateEl.textContent = new Date().toLocaleDateString('es-ES', {
            weekday: 'long', day: 'numeric', month: 'long'
        });
    }

    const modalEl = document.getElementById('recordModal');
    if (modalEl) recordModal = new bootstrap.Modal(modalEl);

    // Search Bar Logic
    const searchInput = document.getElementById('search-ci');
    const searchBtn = document.getElementById('btn-search-ci');

    if (searchBtn && searchInput) {
        const handleSearch = async () => {
            const ci = searchInput.value.trim();
            if (!ci) return;

            try {
                const paciente = await ipcRenderer.invoke('consulta-get-paciente-by-cedula', ci);
                if (paciente) {
                    sessionStorage.setItem('search_ci_existing', ci);
                    window.location.href = 'consultation.html';
                } else {
                    sessionStorage.setItem('search_ci_new', ci);
                    window.location.href = 'Patient_records.html';
                }
            } catch (err) { console.error(err); }
        };
        searchBtn.onclick = handleSearch;
        searchInput.onkeypress = (e) => { if (e.key === 'Enter') handleSearch(); };
    }

    await loadData();
    setInterval(loadData, 30000);
}

async function loadData() {
    try {
        const [patients, consultations, stats] = await Promise.all([
            ipcRenderer.invoke('consulta-get-all-pacientes'),
            ipcRenderer.invoke('consulta-get-last-consultations', 10),
            ipcRenderer.invoke('consulta-get-stats')
        ]);

        updateStats(stats);
        renderRecentPatients(patients.slice(0, 10));
        renderRecentConsultations(consultations);
    } catch (err) { console.error(err); }
}

function updateStats(stats) {
    if (document.getElementById('stat-total-hoy')) document.getElementById('stat-total-hoy').textContent = stats.registro_hoy || 0;
    if (document.getElementById('stat-hombres')) document.getElementById('stat-hombres').textContent = stats.hombres_hoy || 0;
    if (document.getElementById('stat-mujeres')) document.getElementById('stat-mujeres').textContent = stats.mujeres_hoy || 0;
    if (document.getElementById('stat-consultas')) document.getElementById('stat-consultas').textContent = stats.consultas_hoy || 0;
}

function renderRecentPatients(list) {
    const container = document.getElementById('recent-patients-list');
    if (!container) return;
    container.innerHTML = list.length ? list.map(p => `
        <div class="recent-patient-row d-flex align-items-center justify-content-between cursor-pointer p-2 border-bottom" onclick='openSimpleFicha(${JSON.stringify(p)})'>
            <div class="d-flex align-items-center gap-2">
                <div class="rounded-circle bg-light border d-flex align-items-center justify-content-center" style="width: 35px; height: 35px;"><i class="fas fa-user text-muted small"></i></div>
                <div>
                    <div class="fw-bold small">${p.nombres} ${p.apellidos}</div>
                    <div class="text-muted" style="font-size: 0.7rem;">CI: ${p.cedula}</div>
                </div>
            </div>
            <div class="text-end small text-muted">${new Date(p.creado_en).toLocaleDateString()}</div>
        </div>
    `).join('') : '<div class="text-center py-4 text-muted small">Sin registros hoy.</div>';
}

function renderRecentConsultations(list) {
    const container = document.getElementById('recent-consultations-list');
    if (!container) return;
    container.innerHTML = list.length ? list.map(c => `
        <div class="recent-patient-row d-flex align-items-center justify-content-between p-2 border-bottom">
            <div class="d-flex align-items-center gap-2">
                <div class="rounded-circle bg-light border d-flex align-items-center justify-content-center" style="width: 35px; height: 35px;"><i class="fas fa-notes-medical text-primary small"></i></div>
                <div>
                    <div class="fw-bold small">${c.nombres} ${c.apellidos}</div>
                    <div class="text-muted" style="font-size: 0.7rem;">${c.departamento}</div>
                </div>
            </div>
            <div class="text-end small text-muted">${c.hora_consulta}</div>
        </div>
    `).join('') : '<div class="text-center py-4 text-muted small">Sin consultas recientes.</div>';
}

window.openSimpleFicha = (p) => {
    document.getElementById('paciente-info').innerHTML = `
        <div class="mb-2"><span class="fw-bold small text-muted">PACIENTE:</span> <br> ${p.nombres} ${p.apellidos}</div>
        <div class="mb-2"><span class="fw-bold small text-muted">CÉDULA:</span> ${p.cedula}</div>
        <div class="mb-2"><span class="fw-bold small text-muted">NACIMIENTO:</span> ${p.fecha_nacimiento}</div>
    `;
    document.getElementById('triaje-info').innerHTML = '<div class="small text-muted italic">Ficha rápida - Ver detalle en sección Pacientes</div>';
    recordModal.show();
};
