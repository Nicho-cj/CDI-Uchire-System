const sqlite3 = require('sqlite3');
const path = require('path');
const { app } = require('electron');
const bcrypt = require('bcryptjs');

class OperadorAdmin {
    constructor() {
        this.dbPath = path.join(app.getAppPath(), 'Data', 'sistema_médico.db');
    }

    _getDB() {
        return new sqlite3.Database(this.dbPath);
    }

    // --- Audit Logging ---
    async addAuditLog(usuarioId, nombreMovimiento, resultado = 'Exitoso') {
        const db = this._getDB();
        try {
            return await new Promise((resolve, reject) => {
                const sql = `INSERT INTO auditoria_acciones (id_usuario, nombre_movimiento, resultado, fecha_hora) VALUES (?, ?, ?, datetime('now', 'localtime'))`;
                db.run(sql, [usuarioId || 1, nombreMovimiento, resultado], function (err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                });
            });
        } finally {
            db.close();
        }
    }

    // --- User Management ---
    async getAllUsers() {
        const db = this._getDB();
        try {
            const sql = `
                SELECT u.*, r.nombre_rol
                FROM usuarios u 
                JOIN roles r ON u.id_rol = r.id_rol
                ORDER BY u.nombre_completo ASC
            `;
            return await new Promise((resolve, reject) => {
                db.all(sql, [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        } finally {
            db.close();
        }
    }

    async saveUser(user, adminId = 1) {
        const db = this._getDB();
        try {
            return await new Promise((resolve, reject) => {
                db.serialize(async () => {
                    db.run("BEGIN TRANSACTION");

                    try {
                        let passwordHash = user.password_hash;
                        if (passwordHash && !passwordHash.startsWith('$2')) {
                            passwordHash = await bcrypt.hash(passwordHash, 10);
                        }

                        let sql, params;
                        if (user.id_usuario) {
                            if (passwordHash) {
                                sql = `UPDATE usuarios SET nombre_completo = ?, nombre_usuario = ?, id_rol = ?, estado = ?, password_hash = ? WHERE id_usuario = ?`;
                                params = [user.nombre_completo, user.nombre_usuario, user.id_rol, user.estado, passwordHash, user.id_usuario];
                            } else {
                                sql = `UPDATE usuarios SET nombre_completo = ?, nombre_usuario = ?, id_rol = ?, estado = ? WHERE id_usuario = ?`;
                                params = [user.nombre_completo, user.nombre_usuario, user.id_rol, user.estado, user.id_usuario];
                            }
                        } else {
                            if (!passwordHash) passwordHash = await bcrypt.hash('123456', 10);
                            sql = `INSERT INTO usuarios (nombre_completo, nombre_usuario, password_hash, id_rol, estado) VALUES (?, ?, ?, ?, ?)`;
                            params = [user.nombre_completo, user.nombre_usuario, passwordHash, user.id_rol, user.estado];
                        }

                        db.run(sql, params, function (err) {
                            if (err) { db.run("ROLLBACK"); return reject(err); }
                            db.run("COMMIT");
                            resolve(user.id_usuario || this.lastID);
                        });

                        const actionName = user.id_usuario ? `MODIFICAR USUARIO: ${user.nombre_usuario}` : `REGISTRAR USUARIO: ${user.nombre_usuario}`;
                        await this.addAuditLog(adminId, actionName);

                    } catch (e) {
                        db.run("ROLLBACK");
                        reject(e);
                    }
                });
            });
        } finally {
            db.close();
        }
    }

    async deleteUser(id, adminId = 1) {
        const db = this._getDB();
        try {
            const user = await new Promise((resolve) => {
                db.get("SELECT nombre_usuario FROM usuarios WHERE id_usuario = ?", [id], (err, row) => resolve(row));
            });

            const result = await new Promise((resolve, reject) => {
                db.run("DELETE FROM usuarios WHERE id_usuario = ?", [id], function (err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                });
            });

            if (user) {
                await this.addAuditLog(adminId, `ELIMINAR USUARIO: ${user.nombre_usuario}`);
            }

            return result;
        } finally {
            db.close();
        }
    }

    // --- Department Management ---
    async getAllDepartments() {
        const db = this._getDB();
        try {
            const sql = "SELECT * FROM departamentos ORDER BY nombre_area ASC";
            return await new Promise((resolve, reject) => {
                db.all(sql, [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        } finally {
            db.close();
        }
    }

    async saveDepartment(dept, adminId = 1) {
        const db = this._getDB();
        try {
            const sql = dept.id_departamento
                ? `UPDATE departamentos SET nombre_area = ?, descripcion = ?, estado = ? WHERE id_departamento = ?`
                : `INSERT INTO departamentos (nombre_area, descripcion, estado) VALUES (?, ?, ?)`;

            const params = [dept.nombre_area, dept.descripcion, dept.estado];
            if (dept.id_departamento) params.push(dept.id_departamento);

            const resultId = await new Promise((resolve, reject) => {
                db.run(sql, params, function (err) {
                    if (err) reject(err);
                    else resolve(this.lastID || dept.id_departamento);
                });
            });

            const actionName = dept.id_departamento ? `MODIFICAR DEPARTAMENTO: ${dept.nombre_area}` : `REGISTRAR DEPARTAMENTO: ${dept.nombre_area}`;
            await this.addAuditLog(adminId, actionName);

            return resultId;
        } finally {
            db.close();
        }
    }

    async getAuditLogs() {
        const db = this._getDB();
        try {
            const sql = `
                SELECT a.*, u.nombre_usuario 
                FROM auditoria_acciones a 
                LEFT JOIN usuarios u ON a.id_usuario = u.id_usuario
                ORDER BY a.fecha_hora DESC
            `;
            return await new Promise((resolve, reject) => {
                db.all(sql, [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        } finally {
            db.close();
        }
    }

    async getDBStats() {
        const db = this._getDB();
        const tables = ['usuarios', 'pacientes', 'consultas', 'inventario_farmacia', 'auditoria_acciones'];
        const stats = {};

        try {
            for (const table of tables) {
                const row = await new Promise((resolve) => {
                    db.get(`SELECT COUNT(*) as count FROM ${table}`, (err, row) => resolve(row || { count: 0 }));
                });
                stats[table] = row.count;
            }
            return stats;
        } catch (e) {
            console.error(e);
            return {};
        } finally {
            db.close();
        }
    }

    async executeCustomSQL(sql, adminId = 1) {
        const db = this._getDB();
        try {
            const res = await new Promise((resolve, reject) => {
                db.all(sql, [], (err, rows) => {
                    if (err) resolve({ success: false, error: err.message });
                    else resolve({ success: true, data: rows });
                });
            });
            await this.addAuditLog(adminId, `EJECUTAR SQL: ${sql.substring(0, 50)}...`);
            return res;
        } finally {
            db.close();
        }
    }
}

module.exports = new OperadorAdmin();
