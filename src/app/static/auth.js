const LOGIN_API_URL = '/api/login';
const REGISTER_API_URL = '/api/client/register';
const authAlertContainer = document.getElementById('alertContainer');

function showAuthAlert(type, message) {
  if (!authAlertContainer) return;

  const alertElement = document.createElement('div');
  alertElement.className = `alert alert-${type} alert-dismissible fade show`;
  alertElement.role = 'alert';
  alertElement.innerHTML = `
    <div>${message}</div>
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;

  authAlertContainer.innerHTML = '';
  authAlertContainer.appendChild(alertElement);
}

function setButtonLoading(button, loading, text) {
  if (!button) return;
  if (loading) {
    button.disabled = true;
    button.dataset.originalText = button.innerHTML;
    button.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>${text}`;
  } else {
    button.disabled = false;
    if (button.dataset.originalText) {
      button.innerHTML = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  }
}

async function login(event) {
  event.preventDefault();
  const email = document.getElementById('email')?.value.trim();
  const password = document.getElementById('password')?.value.trim();
  const loginButton = document.getElementById('loginButton');

  if (!email || !password) {
    showAuthAlert('warning', 'Preencha e-mail e senha antes de continuar.');
    return;
  }

  setButtonLoading(loginButton, true, 'Entrando...');

  try {
    const response = await fetch(LOGIN_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || `Erro ${response.status} ao efetuar login.`);
    }

    const data = await response.json();
    // Data may include role: 'client' or 'admin'
    if (data.role === 'client') {
      localStorage.setItem('client_token', data.token);
      window.location.href = '/client/dashboard';
      return;
    }
    if (data.role === 'admin') {
      localStorage.setItem('admin_token', data.token);
      window.location.href = '/dashboard';
      return;
    }
    // Fallback: if only token present, assume admin
    if (data.token) {
      localStorage.setItem('admin_token', data.token);
      window.location.href = '/dashboard';
      return;
    }
  } catch (error) {
    showAuthAlert('danger', `Falha no login: ${error.message}`);
  } finally {
    setButtonLoading(loginButton, false);
  }
}

async function registerUser(event) {
  event.preventDefault();
  const name = document.getElementById('name')?.value.trim();
  const email = document.getElementById('email')?.value.trim();
  const phone = document.getElementById('phone')?.value.trim();
  const password = document.getElementById('password')?.value.trim();
  const registerButton = document.getElementById('registerButton');

  if (!name || !email || !password) {
    showAuthAlert('warning', 'Preencha nome, e-mail e senha para se cadastrar.');
    return;
  }

  setButtonLoading(registerButton, true, 'Cadastrando...');

  try {
    const response = await fetch(REGISTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ name, email, phone, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || `Erro ${response.status} ao cadastrar.`);
    }

    const data = await response.json().catch(() => null);
    if (data && data.token) {
      // Armazena token do cliente e redireciona para o dashboard do cliente
      localStorage.setItem('client_token', data.token);
      window.location.href = '/client/dashboard';
      return;
    }

    showAuthAlert('success', 'Cadastro realizado com sucesso. Agora faça login.');
    document.getElementById('registerForm').reset();
  } catch (error) {
    showAuthAlert('danger', `Falha no cadastro: ${error.message}`);
  } finally {
    setButtonLoading(registerButton, false);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const adminToken = localStorage.getItem('admin_token');
  const clientToken = localStorage.getItem('client_token');

  if (adminToken && window.location.pathname === '/') {
    window.location.href = '/dashboard';
    return;
  }
  if (clientToken && window.location.pathname === '/') {
    window.location.href = '/client/dashboard';
    return;
  }

  if (loginForm) {
    loginForm.addEventListener('submit', login);
  }

  if (registerForm) {
    registerForm.addEventListener('submit', registerUser);
  }
});
