/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */

/**
 * reports_utils.js - ULTIMATE ELECTRON COMPATIBLE VERSION
 * Maneja tanto require() como globales de script tags.
 */

(function () {
    console.log('[ReportUtils] Inicializando script...');

    let jsPDF, autoTable, XLSX;

    // Función para obtener librerías de cualquier fuente
    function resolveDeps() {
        // Fuente A: Globales (si se cargaron vía <script> con fix de module=undefined)
        if (window.jspdf) jsPDF = window.jspdf.jsPDF || window.jspdf;
        if (window.XLSX) XLSX = window.XLSX;
        if (window.autoTable) autoTable = window.autoTable;

        // Fuente B: require() de Electron
        if (typeof require !== 'undefined') {
            try {
                if (!jsPDF) {
                    const jspdfMod = require('jspdf');
                    jsPDF = jspdfMod.jsPDF || jspdfMod;
                }
                if (!XLSX) XLSX = require('xlsx');

                // jspdf-autotable es especial, suele registrarse solo en jsPDF.API
                if (!autoTable) {
                    try {
                        const atMod = require('jspdf-autotable');
                        autoTable = atMod.default || atMod;
                    } catch (e) { }
                }
            } catch (e) {
                console.warn('[ReportUtils] Falló require local:', e);
            }
        }

        return { jsPDF, XLSX, autoTable };
    }

    const Utils = {
        async downloadPDF(data, headers, title, filename = 'reporte', extraData = null) {
            const deps = resolveDeps();
            console.log('[ReportUtils] downloadPDF llamado', { hasJsPDF: !!deps.jsPDF, hasAutoTable: !!deps.autoTable });

            if (!deps.jsPDF) {
                alert("Error: jsPDF no encontrado. Intente recargar.");
                return;
            }

            try {
                const doc = new deps.jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
                const primary = [10, 147, 150];

                doc.setFontSize(18);
                doc.setTextColor(...primary);
                doc.text(title || 'Reporte', 14, 20);

                doc.setFontSize(10);
                doc.setTextColor(100);
                doc.text(`CDI UCHIRE - Generación: ${new Date().toLocaleString()}`, 14, 28);
                doc.line(14, 32, 196, 32);

                let currentY = 38;

                // Handle optional summary/patient data
                if (extraData && Array.isArray(extraData)) {
                    doc.setFontSize(11);
                    doc.setTextColor(50);
                    extraData.forEach(item => {
                        doc.setFont(undefined, 'bold');
                        doc.text(`${item[0]}:`, 14, currentY);
                        doc.setFont(undefined, 'normal');
                        doc.text(`${item[1]}`, 45, currentY);
                        currentY += 6;
                    });
                    currentY += 4;
                    doc.line(14, currentY, 196, currentY);
                    currentY += 8;
                }

                const tableBody = data.map(r => Array.isArray(r) ? r : Object.values(r));

                const options = {
                    head: [headers],
                    body: tableBody,
                    startY: currentY,
                    theme: 'striped',
                    headStyles: { fillColor: primary, halign: 'center' },
                    didDrawPage: (data) => {
                        doc.setFontSize(8);
                        doc.text('Página ' + doc.internal.getNumberOfPages(), 14, doc.internal.pageSize.height - 10);
                    }
                };

                // Intentar múltiples formas de llamar autotable
                if (typeof doc.autoTable === 'function') {
                    doc.autoTable(options);
                } else if (typeof deps.autoTable === 'function') {
                    deps.autoTable(doc, options);
                } else {
                    console.error('[ReportUtils] AutoTable no disponible.');
                    alert("Error: No se pudo cargar el plugin de tablas PDF.");
                    return;
                }

                doc.save(`${filename}_${Date.now()}.pdf`);
            } catch (err) {
                console.error('[ReportUtils] Error PDF:', err);
                alert("Error: " + err.message);
            }
        },

        async downloadExcel(data, filename = 'reporte') {
            const deps = resolveDeps();
            if (!deps.XLSX) {
                alert("Error: XLSX no encontrado.");
                return;
            }
            try {
                const ws = deps.XLSX.utils.json_to_sheet(data);
                const wb = deps.XLSX.utils.book_new();
                deps.XLSX.utils.book_append_sheet(wb, ws, "Datos");
                deps.XLSX.writeFile(wb, `${filename}_${Date.now()}.xlsx`);
            } catch (err) {
                alert("Error Excel: " + err.message);
            }
        },

        test() {
            const deps = resolveDeps();
            const msg = `Librerías registradas:\n- jsPDF: ${!!deps.jsPDF}\n- XLSX: ${!!deps.XLSX}\n- AutoTable: ${!!deps.autoTable || typeof (new (deps.jsPDF || Object)()).autoTable === 'function'}`;
            alert(msg);
            console.log('[ReportUtils] Test:', deps);
        }
    };

    window.ReportUtils = Utils;
    console.log('[ReportUtils] Listo.');
})();
