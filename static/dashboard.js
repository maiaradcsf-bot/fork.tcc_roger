function requisitar() {
    Swal.fire({
        icon: 'success',
        title: 'Item requisitado!',
        text: 'O item foi solicitado com sucesso.'
    });
}

function remover() {
    Swal.fire({
        title: 'Remover item?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sim',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire('Removido!', 'Item removido do estoque', 'success');
        }
    });
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
}