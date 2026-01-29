const { ipcRenderer } = require('electron');

let patientList = [];
let currentPatient = null;
let detailModal, editModal;

document.addEventListener('DOMContentLoaded', () => {
    const role = sessionStorage.getItem('userRole');
    if (!role || (role !== 'Administrador' && role !== 'Director')) {
        window.location.href = '../login.html';
    }

    const modalEl = document.getElementById('patientDetailModal');
    if (modalEl) detailModal = new bootstrap.Modal(modalEl);

    const editEl = document.getElementById('editPatientModal');
    if (editEl) editModal = new bootstrap.Modal(editEl);

    init();
});

async function init() {
    await loadPatients();
    setupListeners();
}

async function loadPatients() {
    try {
        patientList = await ipcRenderer.invoke('get-patients-director');
        document.getElementById('patient-count').textContent = patientList.length;
        renderTable();
    } catch (e) { console.error(e); }
}

function renderTable() {
    const tbody = document.getElementById('patients-tbody');
    const term = document.getElementById('search-patients').value.toLowerCase();

    if (!tbody) return;
    tbody.innerHTML = '';

    const filtered = patientList.filter(p =>
        (p.nombres && p.nombres.toLowerCase().includes(term)) ||
        (p.apellidos && p.apellidos.toLowerCase().includes(term)) ||
        (p.cedula && String(p.cedula).includes(term))
    );

    filtered.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="d-flex align-items-center gap-3">
                    <div class="patient-avatar text-uppercase">${p.nombres[0]}</div>
                    <div>
                        <div class="fw-bold text-dark">${p.nombres} ${p.apellidos}</div>
                        <small class="text-muted">CI: ${p.cedula}</small>
                    </div>
                </div>
            </td>
            <td class="small fw-bold">#${p.id_paciente}</td>
            <td class="small fw-bold">${p.cedula}</td>
            <td class="small text-muted">${p.creado_en ? new Date(p.creado_en).toLocaleDateString() : '---'}</td>
            <td class="text-end">
                <button class="btn btn-sm btn-light p-2 rounded-circle me-1" onclick='viewPatient(${JSON.stringify(p)})' title="Ver Expediente"><i class="fas fa-file-medical text-primary"></i></button>
                <button class="btn btn-sm btn-light p-2 rounded-circle me-1" onclick='editPatient(${JSON.stringify(p)})' title="Editar"><i class="fas fa-edit text-warning"></i></button>
                <button class="btn btn-sm btn-light p-2 rounded-circle" onclick="deletePatient(${p.id_paciente})" title="Eliminar"><i class="fas fa-trash text-danger"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function setupListeners() {
    document.getElementById('search-patients').oninput = renderTable;

    document.getElementById('edit-patient-form').onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-p-id').value;
        const data = {
            nombres: document.getElementById('edit-p-nombres').value,
            apellidos: document.getElementById('edit-p-apellidos').value,
            cedula: document.getElementById('edit-p-cedula').value,
            fecha_nacimiento: document.getElementById('edit-p-birth').value,
            sexo: document.getElementById('edit-p-sex').value,
            telefono: document.getElementById('edit-p-tel').value
        };

        const res = await ipcRenderer.invoke('consulta-actualizar-paciente', id, data);
        if (res.success) {
            showToast("Paciente actualizado", "bg-success");
            editModal.hide();
            await loadPatients();
        } else {
            showToast("Error: " + (res.error || 'Fallo al guardar'), "bg-danger");
        }
    };

    document.getElementById('btn-print-det').onclick = async () => {
        if (!currentPatient) return;
        try {
            const history = await ipcRenderer.invoke('consulta-get-patient-history', currentPatient.id_paciente);
            const headers = ["Fecha", "Departamento", "Observaciones"];
            const mapped = history.map(h => [
                new Date(h.fecha_consulta || h.creado_en).toLocaleDateString(),
                h.departamento || h.nombre_area,
                h.nota_adicional || ''
            ]);
            const extra = [
                ["Paciente", `${currentPatient.nombres} ${currentPatient.apellidos}`],
                ["Cédula", currentPatient.cedula],
                ["Nacimiento", currentPatient.fecha_nacimiento],
                ["Teléfono", currentPatient.telefono || 'N/A']
            ];
            ReportUtils.downloadPDF(mapped, headers, "Ficha Médica del Paciente", `Ficha_${currentPatient.cedula}`, extra);
        } catch (e) {
            console.error(e);
            showToast("Error al generar PDF", "bg-danger");
        }
    };
}

window.editPatient = (p) => {
    document.getElementById('edit-p-id').value = p.id_paciente;
    document.getElementById('edit-p-nombres').value = p.nombres;
    document.getElementById('edit-p-apellidos').value = p.apellidos;
    document.getElementById('edit-p-cedula').value = p.cedula;
    document.getElementById('edit-p-birth').value = p.fecha_nacimiento;
    document.getElementById('edit-p-sex').value = p.sexo;
    document.getElementById('edit-p-tel').value = p.telefono || '';
    editModal.show();
};

window.deletePatient = async (id) => {
    if (confirm("¿Está seguro de eliminar este paciente? Esta acción eliminará todo su historial.")) {
        const res = await ipcRenderer.invoke('consulta-eliminar-paciente', id);
        if (res.success) {
            showToast("Paciente eliminado", "bg-success");
            await loadPatients();
        } else {
            showToast("Error al eliminar", "bg-danger");
        }
    }
};

window.viewPatient = async (p) => {
    currentPatient = p;
    document.getElementById('det-avatar').textContent = p.nombres[0];
    document.getElementById('det-name').textContent = `${p.nombres} ${p.apellidos}`;
    document.getElementById('det-ci').textContent = `CI: ${p.cedula}`;
    document.getElementById('det-birth').textContent = p.fecha_nacimiento;
    document.getElementById('det-sex').textContent = p.sexo;
    document.getElementById('det-tel').textContent = p.telefono || 'No registrado';

    const historyDiv = document.getElementById('det-history');
    historyDiv.innerHTML = '<div class="spinner-border spinner-border-sm text-primary"></div>';

    try {
        const history = await ipcRenderer.invoke('consulta-get-patient-history', p.id_paciente);
        if (history && history.length > 0) {
            historyDiv.innerHTML = history.map(h => `
                <div class="mb-2 p-2 bg-light rounded-3 border-start border-primary border-4">
                    <div class="d-flex justify-content-between">
                        <span class="fw-bold">${h.departamento || h.nombre_area}</span>
                        <span class="text-muted">${new Date(h.fecha_consulta || h.creado_en).toLocaleDateString()}</span>
                    </div>
                    <p class="mb-0 mt-1">${h.nota_adicional || 'Sin notas.'}</p>
                </div>
            `).join('');
        } else {
            historyDiv.innerHTML = '<div class="alert alert-info py-1 small">No hay consultas registradas.</div>';
        }
    } catch (e) { historyDiv.innerHTML = 'Error al cargar'; }

    detailModal.show();
};

function showToast(msg, bg) {
    const el = document.getElementById('liveToast');
    if (!el) return;
    el.className = `toast align-items-center text-white ${bg} border-0 rounded-4 shadow-lg`;
    el.querySelector('.toast-body').textContent = msg;
    new bootstrap.Toast(el).show();
}
