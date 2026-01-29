const { ipcRenderer } = require('electron');

let charts = {};

document.addEventListener('DOMContentLoaded', () => {
    const role = sessionStorage.getItem('userRole');
    if (!role || (role !== 'Operador' && role !== 'Administrador' && role !== 'Director')) {
        window.location.href = '../login.html';
    }

    init();
});

async function init() {
    setupUserInfo();
    setupCharts();
    setupListeners();
    await loadTrends();
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

async function loadTrends() {
    try {
        const data = await ipcRenderer.invoke('consulta-get-all-consultations');
        updateTrendsChart(data);
    } catch (e) { console.error(e); }
}

function setupCharts() {
    const ctx = document.getElementById('trendsChart');
    if (!ctx) return;

    charts.trends = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Consultas Realizadas',
                data: [],
                borderColor: '#0a9396',
                backgroundColor: 'rgba(10, 147, 150, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

function updateTrendsChart(consultations) {
    if (!charts.trends) return;
    const last7Days = [];
    const labels = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const iso = d.toISOString().split('T')[0];
        labels.push(d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }));
        last7Days.push(consultations.filter(c => c.fecha_consulta === iso).length);
    }
    charts.trends.data.labels = labels;
    charts.trends.data.datasets[0].data = last7Days;
    charts.trends.update();
}

function setupListeners() {
    document.getElementById('btn-generate-custom').onclick = async () => {
        const type = document.getElementById('custom-rep-type').value;
        const start = document.getElementById('custom-rep-start').value;
        const end = document.getElementById('custom-rep-end').value;
        const format = document.querySelector('input[name="rep-format"]:checked').value;

        await generateReport(type, start, end, format);
    };
}

async function generateReport(type, start, end, format) {
    try {
        let data = [];
        let headers = [];
        let title = "";
        let filename = "";
        let mappedData = [];

        if (type === 'consultas') {
            data = await ipcRenderer.invoke('consulta-get-all-consultations');
            title = "Reporte de Consultas Médicas";
            filename = "Reporte_Consultas";
            headers = ["Fecha", "Hora", "Paciente", "Cédula", "Departamento"];

            if (start) data = data.filter(d => d.fecha_consulta >= start);
            if (end) data = data.filter(d => d.fecha_consulta <= end);

            mappedData = data.map(c => [c.fecha_consulta, c.hora_consulta, `${c.nombres} ${c.apellidos}`, c.cedula, c.departamento]);
        } else if (type === 'pacientes') {
            data = await ipcRenderer.invoke('consulta-get-all-pacientes');
            title = "Registro de Pacientes";
            filename = "Listado_Pacientes";
            headers = ["Cédula", "Nombres", "Apellidos", "Sexo", "Nacimiento", "Registrado"];

            if (start) data = data.filter(d => d.creado_en >= start);
            if (end) data = data.filter(d => d.creado_en <= end);

            mappedData = data.map(p => [p.cedula, p.nombres, p.apellidos, p.sexo, p.fecha_nacimiento, p.creado_en]);
        } else if (type === 'inventario') {
            data = await ipcRenderer.invoke('consulta-get-inventory');
            title = "Inventario de Farmacia";
            filename = "Inventario_Farmacia";
            headers = ["Medicamento", "Principio Activo", "Presentación", "Stock"];
            mappedData = data.map(i => [i.nombre_comercial, i.principio_activo || 'N/A', i.presentacion, i.cantidad]);
        } else if (type === 'movimientos') {
            // Need a new handler for movements or use db-query
            const sql = `
                SELECT m.*, p.nombres, p.apellidos, p.cedula, i.nombre_comercial
                FROM movimientos_farmacia m
                LEFT JOIN pacientes p ON m.id_paciente = p.id_paciente
                JOIN inventario_farmacia i ON m.id_medicamento = i.id_medicamento
                ORDER BY m.fecha_hora DESC
            `;
            data = await ipcRenderer.invoke('db-query', sql);
            title = "Movimientos de Farmacia";
            filename = "Movimientos_Farmacia";
            headers = ["Fecha/Hora", "Medicamento", "Tipo", "Cantidad", "Paciente"];

            if (start) data = data.filter(d => d.fecha_hora >= start);
            if (end) data = data.filter(d => d.fecha_hora <= end);

            mappedData = data.map(m => [
                m.fecha_hora,
                m.nombre_comercial,
                m.tipo,
                m.cantidad,
                m.id_paciente ? `${m.nombres} ${m.apellidos}` : 'N/A'
            ]);
        }

        if (format === 'pdf') {
            await ReportUtils.downloadPDF(mappedData, headers, title, filename);
        } else {
            const excelData = mappedData.map(row => {
                let obj = {};
                headers.forEach((h, i) => obj[h] = row[i]);
                return obj;
            });
            await ReportUtils.downloadExcel(excelData, filename);
        }
        showToast("Reporte generado", "bg-success");
    } catch (e) {
        console.error(e);
        showToast("Error al generar reporte", "bg-danger");
    }
}

window.generateQuick = (type) => {
    generateReport(type, null, null, 'pdf');
};

function showToast(msg, bg) {
    const el = document.getElementById('liveToast');
    if (!el) return;
    el.className = `toast align-items-center text-white ${bg} border-0 rounded-4 shadow-lg`;
    el.querySelector('.toast-body').textContent = msg;
    new bootstrap.Toast(el).show();
}
