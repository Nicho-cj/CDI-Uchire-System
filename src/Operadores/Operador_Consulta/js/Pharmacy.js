const { ipcRenderer } = require('electron');

let inventory = [];
let filteredInventory = [];
let movementModal;
let sortConfig = { key: 'name', direction: 'asc' };

document.addEventListener('DOMContentLoaded', () => {
    const role = sessionStorage.getItem('userRole');
    if (!role || (role !== 'Operador' && role !== 'Administrador' && role !== 'Director')) {
        window.location.href = '../login.html';
    }

    const mModalEl = document.getElementById('movementModal');
    if (mModalEl) movementModal = new bootstrap.Modal(mModalEl);

    init();
});

async function init() {
    setupUserInfo();
    await loadData();
    setupListeners();
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
        const [inv, stats] = await Promise.all([
            ipcRenderer.invoke('consulta-get-inventory'),
            ipcRenderer.invoke('consulta-get-inventory-stats')
        ]);

        inventory = inv;
        applyFilters();
        // stats are currently not used in the UI based on Pharmacy.html but we have them
        populateMedicamentoSelect(inventory);
    } catch (err) {
        console.error(err);
    }
}

function applyFilters() {
    const term = document.getElementById('search-input').value.toLowerCase();
    filteredInventory = inventory.filter(i =>
        i.nombre_comercial.toLowerCase().includes(term) ||
        (i.principio_activo && i.principio_activo.toLowerCase().includes(term))
    );

    sortData();
    renderInventory(filteredInventory);
}

function sortData() {
    filteredInventory.sort((a, b) => {
        let valA, valB;
        if (sortConfig.key === 'name') {
            valA = a.nombre_comercial.toLowerCase();
            valB = b.nombre_comercial.toLowerCase();
        } else if (sortConfig.key === 'active') {
            valA = (a.principio_activo || '').toLowerCase();
            valB = (b.principio_activo || '').toLowerCase();
        } else if (sortConfig.key === 'stock') {
            valA = a.cantidad;
            valB = b.cantidad;
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
}

function renderInventory(list) {
    const tbody = document.getElementById('inventory-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    list.forEach(item => {
        const tr = document.createElement('tr');
        const isLowStock = item.cantidad <= 10;

        tr.innerHTML = `
            <td class="ps-4">
                <div class="fw-bold text-dark">${item.nombre_comercial}</div>
            </td>
            <td><small class="text-muted">${item.principio_activo || 'N/A'}</small></td>
            <td><small>${item.concentracion || 'N/A'}</small></td>
            <td><small>${item.presentacion}</small></td>
            <td>
                <span class="badge ${isLowStock ? 'bg-danger' : 'bg-success'} bg-opacity-10 ${isLowStock ? 'text-danger' : 'text-success'} fw-bold p-2 px-3">
                    ${item.cantidad} unidades
                </span>
            </td>
            <td class="text-end pe-4">
                <button class="btn btn-sm btn-light p-2 rounded-circle btn-move" title="Registrar Movimiento"><i class="fas fa-exchange-alt text-primary"></i></button>
            </td>
        `;

        tr.querySelector('.btn-move').onclick = () => {
            document.getElementById('mv-item').value = item.id_medicamento;
            movementModal.show();
        };

        tbody.appendChild(tr);
    });
}

function populateMedicamentoSelect(list) {
    const select = document.getElementById('mv-item');
    if (!select) return;
    const first = select.options[0];
    select.innerHTML = '';
    select.appendChild(first);
    list.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.id_medicamento;
        opt.textContent = `${item.nombre_comercial} (${item.presentacion})`;
        select.appendChild(opt);
    });
}

function setupListeners() {
    document.getElementById('search-input').oninput = applyFilters;

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

    document.getElementById('movement-form').onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            id_medicamento: document.getElementById('mv-item').value,
            tipo: document.getElementById('mv-tipo').value,
            cantidad: parseInt(document.getElementById('mv-cantidad').value),
            id_usuario: sessionStorage.getItem('userId')
        };

        const res = await ipcRenderer.invoke('consulta-register-movimiento', data);
        if (res) {
            showToast("Movimiento registrado", "bg-success");
            movementModal.hide();
            await loadData();
        }
    };
}

function showToast(msg, bg) {
    const el = document.getElementById('liveToast');
    if (!el) return;
    el.className = `toast align-items-center text-white ${bg} border-0 rounded-4 shadow-lg`;
    el.querySelector('.toast-body').textContent = msg;
    new bootstrap.Toast(el).show();
}
