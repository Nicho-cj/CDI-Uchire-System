const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('btn-generate-db');
    const statusBadge = document.querySelector('.tables-status-header .badge');
    const tableCards = document.querySelectorAll('.table-card');
    const sqlContent = document.getElementById('sql-content');
    const installLog = document.getElementById('install-log');
    const dbPathEl = document.getElementById('db-path');

    // --- Database Explorer Logic ---
    const adminSection = document.getElementById('admin-explorer');
    const tableSelector = document.getElementById('table-selector');
    const dataDisplayContainer = document.getElementById('data-display-container');
    const tableEmptyState = document.getElementById('table-empty-state');
    const tableHead = document.getElementById('table-head');
    const tableBody = document.getElementById('table-body');

    function updateExplorer(info) {
        if (info.exists && info.tables && info.tables.length > 0) {
            if (adminSection) adminSection.style.display = 'block';

            // Populate selector
            if (tableSelector) {
                tableSelector.innerHTML = '<option selected disabled>Seleccionar tabla...</option>';
                info.tables.forEach(table => {
                    const option = document.createElement('option');
                    option.value = table;
                    option.textContent = table;
                    tableSelector.appendChild(option);
                });
            }
        } else {
            if (adminSection) adminSection.style.display = 'none';
        }
    }

    if (tableSelector) {
        tableSelector.addEventListener('change', async (e) => {
            const tableName = e.target.value;
            if (!tableName) return;

            try {
                tableEmptyState.style.display = 'none';
                dataDisplayContainer.style.display = 'none';

                const rows = await ipcRenderer.invoke('db-query', `SELECT * FROM ${tableName} LIMIT 100`);

                if (rows && rows.length > 0) {
                    renderTable(rows);
                    dataDisplayContainer.style.display = 'block';
                } else {
                    tableEmptyState.style.display = 'block';
                    tableEmptyState.innerHTML = `<i class="fas fa-info-circle fa-3x mb-3 opacity-25"></i><p>La tabla "${tableName}" está vacía.</p>`;
                }
            } catch (err) {
                console.error(err);
                tableEmptyState.style.display = 'block';
                tableEmptyState.innerHTML = `<i class="fas fa-exclamation-triangle fa-3x mb-3 text-danger opacity-25"></i><p>Error al cargar datos de la tabla "${tableName}".</p>`;
            }
        });
    }

    function renderTable(rows) {
        // Headers
        const cols = Object.keys(rows[0]);
        tableHead.innerHTML = cols.map(c => `<th>${c.replace(/_/g, ' ')}</th>`).join('');

        // Rows
        tableBody.innerHTML = rows.map(row => {
            return `<tr>${cols.map(c => {
                let val = row[c];
                if (val === null) val = '<em class="text-muted">null</em>';
                if (c.toLowerCase().includes('hash')) val = '********'; // Hide hashes
                return `<td>${val}</td>`;
            }).join('')}</tr>`;
        }).join('');
    }

    // Load BD_Final.txt content and current DB status
    (async () => {
        try {
            const info = await ipcRenderer.invoke('read-db-sql');
            if (sqlContent) sqlContent.innerText = info.sql || 'No se encontró BD_Final.txt';
            if (dbPathEl) dbPathEl.innerText = info.path || '';

            if (info.exists) {
                statusBadge.className = 'badge bg-success px-3 py-2';
                statusBadge.innerText = 'Estado: Base de Datos Instalada';
                installLog.innerText = 'Base de datos encontrada en: ' + (info.path || '') + '\nTablas: ' + (info.tables || []).join(', ');

                // Change button text to reflect re-installation
                if (generateBtn) {
                    generateBtn.innerHTML = '<i class="fas fa-redo me-2"></i> Reinstalar y Limpiar Sistema';
                    generateBtn.className = 'btn btn-outline-danger btn-lg shadow';
                }

                tableCards.forEach(card => {
                    const nameCell = card.querySelector('.table-name');
                    if (!nameCell) return;
                    const name = nameCell.innerText.trim();
                    if (info.tables && info.tables.includes(name)) {
                        const status = card.querySelector('.table-status');
                        status.className = 'table-status status-online';
                        status.innerHTML = '<i class="fas fa-check-circle me-1"></i>Activo';
                        card.style.borderColor = '#0a9396';
                    }
                });

                updateExplorer(info);
            } else {
                statusBadge.className = 'badge bg-secondary px-3 py-2';
                statusBadge.innerText = 'Estado: Pendiente de Instalación';
                if (installLog) installLog.innerText = 'La base de datos no existe. Presione "Generar Estructura Hospitalaria" para crearla.';
                if (generateBtn) {
                    generateBtn.innerHTML = '<i class="fas fa-file-medical-alt me-2"></i> Generar Estructura Hospitalaria';
                    generateBtn.className = 'btn btn-primary btn-lg shadow';
                }
            }
        } catch (e) {
            console.error(e);
            if (installLog) installLog.innerText = 'Error al leer BD_Final.txt o estado de la BD.';
        }
    })();

    if (generateBtn) {
        generateBtn.addEventListener('click', async () => {
            generateBtn.disabled = true;
            const originalHtml = generateBtn.innerHTML;
            generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Creando Sistema...';
            if (installLog) installLog.innerText = 'Iniciando creación de la base de datos...\n';

            try {
                const result = await ipcRenderer.invoke('create-database');

                if (result.success) {
                    statusBadge.className = 'badge bg-success px-3 py-2';
                    statusBadge.innerText = 'Estado: Base de Datos Instalada';
                    if (dbPathEl && result.path) dbPathEl.innerText = result.path;

                    if (installLog) installLog.innerText += 'Creación finalizada. Tablas creadas: ' + (result.tables || []).join(', ') + '\n';

                    tableCards.forEach(card => {
                        const nameCell = card.querySelector('.table-name');
                        if (!nameCell) return;
                        const name = nameCell.innerText.trim();
                        const status = card.querySelector('.table-status');
                        if (result.tables && result.tables.includes(name)) {
                            status.className = 'table-status status-online';
                            status.innerHTML = '<i class="fas fa-check-circle me-1"></i>Activo';
                            card.style.borderColor = '#0a9396';
                        } else {
                            status.className = 'table-status status-pending';
                            status.innerHTML = '<i class="fas fa-clock me-1"></i>Error';
                            card.style.borderColor = '#ef4444';
                        }
                    });

                    updateExplorer({ exists: true, tables: result.tables });

                    // Show a "Go to Login" button instead of immediate redirect
                    if (generateBtn) {
                        generateBtn.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i> Operación Exitosa - Ir al Login';
                        generateBtn.className = 'btn btn-success btn-lg shadow';
                        generateBtn.disabled = false;
                        generateBtn.onclick = () => window.location.href = 'login.html';
                    }

                    if (installLog) {
                        installLog.innerText += '\nSISTEMA LISTO. Puede explorar las tablas abajo o ingresar al sistema.';
                        installLog.style.background = '#d1e7dd';
                    }

                    alert('Base de Datos creada/restablecida exitosamente.');
                } else {
                    if (installLog) installLog.innerText += 'Error: ' + (result.error || 'Error desconocido') + '\n';
                    alert('Error al crear la base de datos: ' + (result.error || 'Error desconocido'));
                }
            } catch (err) {
                console.error(err);
                if (installLog) installLog.innerText += 'Error de comunicación con el proceso principal\n';
                alert('Error de comunicación con el proceso principal');
            } finally {
                generateBtn.disabled = false;
                generateBtn.innerHTML = originalHtml;
            }
        });
    }
});
