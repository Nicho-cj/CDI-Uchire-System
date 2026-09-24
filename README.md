# 🏥 CDI Uchire - Sistema de Gestión Médica

Sistema de escritorio diseñado y desarrollado para la gestión integral y el control médico del **Centro de Diagnóstico Integral (CDI) Uchire**, permitiendo optimizar el registro de pacientes, consultas y reportes de manera local y segura.

---

## 📋 Requisitos Previos

Asegúrate de contar con las siguientes herramientas antes de comenzar:

* **[Node.js](https://nodejs.org/?utm_source=gemini)**: Versión 16 o superior recomendada.
* **Editor de código**: [Visual Studio Code](https://code.visualstudio.com/?utm_source=gemini) (recomendado).

---

## 🚀 Instalación y Ejecución

Sigue estos pasos para poner en marcha la aplicación en tu entorno local:

1. **Clonar el repositorio**:
```bash
git clone https://github.com/Nicho-cj/CDI-Uchire-System.git

```


*(O descarga el archivo ZIP del proyecto y extráelo en tu computadora).*
2. **Instalar las dependencias**:
Abre una terminal en la carpeta raíz del proyecto y ejecuta:
```bash
npm install

```


3. **Iniciar la aplicación**:
Una vez finalizada la instalación, ejecuta el siguiente comando:
```bash
npm start

```



---

## 👥 Credenciales de Acceso (Por Defecto)

Puedes iniciar sesión utilizando alguno de los siguientes perfiles predeterminados según el rol que desees probar:

| Rol | Usuario | Contraseña |
| --- | --- | --- |
| **Administrador** | `admin` | `admin123` |
| **Director** | `director` | `dir123` |
| **Operador** | `operador` | `op123` |

---

## 🛠️ Tecnologías Utilizadas

Este proyecto fue construido utilizando las siguientes tecnologías y librerías:

* **Entorno de Escritorio**: [Electron.js](https://www.electronjs.org/?utm_source=gemini) + Node.js
* **Interfaz de Usuario**: HTML5, CSS3, JavaScript (ES6+), [Bootstrap 5](https://getbootstrap.com/?utm_source=gemini)
* **Almacenamiento**: [SQLite3](https://www.sqlite.org/?utm_source=gemini) (Base de datos local)
* **Generación de Reportes**: `jsPDF` (para documentos PDF) y `XLSX / SheetJS` (para hojas de cálculo Excel)

---

## 📂 Estructura del Proyecto

```text
📦 cdi-uchire-gestion
 ┣ 📂 Data               # Ubicación de la base de datos SQLite
 ┣ 📂 src                # Código fuente de la interfaz y lógica
 ┃ ┣ 📂 Operadores       # Módulos específicos según el rol de usuario
 ┃ ┣ 📂 js               # Scripts de cliente y proceso principal (main.js)
 ┃ ┗ 📜 index.html       # Vista principal de inicio de sesión
 ┣ 📜 BD_Final.txt       # Script SQL con la estructura original de la BD
 ┣ 📜 package.json       # Dependencias y configuración del proyecto
 ┗ 📜 README.md          # Documentación del proyecto

```
