const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const togglePassword = document.getElementById('togglePassword');

    // Focus username on load
    setTimeout(() => usernameInput.focus(), 500);

    // Toggle password visibility
    if (togglePassword) {
        togglePassword.addEventListener('click', function () {
            const icon = this.querySelector('i');
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                icon.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                icon.classList.replace('fa-eye-slash', 'fa-eye');
            }
        });
    }

    // Handle Login
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = loginForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Verificando...';

            const credentials = {
                username: usernameInput.value,
                password: passwordInput.value
            };

            try {
                const result = await ipcRenderer.invoke('login', credentials);

                if (result.success) {
                    // Store info in sessionStorage for UI checks
                    sessionStorage.setItem('userRole', result.role);
                    sessionStorage.setItem('username', usernameInput.value);
                    sessionStorage.setItem('userId', result.id_usuario);

                    // Redirect based on role
                    switch (result.role) {
                        case 'Administrador':
                            // Assuming there's an admin dashboard
                            window.location.href = 'SuperAdmin.html';
                            break;
                        case 'Director':
                            window.location.href = 'Menus_Director/director_dashboard.html';
                            break;
                        case 'Operador':
                            window.location.href = 'Menus_Consulta/dashboard_cosn.html';
                            break;
                        default:
                            alert('Rol desconocido');
                            submitBtn.disabled = false;
                            break;
                    }
                } else {
                    const errorAlert = document.getElementById('error-alert');
                    const errorMessage = document.getElementById('error-message');
                    if (errorAlert && errorMessage) {
                        errorMessage.textContent = result.message;
                        errorAlert.style.display = 'block';
                    } else {
                        alert(result.message);
                    }
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>Ingresar al Sistema';
                }
            } catch (err) {
                console.error(err);
                alert('Error al intentar iniciar sesión');
                submitBtn.disabled = false;
            }
        });
    }
});

// Auto-login for testing: set environment variable TEST_AUTO_LOGIN to 'recepcion', 'medico' or 'admin'
(function runAutoLogin() {
    try {
        const auto = process.env.TEST_AUTO_LOGIN;
        if (!auto) return;
        if (typeof ipcRenderer === 'undefined' || !ipcRenderer) { console.warn('ipcRenderer no disponible para auto-login'); return; }
        let creds;
        if (auto === 'recepcion') creds = { username: 'recepcion', password: 'recep123' };
        else if (auto === 'medico') creds = { username: 'medico', password: 'medico123' };
        else if (auto === 'admin') creds = { username: 'admin', password: 'admin123' };
        if (!creds) return;
        console.info('[Prueba] Auto-login:', auto);
        setTimeout(async () => { // delay increased to ensure main handlers registered before invoking tests
            try {
                const result = await ipcRenderer.invoke('login', creds);
                console.info('[Prueba] resultado login:', result);
                try { ipcRenderer.invoke('renderer-log', { type: 'auto-login', auto, result }); } catch (e) { console.warn('No se pudo enviar log al main', e); }
                if (result.success) {
                    sessionStorage.setItem('userRole', result.role);
                    sessionStorage.setItem('username', creds.username);
                    sessionStorage.setItem('userId', result.id_usuario);
                    switch (result.role) {
                        case 'Administrador': window.location.href = 'SuperAdmin.html'; break;
                        case 'Director': window.location.href = 'Menus_Director/director_dashboard.html'; break;
                        case 'Operador': window.location.href = 'Menus_Consulta/dashboard_cosn.html'; break;
                    }
                }
            } catch (err) { console.error('[Prueba] error auto-login', err); try { ipcRenderer.invoke('renderer-log', { type: 'auto-login-error', auto, error: (err && err.message) ? err.message : String(err) }); } catch (e) { /* ignore */ } }
        }, 1500);
    } catch (e) { console.warn('Auto login not available', e); }
})();
