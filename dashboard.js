// --- DASHBOARD.JS ---
// Integração com o sistema de estoque existente

// Constantes de limite de estoque baixo
const LOW_STOCK_LIMIT = 10;
const MEDIUM_STOCK_LIMIT = 20;

// Carregar dados do localStorage (mesma fonte do sistema de estoque)
let inventory = [];

function loadData() {
    const savedInventory = localStorage.getItem('inventory');
    
    if (savedInventory) {
        inventory = JSON.parse(savedInventory);
    }
}

// Função para determinar o status do item
function getStockStatus(qty) {
    if (qty < LOW_STOCK_LIMIT) {
        return '<span class="badge badge-low">Baixo</span>';
    } else if (qty < MEDIUM_STOCK_LIMIT) {
        return '<span class="badge badge-medium">Médio</span>';
    } else {
        return '<span class="badge badge-ok">OK</span>';
    }
}

// Renderizar tabela de inventory
function renderInventoryTable() {
    const tbody = document.getElementById('inventory-table');
    
    if (inventory.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhum item em estoque.</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    
    inventory.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.id}</td>
            <td><strong>${item.name}</strong></td>
            <td>${item.qty}</td>
            <td>${item.requester}</td>
            <td>${getStockStatus(item.qty)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Inicializar dashboard
function initDashboard() {
    loadData();
    renderInventoryTable();
}

// Atualizar dados periodicamente (a cada 5 segundos)
setInterval(() => {
    loadData();
    renderInventoryTable();
}, 5000);

// Executar ao carregar a página
document.addEventListener('DOMContentLoaded', initDashboard);

