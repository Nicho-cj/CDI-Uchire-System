const { ipcRenderer } = require('electron');

let inventory = [];
let drugModal;

document.addEventListener('DOMContentLoaded', () => {
    const role = sessionStorage.getItem('userRole');
    if (!role || (role !== 'Administrador' && role !== 'Director')) {
        window.location.href = '../login.html';
    }

    const modalEl = document.getElementById('drugModal');
    if (modalEl) drugModal = new bootstrap.Modal(modalEl);

    init();
});

async function init() {
    await loadInventory();
    setupListeners();
}

async function loadInventory() {
    try {
        inventory = await ipcRenderer.invoke('get-pharmacy-inventory-director');
        renderTable();
    } catch (e) { console.error(e); }
}

function renderTable() {
    const tbody = document.getElementById('pharmacy-tbody');
    const term = document.getElementById('search-pharmacy').value.toLowerCase();

    if (!tbody) return;
    tbody.innerHTML = '';

    const filtered = inventory.filter(i =>
        (i.nombre_comercial && i.nombre_comercial.toLowerCase().includes(term)) ||
        (i.principio_activo && i.principio_activo.toLowerCase().includes(term))
    );

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-muted">No se encontraron medicamentos</td></tr>';
        return;
    }

    filtered.forEach(i => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ps-4">
                <div class="fw-bold text-dark">${i.nombre_comercial}</div>
            </td>
            <td><small class="text-muted">${i.principio_activo || 'N/A'}</small></td>
            <td class="small">${i.concentracion || 'N/A'}</td>
            <td class="small">${i.presentacion}</td>
            <td><span class="badge ${i.cantidad <= 10 ? 'bg-danger' : 'bg-success'} bg-opacity-10 text-${i.cantidad <= 10 ? 'danger' : 'success'} fw-bold">${i.cantidad || 0} UNI</span></td>
            <td class="text-end pe-4">
                 <button class="btn btn-sm btn-light p-2 rounded-circle me-1" onclick="adjustStock(${i.id_medicamento}, '${i.nombre_comercial.replace(/'/g, "\\'")}')" title="Ajustar Stock"><i class="fas fa-boxes text-success"></i></button>
                 <button class="btn btn-sm btn-light p-2 rounded-circle" onclick='editDrug(${JSON.stringify(i)})' title="Editar"><i class="fas fa-edit text-primary"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.adjustStock = async (id, name) => {
    const qty = prompt(`Ingrese la cantidad de '${name}' que desea añadir al inventario (use valores negativos para restar):`, "10");
    if (qty && !isNaN(qty)) {
        const datos = {
            id_medicamento: id,
            tipo: parseInt(qty) > 0 ? 'Entrada' : 'Salida',
            cantidad: Math.abs(parseInt(qty)),
            id_usuario: sessionStorage.getItem('userId'),
            motivo: 'Ajuste manual por Director'
        };
        const res = await ipcRenderer.invoke('consulta-register-movimiento', datos);
        if (res) {
            showToast("Stock actualizado", "bg-success");
            await loadInventory();
        }
    }
};

function setupListeners() {
    document.getElementById('search-pharmacy').oninput = renderTable;

    document.getElementById('btn-add-drug').onclick = () => {
        document.getElementById('drug-form').reset();
        document.getElementById('p-id').value = '';
        document.getElementById('drugModalTitle').textContent = "Registrar Nuevo Medicamento";
        document.getElementById('p-stock').disabled = false;
        drugModal.show();
    };

    document.getElementById('drug-form').onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            id_medicamento: document.getElementById('p-id').value,
            nombre_comercial: document.getElementById('p-name').value,
            principio_activo: document.getElementById('p-active').value,
            concentracion: document.getElementById('p-conc-val').value + document.getElementById('p-conc-unit').value,
            presentacion: document.getElementById('p-present').value,
            cantidad: parseInt(document.getElementById('p-stock').value) || 0
        };

        const res = await ipcRenderer.invoke('save-medicamento-director', data, sessionStorage.getItem('userId'));
        if (res && (res.success || typeof res === 'number')) {
            showToast("Medicamento guardado con éxito", "bg-success");
            drugModal.hide();
            await loadInventory();
        } else {
            showToast("Error al guardar: " + (res?.error || "Fallo desconocido"), "bg-danger");
        }
    };
}

window.editDrug = (i) => {
    document.getElementById('drugModalTitle').textContent = "Editar Medicamento";
    document.getElementById('p-id').value = i.id_medicamento;
    document.getElementById('p-name').value = i.nombre_comercial;
    document.getElementById('p-active').value = i.principio_activo;

    // Split concentration if possible
    if (i.concentracion) {
        const val = i.concentracion.match(/\d+/) ? i.concentracion.match(/\d+/)[0] : '';
        const unit = i.concentracion.match(/[a-zA-Z%]+/) ? i.concentracion.match(/[a-zA-Z%]+/)[0] : 'mg';
        document.getElementById('p-conc-val').value = val;
        document.getElementById('p-conc-unit').value = unit;
    } else {
        document.getElementById('p-conc-val').value = '';
        document.getElementById('p-conc-unit').value = 'mg';
    }

    document.getElementById('p-present').value = i.presentacion;
    document.getElementById('p-stock').value = i.cantidad || 0;
    document.getElementById('p-stock').disabled = true;
    drugModal.show();
};

function showToast(msg, bg) {
    const el = document.getElementById('liveToast');
    if (!el) return;
    el.className = `toast align-items-center text-white ${bg} border-0 rounded-4 shadow-lg`;
    el.querySelector('.toast-body').textContent = msg;
    new bootstrap.Toast(el).show();
}
