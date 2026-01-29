const { ipcRenderer } = require('electron');

let userModal;

document.addEventListener('DOMContentLoaded', () => {
    const role = sessionStorage.getItem('userRole');
    if (!role || (role !== 'Administrador' && role !== 'Director')) {
        window.location.href = '../login.html';
    }

    const modalEl = document.getElementById('userModal');
    if (modalEl) userModal = new bootstrap.Modal(modalEl);

    init();
});

async function init() {
    await loadUsers();
    setupListeners();
}

async function loadUsers() {
    try {
        const users = await ipcRenderer.invoke('get-users-director');
        const tbody = document.getElementById('users-tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        // Director should only manage Director and Operador (maybe only Operador, but keeping logic for now)
        const filteredUsers = users.filter(u => u.nombre_rol !== 'Administrador');

        filteredUsers.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><div class="fw-bold">${u.nombre_completo}</div></td>
                <td><span class="text-muted">@${u.nombre_usuario}</span></td>
                <td><span class="role-pill ${getRoleClass(u.nombre_rol)}">${u.nombre_rol}</span></td>
                <td><span class="status-badge ${u.estado === 'Activo' ? 'badge-online' : 'badge-urgent'}">${u.estado}</span></td>
                <td class="text-end">
                    <button class="btn btn-sm btn-light rounded-circle p-2" onclick='editUser(${JSON.stringify(u)})'><i class="fas fa-edit text-primary"></i></button>
                    ${u.nombre_usuario !== 'admin' ? `<button class="btn btn-sm btn-light rounded-circle p-2" onclick="deleteUser(${u.id_usuario})"><i class="fas fa-trash text-danger"></i></button>` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error(e);
    }
}

function getRoleClass(role) {
    if (role === 'Administrador') return 'role-admin';
    if (role === 'Director') return 'role-medico';
    return 'role-recepcion';
}

function setupListeners() {
    document.getElementById('btn-add-user').onclick = () => {
        document.getElementById('user-form').reset();
        document.getElementById('u-id').value = '';
        document.getElementById('userModalTitle').textContent = "Nueva Cuenta de Acceso";
        userModal.show();
    };

    document.getElementById('user-form').onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            id_usuario: document.getElementById('u-id').value,
            nombre_completo: document.getElementById('u-name').value,
            nombre_usuario: document.getElementById('u-user').value,
            id_rol: document.getElementById('u-rol').value,
            estado: document.getElementById('u-state').value,
            password_hash: document.getElementById('u-pass').value || null
        };

        const res = await ipcRenderer.invoke('save-user-director', data, sessionStorage.getItem('userId'));
        if (res.success || typeof res === 'number') {
            showToast("Usuario guardado", "bg-success");
            userModal.hide();
            await loadUsers();
        } else {
            showToast("Error: " + (res.error || 'Fallo al guardar'), "bg-danger");
        }
    };
}

window.editUser = (u) => {
    document.getElementById('userModalTitle').textContent = "Modificar Usuario";
    document.getElementById('u-id').value = u.id_usuario;
    document.getElementById('u-name').value = u.nombre_completo;
    document.getElementById('u-user').value = u.nombre_usuario;
    document.getElementById('u-rol').value = u.id_rol;
    document.getElementById('u-state').value = u.estado;
    document.getElementById('u-pass').value = '';

    userModal.show();
};

window.deleteUser = async (id) => {
    if (confirm("¿Seguro que desea revocar el acceso a este usuario?")) {
        const res = await ipcRenderer.invoke('delete-user-director', id, sessionStorage.getItem('userId'));
        if (res.success || res > 0) {
            showToast("Acceso revocado", "bg-success");
            await loadUsers();
        }
    }
};

function showToast(msg, bg) {
    const el = document.getElementById('liveToast');
    el.className = `toast align-items-center text-white ${bg} border-0 rounded-4 shadow-lg`;
    el.querySelector('.toast-body').textContent = msg;
    new bootstrap.Toast(el).show();
}
