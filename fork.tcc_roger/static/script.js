function verificar_login() {
    const user = document.getElementById("usuario").value.trim();
    const password = document.getElementById("password").value;

    const usuarios = JSON.parse(localStorage.getItem('usuarios')) || [];
    const usuarioEncontrado = usuarios.find(u => u.nome === user && u.senha === password);

    if (usuarioEncontrado || (user === 'admin' && password === 'admin')) {
        window.location.href = "./dashboard";
    } else {
        Swal.fire({
            icon: 'error',
            title: 'Ops...',
            text: 'Login ou senha incorretos!',
        });
    }
}

window.criarUsuario = function() {
    const nome = document.getElementById('new-usuario').value.trim();
    const senha = document.getElementById('new-password').value;
    const administrador = document.getElementById('is-admin').checked;

    if (!nome || !senha) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Preencha nome e senha para criar o usuário.',
        });
        return;
    }

    const usuarios = JSON.parse(localStorage.getItem('usuarios')) || [];
    usuarios.push({
        nome,
        senha,
        administrador,
        criadoEm: new Date().toLocaleString('pt-BR')
    });
    localStorage.setItem('usuarios', JSON.stringify(usuarios));

    Swal.fire({
        icon: 'success',
        title: 'Usuário criado',
        text: `Usuário ${nome} criado com sucesso.${administrador ? ' Ele é administrador.' : ''}`,
    });

    document.getElementById('register-form').reset();
}
