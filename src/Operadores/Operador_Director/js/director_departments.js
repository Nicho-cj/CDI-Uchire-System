const { ipcRenderer } = require('electron');

let deptModal;

document.addEventListener('DOMContentLoaded', () => {
    const role = sessionStorage.getItem('userRole');
    if (!role || (role !== 'Administrador' && role !== 'Director')) {
        window.location.href = '../login.html';
    }

    const modalEl = document.getElementById('deptModal');
    if (modalEl) deptModal = new bootstrap.Modal(modalEl);

    init();
});

async function init() {
    await loadDepts();
    setupListeners();
}

async function loadDepts() {
    try {
        const depts = await ipcRenderer.invoke('get-depts-director');
        const grid = document.getElementById('depts-grid');
        if (!grid) return;

        grid.innerHTML = '';
        depts.forEach(d => {
            const card = document.createElement('div');
            card.className = 'col-md-4';
            card.innerHTML = `
                <div class="dept-card">
                    <div class="dept-header d-flex justify-content-between align-items-start">
                        <div>
                            <h6 class="fw-bold mb-1">${d.nombre_area}</h6>
                            <span class="badge ${getStatusBadgeClass(d.estado)} x-small">${d.estado}</span>
                        </div>
                        <div class="dropdown">
                            <button class="btn btn-sm btn-light rounded-circle" data-bs-toggle="dropdown"><i class="fas fa-ellipsis-v"></i></button>
                            <ul class="dropdown-menu shadow-sm border-0">
                                <li><a class="dropdown-item" href="#" onclick='editDept(${JSON.stringify(d)})'><i class="fas fa-edit me-2 text-primary"></i>Editar</a></li>
                            </ul>
                        </div>
                    </div>
                    <div class="dept-body">
                        <div class="small mb-3 text-muted">${d.descripcion || 'Sin descripción disponible.'}</div>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (e) { console.error(e); }
}

function getStatusBadgeClass(status) {
    if (status === 'Activo') return 'bg-success bg-opacity-10 text-success';
    if (status === 'Inactivo') return 'bg-danger bg-opacity-10 text-danger';
    return 'bg-warning bg-opacity-10 text-warning';
}

function setupListeners() {
    document.getElementById('btn-add-dept').onclick = () => {
        document.getElementById('dept-form').reset();
        document.getElementById('d-id').value = '';
        document.getElementById('deptModalTitle').textContent = "Añadir Unidad Médica";
        deptModal.show();
    };

    document.getElementById('dept-form').onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            id_departamento: document.getElementById('d-id').value,
            nombre_area: document.getElementById('d-name').value,
            descripcion: document.getElementById('d-desc').value,
            estado: document.getElementById('d-status').value
        };

        const res = await ipcRenderer.invoke('save-dept-director', data, sessionStorage.getItem('userId'));
        if (res.success || typeof res === 'number') {
            showToast("Área actualizada", "bg-success");
            deptModal.hide();
            await loadDepts();
        } else {
            showToast("Error", "bg-danger");
        }
    };
}

window.editDept = (d) => {
    document.getElementById('deptModalTitle').textContent = "Editar Área";
    document.getElementById('d-id').value = d.id_departamento;
    document.getElementById('d-name').value = d.nombre_area;
    document.getElementById('d-status').value = d.estado;
    document.getElementById('d-desc').value = d.descripcion;
    deptModal.show();
};

function showToast(msg, bg) {
    const el = document.getElementById('liveToast');
    el.className = `toast align-items-center text-white ${bg} border-0 rounded-4 shadow-lg`;
    el.querySelector('.toast-body').textContent = msg;
    new bootstrap.Toast(el).show();
}
