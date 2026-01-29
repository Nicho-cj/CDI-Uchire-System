const { ipcRenderer } = require('electron');

let allLogs = [];

document.addEventListener('DOMContentLoaded', () => {
    const role = sessionStorage.getItem('userRole');
    if (!role || (role !== 'Administrador' && role !== 'Director')) {
        window.location.href = '../login.html';
    }

    init();
});

async function init() {
    await loadLogs();
    setupListeners();
}

async function loadLogs() {
    try {
        allLogs = await ipcRenderer.invoke('get-audit-logs-director');
        renderTable();
    } catch (e) { console.error(e); }
}

function renderTable() {
    const tbody = document.getElementById('audit-tbody');
    const filterTerm = document.getElementById('filter-audit').value.toLowerCase();
    const start = document.getElementById('audit-start').value;
    const end = document.getElementById('audit-end').value;

    if (!tbody) return;
    tbody.innerHTML = '';

    let filtered = allLogs.filter(log =>
        (log.nombre_usuario || '').toLowerCase().includes(filterTerm) ||
        (log.nombre_movimiento || '').toLowerCase().includes(filterTerm)
    );

    if (start) filtered = filtered.filter(l => new Date(l.fecha_hora) >= new Date(start));
    if (end) {
        let eDate = new Date(end);
        eDate.setHours(23, 59, 59);
        filtered = filtered.filter(l => new Date(l.fecha_hora) <= eDate);
    }

    filtered.forEach(l => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="small fw-bold text-secondary">${new Date(l.fecha_hora).toLocaleString()}</td>
            <td><div class="fw-bold small">@${l.nombre_usuario || 'Sistema'}</div></td>
            <td><span class="log-type ${getTypeClass(l.nombre_movimiento)}">${l.nombre_movimiento}</span></td>
            <td><span class="badge ${l.resultado === 'Exitoso' ? 'bg-success' : 'bg-danger'} bg-opacity-10 text-${l.resultado === 'Exitoso' ? 'success' : 'danger'} x-small fw-bold">${l.resultado}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function getTypeClass(type) {
    if (type.includes('LOGIN')) return 'type-login';
    if (type.includes('REGISTRAR') || type.includes('MODIFICAR')) return 'type-mod';
    if (type.includes('ELIMINAR')) return 'type-del';
    if (type.includes('SQL')) return 'type-sql';
    return 'bg-light text-dark';
}

function setupListeners() {
    document.getElementById('filter-audit').oninput = renderTable;
    document.getElementById('audit-start').onchange = renderTable;
    document.getElementById('audit-end').onchange = renderTable;

    document.getElementById('btn-export-audit').onclick = () => {
        const headers = ["Fecha", "Usuario", "Movimiento", "Resultado"];
        const data = allLogs.map(l => [new Date(l.fecha_hora).toLocaleString(), l.nombre_usuario, l.nombre_movimiento, l.resultado]);
        window.ReportUtils.downloadPDF(data, headers, "Bitácora de Auditoría - CDI Uchire", "Auditoria_CDI");
    };
}
