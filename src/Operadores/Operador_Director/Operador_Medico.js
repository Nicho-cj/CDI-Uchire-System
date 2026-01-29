const sqlite3 = require('sqlite3');
const path = require('path');
const { app } = require('electron');
/**
 * Use the main process userData path to the DB for consistency with `main.js`.
 */

class OperadorMedico {
    constructor() {
        this.dbPath = path.join(app.getAppPath(), 'Data', 'sistema_médico.db');
    }

    _getDB() {
        return new sqlite3.Database(this.dbPath);
    }

    async getConsultasHoy(idMedico) {
        const db = this._getDB();
        try {
            return await new Promise((resolve, reject) => {
                db.all("SELECT * FROM consultas WHERE id_medico = ? AND fecha_consulta = CURRENT_DATE", [idMedico], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        } catch (e) {
            console.error("Error getConsultasHoy:", e);
            return [];
        } finally {
            db.close();
        }
    }

    async registrarTriaje(datos) {
        const db = this._getDB();
        try {
            const sql = `INSERT INTO triaje (id_paciente, temperatura, spo2, frecuencia_cardiaca, presion_arterial, sintomas_resumen, prioridad_sugerida, asignado_a, notas)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            return await new Promise((resolve, reject) => {
                db.run(sql, [datos.id_paciente, datos.temperatura, datos.spo2, datos.frecuencia_cardiaca, datos.presion_arterial, datos.sintomas, datos.prioridad, datos.id_medico, datos.notas], function (err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                });
            });
        } catch (e) {
            console.error("Error registrarTriaje:", e);
            throw e;
        } finally {
            db.close();
        }
    }
}

module.exports = new OperadorMedico();
