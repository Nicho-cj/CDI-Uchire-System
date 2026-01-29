const { ipcRenderer } = require('electron');

let chartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    const role = sessionStorage.getItem('userRole');
    if (!role || (role !== 'Administrador' && role !== 'Director')) {
        window.location.href = '../login.html';
    }

    init();
});

async function init() {
    setupListeners();
    renderCharts();
}

function setupListeners() {
    // Quick Reports
    document.getElementById('rep-patients').onclick = () => generateReport('pacientes');
    document.getElementById('rep-consultations').onclick = () => generateReport('consultas');
    document.getElementById('rep-inventory').onclick = () => generateReport('inventario');
    document.getElementById('rep-audit').onclick = () => generateReport('auditoria');

    // Personalized Report
    document.getElementById('btn-custom-pdf').onclick = async () => {
        const type = document.getElementById('custom-type').value;
        const start = document.getElementById('custom-start').value;
        const end = document.getElementById('custom-end').value;
        await generateReport(type, start, end);
    };
}

async function generateReport(type, start = '', end = '') {
    try {
        let data = [];
        let headers = [];
        let title = "";
        let filename = "";

        if (type === 'pacientes') {
            data = await ipcRenderer.invoke('get-patients-director');
            title = "Archivo Maestro de Pacientes - Registro Institucional";
            filename = "Pacientes_CDI";
            headers = ["CI", "Nombres", "Apellidos", "Nacimiento", "Sexo", "Registro"];
            data = data.filter(p => (!start || p.creado_en >= start) && (!end || p.creado_en <= end))
                .map(p => [p.cedula, p.nombres, p.apellidos, p.fecha_nacimiento, p.sexo, new Date(p.creado_en).toLocaleDateString()]);
        }
        else if (type === 'consultas') {
            data = await ipcRenderer.invoke('consulta-get-all-consultations');
            title = "Reporte Institucional de Consultas Médicas";
            filename = "Consultas_CDI";
            headers = ["Fecha", "Hora", "Paciente", "Cédula", "Área"];
            data = data.filter(c => (!start || c.fecha_consulta >= start) && (!end || c.fecha_consulta <= end))
                .map(c => [c.fecha_consulta, c.hora_consulta, `${c.nombres} ${c.apellidos}`, c.cedula, c.departamento]);
        }
        else if (type === 'inventario') {
            data = await ipcRenderer.invoke('get-pharmacy-inventory-director');
            title = "Kardex de Inventario Farmacéutico";
            filename = "Farmacia_CDI";
            headers = ["Nombre", "P. Activo", "Conc.", "Presentación", "Stock"];
            data = data.map(i => [i.nombre_comercial, i.principio_activo, i.concentracion, i.presentacion, i.cantidad]);
        }
        else if (type === 'auditoria') {
            data = await ipcRenderer.invoke('get-audit-logs-director');
            title = "Bitácora de Auditoría y Seguridad";
            filename = "Auditoria_CDI";
            headers = ["Fecha/Hora", "Usuario", "Movimiento", "Resultado"];
            data = data.filter(l => (!start || l.fecha_hora >= start) && (!end || l.fecha_hora <= end))
                .map(l => [new Date(l.fecha_hora).toLocaleString(), l.nombre_usuario || 'Sistema', l.nombre_movimiento, l.resultado]);
        }

        if (data.length === 0) {
            alert("No hay registros en el rango seleccionado.");
            return;
        }

        ReportUtils.downloadPDF(data, headers, title, filename);
    } catch (e) {
        console.error(e);
        alert("Error al generar el reporte.");
    }
}

async function renderCharts() {
    const canvas = document.getElementById('trendsChart');
    if (!canvas) return;

    try {
        const consultations = await ipcRenderer.invoke('consulta-get-all-consultations');

        const counts = {};
        const labels = [];
        const now = new Date();

        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(now.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const displayStr = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
            labels.push(displayStr);
            counts[dateStr] = 0;
        }

        consultations.forEach(c => {
            const date = c.fecha_consulta; // Correct key
            if (counts.hasOwnProperty(date)) counts[date]++;
        });

        const ctx = canvas.getContext('2d');
        if (chartInstance) chartInstance.destroy();

        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(10, 147, 150, 0.4)');
        gradient.addColorStop(1, 'rgba(10, 147, 150, 0.05)');

        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Número de Consultas',
                    data: Object.values(counts),
                    borderColor: '#0a9396',
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointRadius: 4,
                    pointBackgroundColor: '#0a9396'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } },
                    x: { grid: { display: false } }
                }
            }
        });
    } catch (e) {
        console.error("Error rendering chart:", e);
    }
}
