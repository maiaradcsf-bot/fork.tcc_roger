// --- DADOS INICIAIS (Simulando um banco de dados) ---

// Lista de items disponíveis na tabela
const itemsDisponiveis = [
    'Teclado Mecânico',
    'Mouse Gamer',
    'Monitor 24pol',
    'Headset USB',
    'Webcam Full HD'
];

// Função para gerar ID único
function gerarIdUnico() {
    return Math.floor(Math.random() * 10000) + 1;
}

// Garantir que as funções fiquem globais para o 'onclick' do HTML encontrar
window.modalAdicionar = function(nomeItem) {
    const optionsHTML = `
        <div style="text-align: left;">
            <label style="display: block; margin-bottom: 10px; font-weight: bold;">Selecione o Produto:</label>
            <select id="swal-select-product" style="width: 100%; padding: 8px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 4px;">
                <option value="">Escolha um produto...</option>
                ${itemsDisponiveis.map(i => `<option value="${i}">${i}</option>`).join('')}
            </select>
            
            <label style="display: block; margin-bottom: 10px; font-weight: bold;">Quantidade:</label>
            <input type="number" id="swal-input-qty" style="width: 100%; padding: 8px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 4px;" placeholder="Ex: 5" min="1" max="1000">
            
            <label style="display: block; margin-bottom: 10px; font-weight: bold;">Email:</label>
            <input type="email" id="swal-input-email" style="width: 100%; padding: 8px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 4px;" placeholder="seu.email@exemplo.com">
        </div>
    `;

    Swal.fire({
        title: 'Adicionar Item ao Pedido',
        html: optionsHTML,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#007bff',
        confirmButtonText: 'Confirmar Pedido',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            const product = document.getElementById('swal-select-product').value;
            const qty = document.getElementById('swal-input-qty').value;
            const email = document.getElementById('swal-input-email').value;

            if (!product) {
                Swal.showValidationMessage('Selecione um produto');
                return false;
            }
            if (!qty || qty < 1) {
                Swal.showValidationMessage('Quantidade deve ser no mínimo 1');
                return false;
            }
            if (!email || !email.includes('@')) {
                Swal.showValidationMessage('Email inválido');
                return false;
            }
            return { product, qty, email };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            // Salvar no localStorage
            let pedidos = JSON.parse(localStorage.getItem('requestedItems')) || [];
            
            const pedido = {
                id: gerarIdUnico(),
                name: result.value.product,
                qty: result.value.qty,
                email: result.value.email,
                requestDate: new Date().toLocaleString('pt-BR')
            };
            
            pedidos.push(pedido);
            localStorage.setItem('requestedItems', JSON.stringify(pedidos));
            
            Swal.fire('Sucesso!', `Pedido de ${result.value.qty}x ${result.value.product} foi adicionado ao histórico.`, 'success');
        }
    });
};

// Função EDITAR
window.btnEditar = function(item) {
    Swal.fire({
        title: 'Editar Item',
        input: 'text',
        inputLabel: `Altere o nome ou descrição de: ${item}`,
        inputValue: item,
        inputAttributes: {
            maxlength: 100
        },
        showCancelButton: true,
        confirmButtonText: 'Salvar Alterações',
        inputValidator: (value) => {
            if (!value) return 'Você precisa escrever algo!'
            if (value.length > 100) return 'Máximo 100 caracteres permitidos'
        }
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire('Atualizado!', `O item foi alterado para: ${result.value}`, 'success');
        }
    });
};

// Função REQUISITAR
window.btnRequisitar = function(item) {
    const optionsHTML = `
        <div style="text-align: left;">
            <label style="display: block; margin-bottom: 10px; font-weight: bold;">Selecione o item a requisitar:</label>
            <select id="swal-select-item" style="width: 100%; padding: 8px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 4px;">
                <option value="">Escolha um item...</option>
                ${itemsDisponiveis.map(i => `<option value="${i}" ${i === item ? 'selected' : ''}>${i}</option>`).join('')}
            </select>
            <label style="display: block; margin-bottom: 10px; font-weight: bold;">Quantidade:</label>
            <input type="number" id="swal-input-qtd" style="width: 100%; padding: 8px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 4px;" placeholder="Ex: 5" min="1">
            <label style="display: block; margin-bottom: 10px; font-weight: bold;">Motivo/Observação (máx. 100 caracteres):</label>
            <textarea id="swal-input-obs" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical; max-height: 100px;" placeholder="Digite o motivo da requisição" maxlength="100"></textarea>
            <small style="display: block; margin-top: 5px; color: #666;" id="char-count">0/100</small>
        </div>
    `;

    Swal.fire({
        title: 'Requisitar Item',
        html: optionsHTML,
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Enviar Solicitação',
        didOpen: () => {
            const textarea = document.getElementById('swal-input-obs');
            const charCount = document.getElementById('char-count');
            textarea.addEventListener('input', () => {
                charCount.textContent = `${textarea.value.length}/100`;
            });
        },
        preConfirm: () => {
            const selectedItem = document.getElementById('swal-select-item').value;
            const qtd = document.getElementById('swal-input-qtd').value;
            const obs = document.getElementById('swal-input-obs').value;

            if (!selectedItem) {
                Swal.showValidationMessage('Selecione um item');
                return false;
            }
            if (!qtd || qtd < 1) {
                Swal.showValidationMessage('Quantidade deve ser no mínimo 1');
                return false;
            }
            return { item: selectedItem, quantidade: qtd, observacao: obs };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire('Enviado!', `Requisição de ${result.value.quantidade} ${result.value.item}(s) foi recebida!`, 'success');
        }
    });
};

// Função REMOVER
window.btnRemover = function(item) {
    Swal.fire({
        title: 'Tem certeza?',
        text: `Por que deseja excluir "${item}"?`,
        input: 'text',
        inputPlaceholder: 'Motivo da exclusão (máx. 100 caracteres)',
        inputAttributes: {
            maxlength: 100
        },
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sim, excluir!',
        cancelButtonText: 'Cancelar',
        inputValidator: (value) => {
            if (value.length > 100) return 'Máximo 100 caracteres permitidos'
        }
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire('Removido!', 'O item foi excluído com sucesso.', 'success');
        }
    });
};

// Manter compatibilidade com o dashboard.js
window.modalRequisitar = function(nomeItem) {
    window.btnRequisitar(nomeItem);
};

// Função EDITAR
window.btnEditar = function(item) {
    Swal.fire({
        title: 'Editar Item',
        input: 'text',
        inputLabel: `Altere o nome ou descrição de: ${item}`,
        inputValue: item,
        inputAttributes: {
            maxlength: 100
        },
        showCancelButton: true,
        confirmButtonText: 'Salvar Alterações',
        inputValidator: (value) => {
            if (!value) return 'Você precisa escrever algo!'
            if (value.length > 100) return 'Máximo 100 caracteres permitidos'
        }
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire('Atualizado!', `O item foi alterado para: ${result.value}`, 'success');
        }
    });
};

// Função REQUISITAR
window.btnRequisitar = function(item) {
    const optionsHTML = `
        <div style="text-align: left;">
            <label style="display: block; margin-bottom: 10px; font-weight: bold;">Selecione o item a requisitar:</label>
            <select id="swal-select-item" style="width: 100%; padding: 8px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 4px;">
                <option value="">Escolha um item...</option>
                ${itemsDisponiveis.map(i => `<option value="${i}" ${i === item ? 'selected' : ''}>${i}</option>`).join('')}
            </select>
            <label style="display: block; margin-bottom: 10px; font-weight: bold;">Quantidade:</label>
            <input type="number" id="swal-input-qtd" style="width: 100%; padding: 8px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 4px;" placeholder="Ex: 5" min="1">
            <label style="display: block; margin-bottom: 10px; font-weight: bold;">Motivo/Observação (máx. 100 caracteres):</label>
            <textarea id="swal-input-obs" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical; max-height: 100px;" placeholder="Digite o motivo da requisição" maxlength="100"></textarea>
            <small style="display: block; margin-top: 5px; color: #666;" id="char-count">0/100</small>
        </div>
    `;

    Swal.fire({
        title: 'Requisitar Item',
        html: optionsHTML,
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Enviar Solicitação',
        didOpen: () => {
            const textarea = document.getElementById('swal-input-obs');
            const charCount = document.getElementById('char-count');
            textarea.addEventListener('input', () => {
                charCount.textContent = `${textarea.value.length}/100`;
            });
        },
        preConfirm: () => {
            const selectedItem = document.getElementById('swal-select-item').value;
            const qtd = document.getElementById('swal-input-qtd').value;
            const obs = document.getElementById('swal-input-obs').value;

            if (!selectedItem) {
                Swal.showValidationMessage('Selecione um item');
                return false;
            }
            if (!qtd || qtd < 1) {
                Swal.showValidationMessage('Quantidade deve ser no mínimo 1');
                return false;
            }
            return { item: selectedItem, quantidade: qtd, observacao: obs };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire('Enviado!', `Requisição de ${result.value.quantidade} ${result.value.item}(s) foi recebida!`, 'success');
        }
    });
};

// Função REMOVER
window.btnRemover = function(item) {
    Swal.fire({
        title: 'Tem certeza?',
        text: `Por que deseja excluir "${item}"?`,
        input: 'text',
        inputPlaceholder: 'Motivo da exclusão (máx. 100 caracteres)',
        inputAttributes: {
            maxlength: 100
        },
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sim, excluir!',
        cancelButtonText: 'Cancelar',
        inputValidator: (value) => {
            if (value.length > 100) return 'Máximo 100 caracteres permitidos'
        }
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire('Removido!', 'O item foi excluído com sucesso.', 'success');
        }
    });
};

// Manter compatibilidade com o dashboard.js
window.modalRequisitar = function(nomeItem) {
    window.btnRequisitar(nomeItem);
};