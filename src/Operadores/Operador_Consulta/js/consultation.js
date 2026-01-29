const { ipcRenderer } = require('electron');

let allConsultations = [];
let filteredConsultations = [];
let consultationModal, recordModal;
let currentPatient = null;
let sortConfig = { key: 'date', direction: 'desc' };

document.addEventListener('DOMContentLoaded', () => {
    const role = sessionStorage.getItem('userRole');
    if (!role || (role !== 'Operador' && role !== 'Administrador' && role !== 'Director')) {
        window.location.href = '../login.html';
    }

    const modalEl = document.getElementById('consultationModal');
    if (modalEl) consultationModal = new bootstrap.Modal(modalEl);

    const recModalEl = document.getElementById('recordModal');
    if (recModalEl) recordModal = new bootstrap.Modal(recModalEl);

    init();
});

async function init() {
    setupUserInfo();
    setupListeners();
    await loadData();
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
        allConsultations = await ipcRenderer.invoke('consulta-get-all-consultations');
        applyFilters();
    } catch (err) {
        console.error(err);
    }
}

function checkSearchRedirect() {
    const ci = sessionStorage.getItem('search_ci_existing');
    if (ci) {
        sessionStorage.removeItem('search_ci_existing');
        document.getElementById('btn-new-consultation').click();

        // Wait for modal to be ready and patients to be loaded
        setTimeout(async () => {
            const searchInput = document.getElementById('c-search-ci');
            if (searchInput) {
                searchInput.value = ci;
                searchInput.dispatchEvent(new Event('input'));

                // Try to select if found
                setTimeout(() => {
                    const select = document.getElementById('c-paciente');
                    if (select.options.length > 1) {
                        select.selectedIndex = 1;
                        select.dispatchEvent(new Event('change'));
                    }
                }, 500);
            }
        }, 500);
    }
}

function applyFilters() {
    const term = document.getElementById('search-input').value.toLowerCase();
    const dateStart = document.getElementById('filter-date-start').value;
    const dateEnd = document.getElementById('filter-date-end').value;

    filteredConsultations = allConsultations.filter(c => {
        const matchesTerm = c.cedula.toLowerCase().includes(term) ||
            `${c.nombres} ${c.apellidos}`.toLowerCase().includes(term) ||
            c.departamento.toLowerCase().includes(term);

        const matchesDate = (!dateStart || c.fecha_consulta >= dateStart) &&
            (!dateEnd || c.fecha_consulta <= dateEnd);

        return matchesTerm && matchesDate;
    });

    sortData();
    renderTable(filteredConsultations);
}

function sortData() {
    filteredConsultations.sort((a, b) => {
        let valA, valB;
        if (sortConfig.key === 'patient') {
            valA = `${a.nombres} ${a.apellidos}`.toLowerCase();
            valB = `${b.nombres} ${b.apellidos}`.toLowerCase();
        } else if (sortConfig.key === 'dept') {
            valA = a.departamento.toLowerCase();
            valB = b.departamento.toLowerCase();
        } else if (sortConfig.key === 'date') {
            valA = `${a.fecha_consulta} ${a.hora_consulta}`;
            valB = `${b.fecha_consulta} ${b.hora_consulta}`;
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
}

function renderTable(list) {
    const tbody = document.getElementById('consultation-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No se encontraron registros</td></tr>';
        return;
    }

    list.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ps-4">
                <div class="fw-bold text-dark">${c.nombres} ${c.apellidos}</div>
                <small class="text-muted">CI: ${c.cedula}</small>
            </td>
            <td><span class="badge bg-primary bg-opacity-10 text-primary">${c.departamento}</span></td>
            <td>${c.fecha_consulta}</td>
            <td>${c.hora_consulta}</td>
            <td class="small text-muted">${c.nota_adicional || 'Sin notas.'}</td>
            <td class="text-end pe-4">
                <div class="d-flex justify-content-end gap-2">
                    <button class="btn btn-sm btn-light rounded-circle p-2 btn-view-ficha" title="Ver Ficha">
                        <i class="fas fa-file-medical text-primary"></i>
                    </button>
                    <button class="btn btn-sm btn-light rounded-circle p-2 btn-delete" title="Eliminar Registro">
                        <i class="fas fa-trash text-danger"></i>
                    </button>
                </div>
            </td>
        `;

        const viewFichaBtn = tr.querySelector('.btn-view-ficha');
        if (viewFichaBtn) {
            viewFichaBtn.onclick = async () => {
                const patient = await ipcRenderer.invoke('consulta-get-paciente-by-cedula', c.cedula);
                if (patient) openRecordModal(patient);
                else showToast("No se pudo cargar la ficha del paciente", "bg-warning");
            };
        }

        const deleteBtn = tr.querySelector('.btn-delete');
        if (deleteBtn) {
            deleteBtn.onclick = async () => {
                if (confirm("¿Eliminar este registro de consulta?")) {
                    const res = await ipcRenderer.invoke('db-query', "DELETE FROM consultas WHERE id_consulta = ?", [c.id_consulta]);
                    if (res) {
                        showToast("Consulta eliminada", "bg-success");
                        await loadData();
                    }
                }
            };
        }

        tbody.appendChild(tr);
    });
}

function setupListeners() {
    // Search & Filter
    document.getElementById('search-input').oninput = applyFilters;
    document.getElementById('filter-date-start').onchange = applyFilters;
    document.getElementById('filter-date-end').onchange = applyFilters;

    // Sorting
    document.querySelectorAll('.sortable').forEach(th => {
        th.onclick = () => {
            const key = th.dataset.sort;
            if (sortConfig.key === key) {
                sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
            } else {
                sortConfig.key = key;
                sortConfig.direction = 'asc';
            }
            // Update icons
            document.querySelectorAll('.sortable i').forEach(i => i.className = 'fas fa-sort ms-1 small text-muted');
            const icon = th.querySelector('i');
            icon.className = `fas fa-sort-${sortConfig.direction === 'asc' ? 'up' : 'down'} ms-1 small text-primary`;

            applyFilters();
        };
    });

    // New Consultation
    document.getElementById('btn-new-consultation').onclick = async () => {
        document.getElementById('consultation-form').reset();
        document.getElementById('pharmacy-med-container').classList.add('d-none');
        await refreshPatients();
        await refreshDepts();
        consultationModal.show();
    };

    document.getElementById('btn-refresh-patients').onclick = refreshPatients;

    // Patient search in modal
    document.getElementById('c-search-ci').oninput = (e) => {
        const term = e.target.value.toLowerCase();
        const select = document.getElementById('c-paciente');
        Array.from(select.options).forEach(opt => {
            if (opt.value === "") return;
            opt.hidden = !opt.textContent.toLowerCase().includes(term);
        });
    };

    // Pharmacy logic
    document.getElementById('c-depto').onchange = async (e) => {
        const text = e.target.options[e.target.selectedIndex].text;
        const container = document.getElementById('pharmacy-med-container');
        if (text.toLowerCase().includes('farmacia')) {
            container.classList.remove('d-none');
            await refreshInventory();
        } else {
            container.classList.add('d-none');
        }
    };

    // Form submission
    document.getElementById('consultation-form').onsubmit = async (e) => {
        e.preventDefault();
        const deptSelect = document.getElementById('c-depto');
        const deptText = deptSelect.options[deptSelect.selectedIndex].text;
        const idPaciente = document.getElementById('c-paciente').value;
        const idDepto = deptSelect.value;
        const notas = document.getElementById('c-notas').value;

        const data = {
            id_paciente: idPaciente,
            id_departamento: idDepto,
            nota_adicional: notas
        };

        const res = await ipcRenderer.invoke('consulta-registrar-consulta', data);
        if (res.success) {
            // If pharmacy, register movement
            if (deptText.toLowerCase().includes('farmacia')) {
                const idMed = document.getElementById('c-medicamento').value;
                const qty = parseInt(document.getElementById('c-med-qty').value);
                if (idMed && qty > 0) {
                    await ipcRenderer.invoke('consulta-register-movimiento', {
                        id_paciente: idPaciente,
                        id_consulta: res.id,
                        id_medicamento: idMed,
                        tipo: 'Salida',
                        cantidad: qty
                    });
                }
            }
            showToast("Consulta registrada", "bg-success");
            consultationModal.hide();
            await loadData();
        } else {
            showToast("Error: " + res.error, "bg-danger");
        }
    };

    // Export
    document.getElementById('btn-export').onclick = () => {
        if (filteredConsultations.length === 0) return showToast("No hay datos para exportar", "bg-warning");

        const headers = ["Fecha", "Hora", "Paciente", "Cédula", "Departamento", "Observaciones"];
        const data = filteredConsultations.map(c => [
            c.fecha_consulta,
            c.hora_consulta,
            `${c.nombres} ${c.apellidos}`,
            c.cedula,
            c.departamento,
            c.nota_adicional || ''
        ]);

        if (confirm("¿Desea exportar a PDF? (Cancelar para Excel)")) {
            ReportUtils.downloadPDF(data, headers, "Reporte de Consultas Médicas - CDI Uchire", "Consultas");
        } else {
            const excelData = filteredConsultations.map(c => ({
                "Fecha": c.fecha_consulta,
                "Hora": c.hora_consulta,
                "Paciente": `${c.nombres} ${c.apellidos}`,
                "Cédula": c.cedula,
                "Departamento": c.departamento,
                "Observaciones": c.nota_adicional || ''
            }));
            ReportUtils.downloadExcel(excelData, "Consultas");
        }
    };

    const printBtn = document.getElementById('btn-print-ficha');
    if (printBtn) {
        printBtn.onclick = async () => {
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
    }
}

async function refreshPatients() {
    const patients = await ipcRenderer.invoke('consulta-get-all-pacientes');
    const pSelect = document.getElementById('c-paciente');
    pSelect.innerHTML = '<option value="" selected disabled>Seleccionar paciente...</option>';
    patients.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id_paciente;
        opt.textContent = `${p.cedula} - ${p.nombres} ${p.apellidos}`;
        pSelect.appendChild(opt);
    });
}

async function refreshDepts() {
    const depts = await ipcRenderer.invoke('admin-get-departments');
    const dSelect = document.getElementById('c-depto');
    dSelect.innerHTML = '<option value="" selected disabled>Seleccionar área...</option>';
    depts.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id_departamento;
        opt.textContent = d.nombre_area;
        dSelect.appendChild(opt);
    });
}

async function refreshInventory() {
    const inventory = await ipcRenderer.invoke('consulta-get-inventory');
    const mSelect = document.getElementById('c-medicamento');
    mSelect.innerHTML = '<option value="" selected disabled>Seleccionar medicamento...</option>';
    inventory.forEach(i => {
        const opt = document.createElement('option');
        opt.value = i.id_medicamento;
        opt.textContent = `${i.nombre_comercial} (${i.presentacion}) - Stock: ${i.cantidad}`;
        mSelect.appendChild(opt);
    });
}

async function openRecordModal(p) {
    currentPatient = p;
    const pInfo = document.getElementById('paciente-info');
    const hInfo = document.getElementById('visit-history');

    if (!pInfo || !hInfo) return;

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
