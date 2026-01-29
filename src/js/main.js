const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3');
const fs = require('fs');
const bcrypt = require('bcryptjs');

let db;

function createWindow() {
    const win = new BrowserWindow({
        width: 1920,
        height: 1080,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    win.maximize();
    win.loadFile(path.join(__dirname, '../html/login.html'));
}

app.whenReady().then(async () => {
    await ensureDatabase();
    createWindow();
});

async function ensureDatabase() {
    const dbFolder = path.join(app.getAppPath(), 'Data');
    const dbPath = path.join(dbFolder, 'sistema_médico.db');

    if (!fs.existsSync(dbFolder)) {
        fs.mkdirSync(dbFolder, { recursive: true });
    }

    const sqlPath = path.join(__dirname, '../../BD_Final.txt');

    if (fs.existsSync(dbPath)) {
        console.log('Database already exists at', dbPath);
        return;
    }

    try {
        const sql = fs.readFileSync(sqlPath, 'utf8');
        const dbTmp = new sqlite3.Database(dbPath);
        await new Promise((resolve, reject) => {
            dbTmp.serialize(() => {
                dbTmp.run("PRAGMA journal_mode=WAL;");
                dbTmp.run("PRAGMA synchronous = NORMAL;");
                dbTmp.run("PRAGMA busy_timeout = 5000;");

                dbTmp.exec(sql, (err) => {
                    if (err) console.error('Error running SQL during ensureDatabase:', err);
                    resolve();
                });
            });
        });
        dbTmp.close();
        console.log('Database created at', dbPath);
    } catch (err) {
        console.error('Failed to auto-create DB:', err);
    }
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// --- Database Connection Info ---
ipcMain.handle('read-db-sql', async () => {
    const dbPath = path.join(app.getAppPath(), 'Data', 'sistema_médico.db');
    const sqlPath = path.join(__dirname, '../../BD_Final.txt');

    let sql = '';
    try {
        sql = fs.readFileSync(sqlPath, 'utf8');
    } catch (err) {
        console.error('Could not read BD_Final.txt', err);
    }

    const exists = fs.existsSync(dbPath);
    let tables = [];
    if (exists) {
        try {
            const dbConn = new sqlite3.Database(dbPath);
            tables = await new Promise((resolve) => {
                dbConn.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
                    if (err) return resolve([]);
                    resolve(rows.map(r => r.name));
                });
            });
            dbConn.close();
        } catch (e) {
            console.error('Error checking tables', e);
        }
    }

    return { sql, exists, path: dbPath, tables };
});

ipcMain.handle('create-database', async (event) => {
    const dbFolder = path.join(app.getAppPath(), 'Data');
    const dbPath = path.join(dbFolder, 'sistema_médico.db');
    const sqlPath = path.join(__dirname, '../../BD_Final.txt');

    if (!fs.existsSync(dbFolder)) {
        fs.mkdirSync(dbFolder, { recursive: true });
    }

    try {
        const sql = fs.readFileSync(sqlPath, 'utf8');

        if (fs.existsSync(dbPath)) {
            try {
                fs.unlinkSync(dbPath);
            } catch (unlinkErr) {
                if (unlinkErr.code === 'EBUSY' || unlinkErr.code === 'EPERM') {
                    try { fs.writeFileSync(dbPath, ''); } catch (e) { }
                }
            }
        }

        const dbTmp = new sqlite3.Database(dbPath);
        const result = await new Promise((resolve) => {
            dbTmp.serialize(() => {
                dbTmp.run("PRAGMA journal_mode=WAL;");
                dbTmp.exec(sql, (err) => {
                    if (err) {
                        dbTmp.close();
                        return resolve({ success: false, error: err.message });
                    }
                    dbTmp.all("SELECT name FROM sqlite_master WHERE type='table'", (qerr, rows) => {
                        const tables = qerr ? [] : rows.map(r => r.name);
                        dbTmp.close();
                        return resolve({ success: true, path: dbPath, tables });
                    });
                });
            });
        });
        return result;
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// --- Core Operators ---
const opConsulta = require('../Operadores/Operador_Consulta/Operador_Consulta');
const opAdmin = require('../Operadores/Operador_Admin/Operador_Admin');

// Patient Management
ipcMain.handle('consulta-registrar-paciente', async (event, datos) => {
    try { return { success: true, id: await opConsulta.registrarPaciente(datos) }; }
    catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('consulta-get-all-pacientes', async () => {
    try { return await opConsulta.getAllPacientes(); } catch (e) { return []; }
});

ipcMain.handle('consulta-actualizar-paciente', async (event, id, datos) => {
    try { await opConsulta.actualizarPaciente(id, datos); return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('consulta-eliminar-paciente', async (event, id) => {
    try { await opConsulta.eliminarPaciente(id); return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('consulta-get-paciente-by-cedula', async (event, cedula) => {
    try { return await opConsulta.getPacienteByCedula(cedula); } catch (e) { return null; }
});

// Consultation Management
ipcMain.handle('consulta-registrar-consulta', async (event, datos) => {
    try { return { success: true, id: await opConsulta.registrarConsulta(datos) }; }
    catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('consulta-get-all-consultations', async () => {
    try { return await opConsulta.getAllConsultations(); } catch (e) { return []; }
});

ipcMain.handle('consulta-get-last-consultations', async (event, limit) => {
    try { return await opConsulta.getLastConsultations(limit); } catch (e) { return []; }
});

ipcMain.handle('consulta-get-patient-history', async (event, id) => {
    try { return await opConsulta.getPatientHistory(id); } catch (e) { return []; }
});

// Pharmacy Management
ipcMain.handle('consulta-get-inventory', async () => {
    try { return await opConsulta.getInventory(); } catch (e) { return []; }
});

ipcMain.handle('consulta-save-medicamento', async (event, datos) => {
    try { return await opConsulta.saveMedicamento(datos); } catch (e) { return null; }
});

ipcMain.handle('consulta-register-movimiento', async (event, datos) => {
    try { return await opConsulta.registerMovimiento(datos); } catch (e) { return null; }
});

ipcMain.handle('consulta-get-inventory-stats', async () => {
    try { return await opConsulta.getInventoryStats(); } catch (e) { return {}; }
});

ipcMain.handle('consulta-get-stats', async () => {
    try { return await opConsulta.getStats(); } catch (e) { return {}; }
});

// Admin & Director Shared handlers
ipcMain.handle('admin-get-users', async () => {
    try { return await opAdmin.getAllUsers(); } catch (e) { return []; }
});

ipcMain.handle('admin-save-user', async (event, user, adminId) => {
    try { const id = await opAdmin.saveUser(user, adminId); return { success: true, id }; }
    catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('admin-delete-user', async (event, id, adminId) => {
    try { await opAdmin.deleteUser(id, adminId); return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('admin-get-departments', async () => {
    try { return await opAdmin.getAllDepartments(); } catch (e) { return []; }
});

ipcMain.handle('admin-save-department', async (event, dept, adminId) => {
    try { const id = await opAdmin.saveDepartment(dept, adminId); return { success: true, id }; }
    catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('admin-get-audit-logs', async () => {
    try { return await opAdmin.getAuditLogs(); } catch (e) { return []; }
});

ipcMain.handle('admin-get-db-stats', async () => {
    try { return await opAdmin.getDBStats(); } catch (e) { return {}; }
});

ipcMain.handle('admin-execute-sql', async (event, sql, adminId) => {
    try { return await opAdmin.executeCustomSQL(sql, adminId); } catch (e) { return { success: false, error: e.message }; }
});

// Standardized Director Handlers
ipcMain.handle('get-dashboard-stats-director', async () => {
    try {
        const [stats, audit] = await Promise.all([
            opAdmin.getDBStats(),
            opAdmin.getAuditLogs()
        ]);
        return {
            users: stats.usuarios || 0,
            depts: stats.departamentos || 0,
            patients: stats.pacientes || 0,
            consultations: stats.consultas || 0,
            pharmacy_items: stats.inventario_farmacia || 0,
            audit_events: stats.auditoria_acciones || 0,
            recent_logs: audit.slice(0, 10)
        };
    } catch (e) { console.error(e); return {}; }
});

// Director specific (standardizing names)
ipcMain.handle('get-users-director', async () => { try { return await opAdmin.getAllUsers(); } catch (e) { return []; } });
ipcMain.handle('save-user-director', async (event, user, idAdmin) => {
    try { const id = await opAdmin.saveUser(user, idAdmin); return { success: true, id }; }
    catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('delete-user-director', async (event, id, idAdmin) => {
    try { await opAdmin.deleteUser(id, idAdmin); return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('get-depts-director', async () => { try { return await opAdmin.getAllDepartments(); } catch (e) { return []; } });
ipcMain.handle('save-dept-director', async (event, dept, idAdmin) => {
    try { const id = await opAdmin.saveDepartment(dept, idAdmin); return { success: true, id }; }
    catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('get-audit-logs-director', async () => { try { return await opAdmin.getAuditLogs(); } catch (e) { return []; } });
ipcMain.handle('get-patients-director', async () => { try { return await opConsulta.getAllPacientes(); } catch (e) { return []; } });
ipcMain.handle('get-pharmacy-inventory-director', async () => { try { return await opConsulta.getInventory(); } catch (e) { return []; } });
ipcMain.handle('get-pharmacy-stats-director', async () => { try { return await opConsulta.getInventoryStats(); } catch (e) { return {}; } });
ipcMain.handle('save-medicamento-director', async (event, drug, idAdmin) => {
    try { const res = await opConsulta.saveMedicamento(drug, idAdmin); return { success: true, ...res }; }
    catch (e) { return { success: false, error: e.message }; }
});

// Common DB Query
ipcMain.handle('db-query', async (event, sql, params = []) => {
    const dbPath = path.join(app.getAppPath(), 'Data', 'sistema_médico.db');
    const db = new sqlite3.Database(dbPath);
    return new Promise((resolve, reject) => {
        if (sql.trim().toUpperCase().startsWith('SELECT')) {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        } else {
            db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
            });
        }
        db.close();
    });
});

ipcMain.handle('login', async (event, { username, password }) => {
    const dbPath = path.join(app.getAppPath(), 'Data', 'sistema_médico.db');
    const dbConn = new sqlite3.Database(dbPath);

    return new Promise((resolve) => {
        dbConn.get(`SELECT u.id_usuario, u.password_hash, r.nombre_rol 
                    FROM usuarios u 
                    JOIN roles r ON u.id_rol = r.id_rol 
                    WHERE u.nombre_usuario = ? AND u.estado = 'Activo'`, [username], async (err, row) => {
            if (err) {
                dbConn.close();
                resolve({ success: false, message: 'Error de base de datos' });
                return;
            }

            if (row) {
                let isValid = false;
                if (row.password_hash && (row.password_hash.startsWith('$2a$') || row.password_hash.startsWith('$2b$'))) {
                    isValid = await bcrypt.compare(password, row.password_hash);
                } else {
                    isValid = (password === row.password_hash);
                }

                if (isValid) {
                    dbConn.run("UPDATE usuarios SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id_usuario = ?", [row.id_usuario]);
                    dbConn.run("INSERT INTO auditoria_acciones (id_usuario, nombre_movimiento, resultado) VALUES (?, ?, ?)", [row.id_usuario, 'LOGIN EXITOSO', 'Exitoso']);
                    dbConn.close();
                    resolve({ success: true, role: row.nombre_rol, id_usuario: row.id_usuario });
                } else {
                    dbConn.run("INSERT INTO auditoria_acciones (id_usuario, nombre_movimiento, resultado) VALUES (?, ?, ?)", [row.id_usuario, 'INTENTO LOGUIN FALLIDO', 'Error']);
                    dbConn.close();
                    resolve({ success: false, message: 'Credenciales inválidas' });
                }
                return;
            }

            dbConn.close();
            // Legacy/Bootstrap admin
            if (username === 'admin' && password === 'admin123') return resolve({ success: true, role: 'Administrador', id_usuario: 1 });
            return resolve({ success: false, message: 'Credenciales inválidas' });
        });
    });
});