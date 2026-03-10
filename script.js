function verificar_login() {

    let usuario_correto = "admin";
    let senha_correta = "admin";

    let user = document.getElementById("Login").value;
    let password = document.getElementById("password").value;

    console.log(user);
    console.log(password);

    if(user == usuario_correto && password == senha_correta) {
        window.location.href = "dashboard.html";
    }else{
        alert("Login ou senha incorretos!");
    }
}
