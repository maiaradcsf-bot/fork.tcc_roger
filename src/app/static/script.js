function verificar_login() {
    const user = document.getElementById("usuario").value.trim();
    const password = document.getElementById("password").value;

    const usuarios = JSON.parse(localStorage.getItem('usuarios')) || [];
    const usuarioEncontrado = usuarios.find(u => u.nome === user && u.senha === password);
    const isHardcodedAdmin = user === 'admin' && password === 'admin';

    if (!usuarioEncontrado && !isHardcodedAdmin) {
        Swal.fire({
            icon: 'error',
            title: 'Ops...',
            text: 'Login ou senha incorretos!',
        });
        return;
    }

    // Determina se é administrador
    const ehAdministrador = isHardcodedAdmin || (usuarioEncontrado && usuarioEncontrado.administrador);

    // Redireciona para página correta
    if (ehAdministrador) {
        window.location.href = "./dashboard";
    } else {
        window.location.href = "./clientes";
    }
}

window.criarUsuario = async function() {
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

    // Se o usuário é administrado
    if (administrador) {
        const { value: resposta } = await Swal.fire({
            title: "Validação de Administrador",
            text: "Selecione a opção correta para criar uma conta de administrador",
            input: "select",
            inputOptions: {
                "": "-- Selecione uma opção --",
                opcao1: "Macarrao com batata",
                opcao2: "Globgobgaleb",
                opcao3: "Pudim de chuchu",
                opcao4: "Pantera voadora"
            },
            inputPlaceholder: "Selecione a função de administrador",
            showCancelButton: true,
            inputValidator: (value) => {
                return new Promise((resolve) => {
                    if (value === "opcao2") {
                        resolve();
                    } else if (value === "") {
                        resolve("Você precisa selecionar uma opção");
                    } else {
                        resolve("Opção incorreta! Selecione a função correta do administrador");
                    }
                });
            }
        });

        // Se o usuário errou
        if (!resposta) {
            return;
        }
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
