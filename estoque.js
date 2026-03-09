// --- DADOS INICIAIS (Simulando um banco de dados) ---
// Alterado: Removido 'price' e adicionado 'requester'
let inventory = [
    { id: 1, name: 'Teclado Mecânico', qty: 15, requester: 'João Silva' },
    { id: 2, name: 'Mouse Gamer', qty: 30, requester: 'Maria Souza' },
    { id: 3, name: 'Monitor 24pol', qty: 8, requester: 'Pedro Santos' },
    { id: 4, name: 'Cadeira Ergonômica', qty: 5, requester: 'Ana Costa' },
    { id: 5, name: 'Headset USB', qty: 22, requester: 'Carlos Oliveira' },
    { id: 6, name: 'Webcam HD', qty: 12, requester: 'Julia Lima' },
    { id: 7, name: 'SSD 480GB', qty: 40, requester: 'Marcos Pereira' },
    { id: 8, name: 'Memória RAM 8GB', qty: 50, requester: 'Fernanda Alves' }
];

// Array para armazenar as requisições feitas
let requestedItems = [];

// Carregar dados do localStorage ao iniciar
function loadFromStorage() {
    const savedInventory = localStorage.getItem('inventory');
    const savedRequests = localStorage.getItem('requestedItems');
    
    if (savedInventory) {
        inventory = JSON.parse(savedInventory);
    }
    if (savedRequests) {
        requestedItems = JSON.parse(savedRequests);
    }
}

// Salvar dados no localStorage
function saveToStorage() {
    localStorage.setItem('inventory', JSON.stringify(inventory));
    localStorage.setItem('requestedItems', JSON.stringify(requestedItems));
}

// Chamar ao iniciar
loadFromStorage();

let currentPage = 1;
const itemsPerPage = 5; // Quantos itens mostrar por página
let itemToDeleteId = null; // Armazena o ID do item que será deletado
let itemToRequestId = null; // Armazena o ID do item que será requisitado

// --- FUNÇÕES DE RENDERIZAÇÃO ---
function renderTable() {
    const tbody = document.getElementById('inventory-body');
    tbody.innerHTML = ''; // Limpa a tabela

    // Lógica de Paginação
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = inventory.slice(startIndex, endIndex);

    // Atualiza indicador de página
    document.getElementById('page-indicator').innerText = `Página ${currentPage} de ${Math.ceil(inventory.length / itemsPerPage)}`;

    if (pageItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhum item encontrado.</td></tr>';
        return;
    }

    pageItems.forEach(item => {
        const row = `
            <tr>
                <td>${item.id}</td>
                <td>${item.name}</td>
                <td>${item.qty}</td>
                <td>${item.requester}</td> <!-- Alterado para mostrar requisitante -->
                <td>
                    <button class="btn btn-edit" onclick="openEditModal(${item.id})">Editar</button>
                    <button class="btn btn-request" onclick="openRequestModal(${item.id})">Requisitar</button> <!-- Botão Novo -->
                    <button class="btn btn-delete" onclick="openDeleteModal(${item.id})">Remover</button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// --- FUNÇÕES DE NAVEGAÇÃO (PAGINAÇÃO) ---
function changePage(direction) {
    const totalPages = Math.ceil(inventory.length / itemsPerPage);
    const newPage = currentPage + direction;

    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderTable();
    }
}

// --- FUNÇÕES DO MODAL (ADICIONAR/EDITAR) ---
function openAddModal() {
    document.getElementById('modalTitle').innerText = "Adicionar Novo Item";
    document.getElementById('itemForm').reset();
    document.getElementById('itemId').value = ''; // Limpa ID para indicar "Novo"
    document.getElementById('itemModal').style.display = 'flex';
}

function openEditModal(id) {
    const item = inventory.find(i => i.id === id);
    if (item) {
        document.getElementById('modalTitle').innerText = "Editar Item";
        document.getElementById('itemId').value = item.id;
        document.getElementById('itemName').value = item.name;
        document.getElementById('itemQty').value = item.qty;
        document.getElementById('itemRequester').value = item.requester; // Alterado
        document.getElementById('itemModal').style.display = 'flex';
    }
}

function saveItem(event) {
    event.preventDefault(); // Impede o recarregamento da página

    const id = document.getElementById('itemId').value;
    const name = document.getElementById('itemName').value;
    const qty = parseInt(document.getElementById('itemQty').value);
    const requester = document.getElementById('itemRequester').value; // Alterado

    if (id) {
        // EDITAR: Atualiza item existente
        const index = inventory.findIndex(i => i.id == id);
        if (index !== -1) {
            inventory[index] = { id: parseInt(id), name, qty, requester };
        }
    } else {
        // ADICIONAR: Cria novo item
        const newId = inventory.length > 0 ? Math.max(...inventory.map(i => i.id)) + 1 : 1;
        inventory.push({ id: newId, name, qty, requester });
    }

    // Salvar no localStorage
    saveToStorage();
    
    closeModal('itemModal');
    renderTable();
}

// --- FUNÇÕES DO MODAL (EXCLUSÃO) ---
function openDeleteModal(id) {
    itemToDeleteId = id;
    document.getElementById('deleteModal').style.display = 'flex';
}

function confirmDelete() {
    if (itemToDeleteId) {
        inventory = inventory.filter(item => item.id !== itemToDeleteId);
        
        // Salvar no localStorage
        saveToStorage();
        
        closeModal('deleteModal');
        renderTable();
        
        // Se deletarmos o último item da página, voltamos para a anterior
        const totalPages = Math.ceil(inventory.length / itemsPerPage);
        if (currentPage > totalPages && totalPages > 0) {
            currentPage = totalPages;
            renderTable();
        }
    }
}

// --- FUNÇÕES DO MODAL (REQUISITAÇÃO) ---
function openRequestModal(id) {
    itemToRequestId = id;
    document.getElementById('requestModal').style.display = 'flex';
}

function confirmRequest() {
    if (itemToRequestId) {
        // Encontrar o item antes de remover
        const item = inventory.find(i => i.id === itemToRequestId);
        
        if (item) {
            // Adicionar data da requisição
            const requestData = {
                ...item,
                requestDate: new Date().toLocaleString('pt-BR')
            };
            
            // Adicionar ao histórico de requisições
            requestedItems.push(requestData);
            
            // Salvar no localStorage
            saveToStorage();
        }
        
        // Remove o item da lista (simulando que foi enviado para o requisitante)
        inventory = inventory.filter(item => item.id !== itemToRequestId);
        
        // Salvar no localStorage
        saveToStorage();
        
        closeModal('requestModal');
        renderTable();
        
        // Se deletarmos o último item da página, voltamos para a anterior
        const totalPages = Math.ceil(inventory.length / itemsPerPage);
        if (currentPage > totalPages && totalPages > 0) {
            currentPage = totalPages;
            renderTable();
        }
    }
}

// --- UTILITÁRIOS ---
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Fechar modal se clicar fora da caixa branca
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = "none";
    }
}

// Inicializar a tabela ao carregar
renderTable();