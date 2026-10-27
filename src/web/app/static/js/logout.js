function logout() {
    // Limpa dados de login (se houver)
    localStorage.clear();
    sessionStorage.clear();
    // Redireciona para a página inicial
    window.location.href = "/";
}