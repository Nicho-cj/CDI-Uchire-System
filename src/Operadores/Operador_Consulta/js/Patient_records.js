const { ipcRenderer } = require('electron');

let allPatients = [];
let filteredPatients = [];
let patientModal, recordModal;
let currentPatient = null;
let sortConfig = { key: 'visit', direction: 'desc' };

document.addEventListener('DOMContentLoaded', () => {
    const role = sessionStorage.getItem('userRole');
    if (!role || (role !== 'Operador' && role !== 'Administrador' && role !== 'Director')) {
        window.location.href = '../login.html';
    }

    patientModal = new bootstrap.Modal(document.getElementById('patientModal'));
    const recModalEl = document.getElementById('recordModal');
    if (recModalEl) recordModal = new bootstrap.Modal(recModalEl);

    init();
});

async function init() {
    setupUserInfo();
    await loadData();
    setupEventListeners();
    checkSearchRedirect();
}

function setupUserInfo() {
    const name = sessionStorage.getItem('username') || 'Usuario';
    const userDisplayNameEl = document.getElementById('user-name');
    const userAvatarEl = document.getElementById('user-avatar');
    const currentDateEl = document.getElementById('current-date');

    if (userDisplayNameEl) userDisplayNameEl.textContent = name;
    if (userAvatarEl) userAvatarEl.src = `https://ui-avatars.com/api/?name=${name}&background=0a9396&color=fff`;
    if (currentDateEl) {
        currentDateEl.textContent = new Date().toLocaleDateString('es-ES', {
            weekday: 'long', day: 'numeric', month: 'long'
        });
    }
}

async function loadData() {
    try {
        const [patients, stats] = await Promise.all([
            ipcRenderer.invoke('consulta-get-all-pacientes'),
            ipcRenderer.invoke('consulta-get-stats')
        ]);

        allPatients = patients;
        filteredPatients = [...allPatients];
        applyFilters();
        updateStats(stats);
    } catch (err) {
        console.error(err);
    }
}

function updateStats(stats) {
    if (document.getElementById('stat-today')) document.getElementById('stat-today').textContent = stats.registro_hoy || 0;
    if (document.getElementById('stat-monthly')) document.getElementById('stat-monthly').textContent = stats.total_historico || 0;
    if (document.getElementById('stat-weekly')) document.getElementById('stat-weekly').textContent = stats.registro_hoy || 0;
}

function checkSearchRedirect() {
    const ci = sessionStorage.getItem('search_ci_new');
    if (ci) {
        sessionStorage.removeItem('search_ci_new');
        document.getElementById('btn-new-patient').click();
        document.getElementById('p-cedula').value = ci;
    }
}

function applyFilters() {
    const term = document.getElementById('search-input').value.toLowerCase();
    filteredPatients = allPatients.filter(p =>
        p.cedula.toLowerCase().includes(term) ||
        p.nombres.toLowerCase().includes(term) ||
        p.apellidos.toLowerCase().includes(term)
    );

    sortData();
    renderPatients(filteredPatients);

    const emptyState = document.getElementById('empty-state');
    if (emptyState) {
        emptyState.classList.toggle('d-none', filteredPatients.length > 0);
    }
}

function sortData() {
    filteredPatients.sort((a, b) => {
        let valA, valB;
        if (sortConfig.key === 'name') {
            valA = `${a.nombres} ${a.apellidos}`.toLowerCase();
            valB = `${b.nombres} ${b.apellidos}`.toLowerCase();
        } else if (sortConfig.key === 'ci') {
            valA = parseInt(a.cedula);
            valB = parseInt(b.cedula);
        } else if (sortConfig.key === 'sex') {
            valA = a.sexo;
            valB = b.sexo;
        } else if (sortConfig.key === 'age') {
            valA = a.fecha_nacimiento;
            valB = b.fecha_nacimiento;
        } else if (sortConfig.key === 'visit') {
            valA = a.creado_en;
            valB = b.creado_en;
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
}

function renderPatients(list) {
    const tbody = document.getElementById('patients-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    list.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="d-flex align-items-center">
                    <div class="rounded-circle bg-light d-flex align-items-center justify-content-center me-3" style="width: 40px; height: 40px; color: #0a9396;">
                        <i class="fas fa-user"></i>
                    </div>
                    <div>
                        <div class="fw-bold text-dark">${p.nombres} ${p.apellidos}</div>
                    </div>
                </div>
            </td>
            <td><span class="text-secondary fw-semibold">${p.cedula}</span></td>
            <td><div class="small fw-semibold text-dark">${p.sexo === 'M' ? 'M' : 'F'}</div></td>
            <td><div class="small text-dark">${p.fecha_nacimiento}</div></td>
            <td><div class="small text-muted">${new Date(p.creado_en).toLocaleDateString()}</div></td>
            <td class="text-end">
                <div class="d-flex justify-content-end gap-2">
                    <button class="btn btn-sm btn-light p-2 rounded-circle btn-view-ficha" title="Ver Ficha"><i class="fas fa-file-medical text-primary"></i></button>
                    <button class="btn btn-sm btn-light p-2 rounded-circle btn-edit" title="Editar"><i class="fas fa-edit text-secondary"></i></button>
                    <button class="btn btn-sm btn-light p-2 rounded-circle btn-delete" title="Eliminar"><i class="fas fa-trash text-danger"></i></button>
                </div>
            </td>
        `;

        tr.querySelector('.btn-view-ficha').onclick = () => openRecordModal(p);
        tr.querySelector('.btn-edit').onclick = () => openEditModal(p);
        tr.querySelector('.btn-delete').onclick = () => deletePatient(p.id_paciente);

        tbody.appendChild(tr);
    });
}

function setupEventListeners() {
    document.getElementById('search-input').oninput = applyFilters;

    document.getElementById('btn-new-patient').onclick = () => {
        document.getElementById('patient-form').reset();
        document.getElementById('patient-id').value = "";
        document.getElementById('modal-title').textContent = "Registrar Nuevo Paciente";
        patientModal.show();
    };

    document.getElementById('patient-form').onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('patient-id').value;
        const prefix = document.getElementById('p-tel-prefix').value;
        const body = document.getElementById('p-tel-body').value;

        const data = {
            cedula: document.getElementById('p-cedula').value,
            nombres: document.getElementById('p-nombres').value,
            apellidos: document.getElementById('p-apellidos').value,
            fecha_nacimiento: document.getElementById('p-fecha-nacimiento').value,
            sexo: document.getElementById('p-sexo').value,
            telefono: `${prefix}-${body}`
        };

        const res = id ?
            await ipcRenderer.invoke('consulta-actualizar-paciente', id, data) :
            await ipcRenderer.invoke('consulta-registrar-paciente', data);

        if (res.success || typeof res === 'number') {
            showToast("Operación exitosa", "bg-success");
            patientModal.hide();
            await loadData();
        } else {
            showToast("Error: " + res.error, "bg-danger");
        }
    };

    document.getElementById('export-excel').onclick = async (e) => {
        e.preventDefault();
        if (allPatients.length === 0) return showToast("No hay datos", "bg-warning");

        const mapped = allPatients.map(p => ({
            "Cédula": p.cedula,
            "Nombres": p.nombres,
            "Apellidos": p.apellidos,
            "Género": p.sexo,
            "F. Nacimiento": p.fecha_nacimiento,
            "Teléfono": p.telefono || 'N/A',
            "Registrado": p.creado_en
        }));

        await ReportUtils.downloadExcel(mapped, "Listado_Pacientes_CDI");
    };

    document.getElementById('btn-print-ficha').onclick = async () => {
        if (!currentPatient) return;
        try {
            const history = await ipcRenderer.invoke('consulta-get-patient-history', currentPatient.id_paciente);
            const headers = ["Fecha", "Departamento", "Observaciones"];
            const mapped = history.map(h => [h.fecha_consulta, h.departamento, h.nota_adicional || '']);
            const extra = [
                ["Paciente", `${currentPatient.nombres} ${currentPatient.apellidos}`],
                ["Cédula", currentPatient.cedula],
                ["Nacimiento", currentPatient.fecha_nacimiento],
                ["Teléfono", currentPatient.telefono || 'N/A']
            ];
            ReportUtils.downloadPDF(mapped, headers, "Ficha Médica del Paciente", `Ficha_${currentPatient.cedula}`, extra);
        } catch (e) {
            console.error(e);
            showToast("Error al generar ficha", "bg-danger");
        }
    };

    window.sortTable = (key) => {
        if (sortConfig.key === key) {
            sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
        } else {
            sortConfig.key = key;
            sortConfig.direction = 'asc';
        }
        applyFilters();
    };
}

function openEditModal(p) {
    document.getElementById('modal-title').textContent = "Editar Paciente";
    document.getElementById('patient-id').value = p.id_paciente;
    document.getElementById('p-cedula').value = p.cedula;
    document.getElementById('p-nombres').value = p.nombres;
    document.getElementById('p-apellidos').value = p.apellidos;
    document.getElementById('p-fecha-nacimiento').value = p.fecha_nacimiento;
    document.getElementById('p-sexo').value = p.sexo;

    if (p.telefono && p.telefono.includes('-')) {
        const parts = p.telefono.split('-');
        document.getElementById('p-tel-prefix').value = parts[0];
        document.getElementById('p-tel-body').value = parts[1];
    }

    patientModal.show();
}

async function deletePatient(id) {
    if (confirm("¿Eliminar paciente definitivamente?")) {
        const res = await ipcRenderer.invoke('consulta-eliminar-paciente', id);
        if (res.success) {
            showToast("Paciente eliminado", "bg-success");
            await loadData();
        }
    }
}

async function openRecordModal(p) {
    currentPatient = p;
    const pInfo = document.getElementById('paciente-info');
    const hInfo = document.getElementById('visit-history');

    pInfo.innerHTML = `
        <div class="row">
            <div class="col-md-6 mb-2"><span class="fw-bold small text-muted">CÉDULA:</span> <br> ${p.cedula}</div>
            <div class="col-md-6 mb-2"><span class="fw-bold small text-muted">PACIENTE:</span> <br> ${p.nombres} ${p.apellidos}</div>
            <div class="col-md-6 mb-2"><span class="fw-bold small text-muted">NACIMIENTO:</span> <br> ${p.fecha_nacimiento}</div>
            <div class="col-md-6 mb-2"><span class="fw-bold small text-muted">TELÉFONO:</span> <br> ${p.telefono || 'N/A'}</div>
        </div>
    `;

    hInfo.innerHTML = '<div class="text-center py-3"><i class="fas fa-spinner fa-spin me-2"></i>Cargando historial...</div>';

    try {
        const history = await ipcRenderer.invoke('consulta-get-patient-history', p.id_paciente);
        hInfo.innerHTML = history.length ? history.map(h => `
            <div class="p-2 border-bottom">
                <div class="d-flex justify-content-between">
                    <span class="fw-bold text-primary">${h.departamento}</span>
                    <span class="small text-muted">${new Date(h.fecha_consulta).toLocaleDateString()} ${h.hora_consulta}</span>
                </div>
                <div class="small text-muted mt-1">${h.nota_adicional || 'Sin observaciones.'}</div>
            </div>
        `).join('') : '<div class="text-center py-3 text-muted">Sin historial registrado.</div>';
    } catch (e) {
        console.error(e);
        hInfo.innerHTML = 'Error al cargar historial.';
    }

    recordModal.show();
}

function showToast(msg, bg) {
    const el = document.getElementById('liveToast');
    if (!el) return;
    el.className = `toast align-items-center text-white ${bg} border-0 rounded-4 shadow-lg`;
    el.querySelector('.toast-body').textContent = msg;
    new bootstrap.Toast(el).show();
}
