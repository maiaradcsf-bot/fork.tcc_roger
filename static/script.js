function verificar_login() {

    let usuario_correto = "admin";
    let senha_correta = "admin";

    let user = document.getElementById("usuario").value;
    let password = document.getElementById("password").value;

    console.log(user);
    console.log(password);

    if(user == usuario_correto && password == senha_correta) {
        window.location.href = "./dashboard";
    }else{
        Swal.fire({
            icon: 'error',
            title: 'Ops...',
            text: 'Login ou senha incorretos!',
        });
    }
}
