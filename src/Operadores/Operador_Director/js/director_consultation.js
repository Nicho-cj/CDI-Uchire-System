const { ipcRenderer } = require('electron');

let consultationList = [];
let filteredConsultations = [];
let sortConfig = { key: 'date', direction: 'desc' };

document.addEventListener('DOMContentLoaded', () => {
    const role = sessionStorage.getItem('userRole');
    if (!role || (role !== 'Administrador' && role !== 'Director')) {
        window.location.href = '../login.html';
    }

    init();
});

async function init() {
    setupListeners();
    await loadConsultations();
}

async function loadConsultations() {
    try {
        consultationList = await ipcRenderer.invoke('consulta-get-all-consultations');
        applyFilters();
    } catch (e) {
        console.error(e);
    }
}

function applyFilters() {
    const term = document.getElementById('search-consultations').value.toLowerCase();

    filteredConsultations = consultationList.filter(c =>
        (c.nombres && c.nombres.toLowerCase().includes(term)) ||
        (c.apellidos && c.apellidos.toLowerCase().includes(term)) ||
        (c.departamento && c.departamento.toLowerCase().includes(term)) ||
        (c.cedula && c.cedula.toLowerCase().includes(term))
    );

    sortData();
    renderTable();
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

function renderTable() {
    const tbody = document.getElementById('consultations-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (filteredConsultations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-muted">No se encontraron registros</td></tr>';
        return;
    }

    filteredConsultations.forEach(c => {
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
        `;
        tbody.appendChild(tr);
    });
}

function setupListeners() {
    document.getElementById('search-consultations').oninput = applyFilters;

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
}
