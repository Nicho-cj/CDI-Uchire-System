const sqlite3 = require('sqlite3');
const path = require('path');
const { app } = require('electron');

class OperadorConsulta {
    constructor() {
        this.dbPath = path.join(app.getAppPath(), 'Data', 'sistema_médico.db');
    }

    _getDB() {
        return new sqlite3.Database(this.dbPath);
    }

    async getAllPacientes() {
        const db = this._getDB();
        try {
            return await new Promise((resolve, reject) => {
                db.all("SELECT * FROM pacientes ORDER BY creado_en DESC", [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        } catch (e) {
            console.error("Error getAllPacientes:", e);
            return [];
        } finally {
            db.close();
        }
    }

    async registrarPaciente(datos) {
        const db = this._getDB();
        try {
            const sql = `INSERT INTO pacientes (cedula, nombres, apellidos, fecha_nacimiento, sexo, telefono) 
                         VALUES (?, ?, ?, ?, ?, ?)`;
            const params = [
                datos.cedula,
                datos.nombres,
                datos.apellidos,
                datos.fecha_nacimiento,
                datos.sexo,
                datos.telefono
            ];

            return await new Promise((resolve, reject) => {
                db.run(sql, params, function (err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                });
            });
        } finally {
            db.close();
        }
    }

    async actualizarPaciente(id, datos) {
        const db = this._getDB();
        try {
            const sql = `UPDATE pacientes SET 
                         cedula = ?, nombres = ?, apellidos = ?, fecha_nacimiento = ?, sexo = ?, 
                         telefono = ?, actualizado_en = CURRENT_TIMESTAMP
                         WHERE id_paciente = ?`;
            const params = [
                datos.cedula,
                datos.nombres,
                datos.apellidos,
                datos.fecha_nacimiento,
                datos.sexo,
                datos.telefono,
                id
            ];

            return await new Promise((resolve, reject) => {
                db.run(sql, params, function (err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                });
            });
        } finally {
            db.close();
        }
    }

    async eliminarPaciente(id) {
        const db = this._getDB();
        try {
            return await new Promise((resolve, reject) => {
                db.run("DELETE FROM pacientes WHERE id_paciente = ?", [id], function (err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                });
            });
        } finally {
            db.close();
        }
    }

    async getPatientHistory(pacienteId) {
        const db = this._getDB();
        try {
            const sql = `
                SELECT c.*, d.nombre_area as departamento
                FROM consultas c
                JOIN departamentos d ON c.id_departamento = d.id_departamento
                WHERE c.id_paciente = ?
                ORDER BY c.fecha_consulta DESC, c.hora_consulta DESC
            `;
            return await new Promise((resolve, reject) => {
                db.all(sql, [pacienteId], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        } finally {
            db.close();
        }
    }

    async getInventory() {
        const db = this._getDB();
        try {
            const sql = "SELECT * FROM inventario_farmacia ORDER BY nombre_comercial ASC";
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

    async saveMedicamento(datos) {
        const db = this._getDB();
        try {
            const id = datos.id_medicamento || datos.id;
            const { nombre_comercial, principio_activo, concentracion, presentacion, cantidad } = datos;

            if (id) {
                const sql = `UPDATE inventario_farmacia SET 
                            nombre_comercial = ?, principio_activo = ?, concentracion = ?, 
                            presentacion = ?, cantidad = ?
                            WHERE id_medicamento = ?`;
                return await new Promise((resolve, reject) => {
                    db.run(sql, [nombre_comercial, principio_activo, concentracion, presentacion, cantidad, id], function (err) {
                        if (err) reject(err);
                        else resolve({ success: true, changes: this.changes });
                    });
                });
            } else {
                const sql = `INSERT INTO inventario_farmacia 
                            (nombre_comercial, principio_activo, concentracion, presentacion, cantidad)
                            VALUES (?, ?, ?, ?, ?)`;
                return await new Promise((resolve, reject) => {
                    db.run(sql, [nombre_comercial, principio_activo, concentracion, presentacion, cantidad || 0], function (err) {
                        if (err) reject(err);
                        else resolve({ success: true, id: this.lastID });
                    });
                });
            }
        } catch (e) {
            console.error(e);
            return { success: false, error: e.message };
        } finally {
            db.close();
        }
    }

    async registerMovimiento(datos) {
        const db = this._getDB();
        try {
            const { id_paciente, id_consulta, id_medicamento, tipo, cantidad } = datos;

            return await new Promise((resolve, reject) => {
                db.serialize(() => {
                    db.run("BEGIN TRANSACTION");
                    const sqlMove = `INSERT INTO movimientos_farmacia (id_paciente, id_consulta, id_medicamento, tipo, cantidad)
                                 VALUES (?, ?, ?, ?, ?)`;
                    db.run(sqlMove, [id_paciente, id_consulta, id_medicamento, tipo, cantidad], function (err) {
                        if (err) { db.run("ROLLBACK"); return reject(err); }

                        const stockChange = (tipo === 'Entrada') ? cantidad : -cantidad;
                        db.run("UPDATE inventario_farmacia SET cantidad = cantidad + ? WHERE id_medicamento = ?", [stockChange, id_medicamento], (updErr) => {
                            if (updErr) { db.run("ROLLBACK"); return reject(updErr); }
                            db.run("COMMIT");
                            resolve(this.lastID);
                        });
                    });
                });
            });
        } finally {
            db.close();
        }
    }

    async getInventoryStats() {
        const db = this._getDB();
        try {
            const sql = `
                SELECT 
                    (SELECT COUNT(*) FROM inventario_farmacia) as total_items,
                    (SELECT COUNT(*) FROM inventario_farmacia WHERE cantidad <= 10) as low_stock,
                    (SELECT COUNT(*) FROM movimientos_farmacia WHERE date(fecha_hora) >= date('now', '-7 days')) as recent_activities
            `;
            return await new Promise((resolve, reject) => {
                db.get(sql, [], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        } finally {
            db.close();
        }
    }

    async getStats() {
        const db = this._getDB();
        try {
            const sql = `
                SELECT 
                    (SELECT COUNT(*) FROM pacientes WHERE date(creado_en) = date('now')) as registro_hoy,
                    (SELECT COUNT(*) FROM consultas WHERE date(fecha_consulta) = date('now')) as consultas_hoy,
                    (SELECT COUNT(*) FROM pacientes WHERE sexo = 'M' AND date(creado_en) = date('now')) as hombres_hoy,
                    (SELECT COUNT(*) FROM pacientes WHERE sexo = 'F' AND date(creado_en) = date('now')) as mujeres_hoy,
                    (SELECT COUNT(*) FROM pacientes) as total_historico
            `;
            return await new Promise((resolve, reject) => {
                db.get(sql, [], (err, row) => {
                    if (err) reject(err);
                    else resolve(row || {});
                });
            });
        } finally {
            db.close();
        }
    }

    async getLastConsultations(limit = 10) {
        const db = this._getDB();
        try {
            const sql = `
                SELECT c.*, p.nombres, p.apellidos, p.cedula, d.nombre_area as departamento
                FROM consultas c
                JOIN pacientes p ON c.id_paciente = p.id_paciente
                JOIN departamentos d ON c.id_departamento = d.id_departamento
                ORDER BY c.fecha_consulta DESC, c.hora_consulta DESC
                LIMIT ?
            `;
            return await new Promise((resolve, reject) => {
                db.all(sql, [limit], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        } finally {
            db.close();
        }
    }

    async getPacienteByCedula(cedula) {
        const db = this._getDB();
        try {
            return await new Promise((resolve, reject) => {
                db.get("SELECT * FROM pacientes WHERE cedula = ?", [cedula], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        } finally {
            db.close();
        }
    }

    async getAllConsultations() {
        const db = this._getDB();
        try {
            const sql = `
                SELECT c.*, p.nombres, p.apellidos, p.cedula, d.nombre_area as departamento
                FROM consultas c
                JOIN pacientes p ON c.id_paciente = p.id_paciente
                JOIN departamentos d ON c.id_departamento = d.id_departamento
                ORDER BY c.fecha_consulta DESC, c.hora_consulta DESC
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

    async registrarConsulta(datos) {
        const db = this._getDB();
        try {
            const sql = `INSERT INTO consultas (id_paciente, id_departamento, fecha_consulta, hora_consulta, nota_adicional)
                         VALUES (?, ?, ?, ?, ?)`;
            const params = [
                datos.id_paciente,
                datos.id_departamento,
                datos.fecha || new Date().toISOString().split('T')[0],
                datos.hora || new Date().toTimeString().split(' ')[0],
                datos.nota_adicional
            ];
            return await new Promise((resolve, reject) => {
                db.run(sql, params, function (err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                });
            });
        } finally {
            db.close();
        }
    }
}

module.exports = new OperadorConsulta();
