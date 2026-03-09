function verificar_login() {

    let user_trufh = "admin";
    let password_trufh = "admin";

    let user = document.getElementById("Login").value;
    let password = document.getElementById("password").value;

    console.log(user);
    console.log(password);

    if(user == user_trufh && password == password_trufh) {
        window.location.href = "dashboard.html";
    }else{
        alert("alguma coisa está errada!!");
    }
}
