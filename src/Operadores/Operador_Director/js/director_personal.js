const { ipcRenderer } = require('electron');

let staffModal;
let globalStaffList = [];

document.addEventListener('DOMContentLoaded', () => {
    const role = sessionStorage.getItem('userRole');
    if (!role || (role !== 'Administrador' && role !== 'Medico')) {
        window.location.href = '../login.html';
    }

    const modalEl = document.getElementById('staffModal');
    if (modalEl) staffModal = new bootstrap.Modal(modalEl);

    init();
});

async function init() {
    await loadDepts();
    await loadData();
    setupListeners();
}

async function loadDepts() {
    try {
        const depts = await ipcRenderer.invoke('get-depts-director');
        const select = document.getElementById('s-dept');
        if (select) {
            select.innerHTML = depts.map(d => `<option value="${d.nombre_area}">${d.nombre_area}</option>`).join('');
        }
    } catch (e) {
        console.error('Error cargando departamentos:', e);
    }
}

async function loadData() {
    try {
        const { medics, others } = await ipcRenderer.invoke('get-staff-director');

        const medicsDisplay = medics.map(m => ({
            id: m.id_medico,
            cedula: m.matricula_mpps,
            nombres: m.nombre_completo,
            tipo: 'Médico',
            area: m.especialidad || 'Consulta General',
            is_medic: true
        }));

        const othersDisplay = others.map(o => ({
            id: o.id_personal,
            cedula: o.cedula,
            nombres: `${o.nombres} ${o.apellidos}`,
            tipo: o.tipo,
            area: o.area_asignada,
            is_medic: false,
            _raw: o
        }));

        globalStaffList = [...medicsDisplay, ...othersDisplay];
        renderTable();
    } catch (err) {
        console.error('Error cargando nómina:', err);
    }
}

function renderTable() {
    const tbody = document.getElementById('staff-tbody');
    const searchVal = document.getElementById('search-staff').value.toLowerCase();
    const filter = document.querySelector('input[name="filter-type"]:checked').id;

    if (!tbody) return;
    tbody.innerHTML = '';

    let filtered = globalStaffList.filter(p =>
        p.nombres.toLowerCase().includes(searchVal) ||
        p.cedula.toString().includes(searchVal)
    );

    if (filter === 'filter-medics') filtered = filtered.filter(p => p.is_medic);
    if (filter === 'filter-support') filtered = filtered.filter(p => !p.is_medic);

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-muted">No se encontraron resultados</td></tr>';
        return;
    }

    filtered.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ps-4">
                <div class="d-flex align-items-center gap-3">
                    <div class="staff-avatar-circle">${p.nombres[0]}</div>
                    <div>
                        <div class="fw-bold text-dark">${p.nombres}</div>
                        <div class="x-small text-muted fst-italic">${p.is_medic ? 'Facultativo' : 'Soporte'}</div>
                    </div>
                </div>
            </td>
            <td class="small font-monospace">${p.cedula}</td>
            <td><span class="category-pill ${p.is_medic ? 'category-medic' : 'category-support'}">${p.tipo}</span></td>
            <td class="small fw-medium text-secondary">${p.area}</td>
            <td><span class="status-badge badge-online">Activo</span></td>
            <td class="text-end pe-4">
                ${!p.is_medic ? `
                    <button class="btn btn-sm btn-light p-2 rounded-circle mx-1" onclick="editStaff(${p.id})" title="Editar"><i class="fas fa-edit text-primary"></i></button>
                    <button class="btn btn-sm btn-light p-2 rounded-circle mx-1" onclick="deleteStaff(${p.id})" title="Eliminar"><i class="fas fa-trash text-danger"></i></button>
                ` : `
                    <span class="x-small text-muted fst-italic"><i class="fas fa-lock me-1"></i>Vía Usuarios</span>
                `}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function setupListeners() {
    document.getElementById('search-staff').oninput = renderTable;
    document.querySelectorAll('input[name="filter-type"]').forEach(r => r.onchange = renderTable);

    document.getElementById('btn-add-staff').onclick = () => {
        document.getElementById('staff-form').reset();
        document.getElementById('s-id').value = '';
        document.getElementById('staffModalTitle').innerHTML = '<i class="fas fa-user-plus me-2 text-primary"></i>Nuevo Registro de Personal';
        staffModal.show();
    };

    document.getElementById('staff-form').onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            id_personal: document.getElementById('s-id').value,
            nombres: document.getElementById('s-nombres').value,
            apellidos: document.getElementById('s-apellidos').value,
            cedula: document.getElementById('s-cedula').value,
            tipo: document.getElementById('s-type').value,
            area_asignada: document.getElementById('s-dept').value,
            estado: 'Activo'
        };

        try {
            let res = await ipcRenderer.invoke('save-staff-director', data, sessionStorage.getItem('userId'));

            // Auto-recovery: If schema is outdated and check constraint fails, try to repair and retry
            if (!res.success && res.error && res.error.includes('CHECK constraint failed')) {
                console.warn('Constraint fail detected. Attempting auto-repair...');
                await ipcRenderer.invoke('admin-repair-db');
                res = await ipcRenderer.invoke('save-staff-director', data, sessionStorage.getItem('userId'));
            }

            if (res.success || typeof res === 'number') {
                showToast("Cambios guardados con éxito", "bg-success");
                staffModal.hide();
                await loadData();
            } else {
                showToast("Error: " + (res.error || 'No se pudo procesar'), "bg-danger");
            }
        } catch (err) {
            showToast("Error de conexión", "bg-danger");
        }
    };

    document.getElementById('btn-export-pdf').onclick = () => {
        const headers = ["Funcionario", "Identificación", "Categoría", "Área Asignada"];
        const data = globalStaffList.map(p => [p.nombres, p.cedula, p.tipo, p.area]);
        ReportUtils.downloadPDF(data, headers, "Nómina de Personal Actualizada - CDI Uchire", "Nomina_Personal_CDI");
    };
}

window.editStaff = (id) => {
    const p = globalStaffList.find(x => x.id === id && !x.is_medic);
    if (!p) return;

    document.getElementById('staffModalTitle').innerHTML = '<i class="fas fa-user-edit me-2 text-primary"></i>Actualizar Miembro de Personal';
    document.getElementById('s-id').value = p.id;

    // Using raw data if available for precission
    if (p._raw) {
        document.getElementById('s-nombres').value = p._raw.nombres;
        document.getElementById('s-apellidos').value = p._raw.apellidos;
    } else {
        const parts = p.nombres.split(' ');
        document.getElementById('s-nombres').value = parts[0];
        document.getElementById('s-apellidos').value = parts.slice(1).join(' ');
    }

    document.getElementById('s-cedula').value = p.cedula;
    document.getElementById('s-type').value = p.tipo;
    document.getElementById('s-dept').value = p.area;
    staffModal.show();
};

window.deleteStaff = async (id) => {
    if (confirm("¿Está seguro de eliminar este registro de personal? Esta acción no se puede deshacer.")) {
        try {
            const res = await ipcRenderer.invoke('delete-staff-director', id, sessionStorage.getItem('userId'));
            if (res.success || res > 0) {
                showToast("Registro eliminado satisfactoriamente", "bg-success");
                await loadData();
            } else {
                showToast("No se pudo eliminar el registro", "bg-danger");
            }
        } catch (err) {
            showToast("Error de red", "bg-danger");
        }
    }
};

function showToast(msg, bg) {
    const el = document.getElementById('liveToast');
    if (!el) return;
    el.className = `toast align-items-center text-white ${bg} border-0 rounded-4 shadow-lg`;
    el.querySelector('.toast-body').textContent = msg;
    new bootstrap.Toast(el).show();
}
