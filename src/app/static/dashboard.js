// --- DADOS INICIAIS (Simulando um banco de dados) ---

const produtos = [
    {
        id: 'teclado',
        name: 'Teclado Mecânico',
        description: 'Teclado mecânico gamer com switches táteis, 104 teclas e iluminação RGB personalizável. Ideal para tarefas longas e uso em almoxarifados que precisam de rapidez e conforto.',
        price: 259.90,
        imageUrl: '/static/imagens/industria-4.0.png'
    },
    {
        id: 'mouse',
        name: 'Mouse Gamer',
        description: 'Mouse ergonômico com sensor óptico de alta precisão, iluminação LED e design confortável para uso prolongado.',
        price: 89.90,
        imageUrl: '/static/imagens/sesi-logo.png'
    },
    {
        id: 'teclado',
        name: 'Teclado Mecânico',
        description: 'Teclado mecânico gamer com switches táteis, 104 teclas e iluminação RGB personalizável. Ideal para tarefas longas e uso em almoxarifados que precisam de rapidez e conforto.',
        price: 259.90,
        imageUrl: '/static/imagens/industria-4.0.png'
    },


];

const itemsDisponiveis = produtos.map(produto => produto.name);

function formatarPreco(preco) {
    return `R$ ${preco.toFixed(2).replace('.', ',')}`;
}

function renderProducts() {
    const row = document.getElementById('product-row');
    if (!row) return;

    row.innerHTML = produtos.map(produto => {
        const name = produto.name.replace(/'/g, "\\'");
        const desc = produto.description.replace(/'/g, "\\'");
        const img = produto.imageUrl.replace(/'/g, "\\'");
        return `
        <div class="col-md-4 mb-3">
            <div class="card h-100">
                <img src="${produto.imageUrl}" class="card-img-top" alt="${produto.name}">
                <div class="card-body d-flex flex-column">
                    <h5 class="card-title">${produto.name}</h5>
                    <p class="card-text">${produto.description}</p>
                    <div class="d-flex align-items-center mb-3">
                        <span class="me-2">Quantidade:</span>
                        <button type="button" class="btn btn-sm btn-outline-secondary" onclick="alterarQuantidade('${produto.id}', -1)">-</button>
                        <span id="qty-${produto.id}" class="mx-2">1</span>
                        <button type="button" class="btn btn-sm btn-outline-secondary" onclick="alterarQuantidade('${produto.id}', 1)">+</button>
                        <span class="ms-3 fw-bold text-warning">${formatarPreco(produto.price)}</span>
                    </div>
                    <button type="button" class="btn btn-primary mt-auto" onclick="mostrarDetalhes('${name}', '${desc}', '${img}')">Mais informações</button>
                </div>
            </div>
        </div>
    `
    }).join('');
}

// Função de teste para pegar itens da api
async function getItens() {
    try {
        const response = await fetch('/api/products')
        if(!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        console.log(data)
    } catch(error) {
        console.error(`ERRO: `, error)
    }
}

getItens()

window.alterarQuantidade = function(id, delta) {
    const span = document.getElementById(`qty-${id}`)
    if (!span) return
    let quantidade = parseInt(span.textContent, 10) || 1
    quantidade = Math.max(1, quantidade + delta)
    span.textContent = quantidade
}

window.mostrarDetalhes = function(nome, descricao, imagemUrl) {
    Swal.fire({
        title: nome,
        html: `
            <div style="text-align: left;">
                <img src="${imagemUrl}" alt="${nome}" style="width: 100%; max-width: 320px; margin-bottom: 20px; border-radius: 8px;">
                <p style="text-align: justify;">${descricao}</p>
            </div>
        `,
        showCloseButton: true,
        confirmButtonText: 'Fechar',
        width: 500,
        customClass: {
            popup: 'swal2-border-radius'
        }
    })
}

function gerarIdUnico() {
    return `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

window.modalAdicionar = function() {
    const optionsHTML = `
        <div style="text-align: left;">
            <label style="display: block; margin-bottom: 10px; font-weight: bold;">Nome do produto:</label>
            <input id="swal-input-name" class="swal2-input" placeholder="Ex: Fone de Ouvido" autofocus>

            <label style="display: block; margin-bottom: 10px; font-weight: bold;">Descrição:</label>
            <textarea id="swal-input-description" class="swal2-textarea" placeholder="Descrição do produto" rows="3"></textarea>

            <label style="display: block; margin-bottom: 10px; font-weight: bold;">Preço:</label>
            <input id="swal-input-price" type="number" class="swal2-input" placeholder="Ex: 129.90" step="0.01" min="0.01">

            <label style="display: block; margin-bottom: 10px; font-weight: bold;">URL da imagem:</label>
            <input id="swal-input-image" class="swal2-input" placeholder="/static/imagens/novo-produto.png">
        </div>
    `;

    Swal.fire({
        title: 'Adicionar novo produto',
        html: optionsHTML,
        showCancelButton: true,
        confirmButtonText: 'Adicionar',
        cancelButtonText: 'Cancelar',
        focusConfirm: false,
        preConfirm: () => {
            const name = document.getElementById('swal-input-name').value.trim();
            const description = document.getElementById('swal-input-description').value.trim();
            const price = parseFloat(document.getElementById('swal-input-price').value.replace(',', '.'));
            const imageUrl = document.getElementById('swal-input-image').value.trim() || '/static/imagens/sesi-logo.png';

            if (!name) {
                Swal.showValidationMessage('Informe o nome do produto');
                return false;
            }
            if (!description) {
                Swal.showValidationMessage('Informe a descrição do produto');
                return false;
            }
            if (!price || price <= 0) {
                Swal.showValidationMessage('Informe um preço válido');
                return false;
            }
            return { name, description, price, imageUrl };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const novoProduto = {
                id: gerarIdUnico(),
                name: result.value.name,
                description: result.value.description,
                price: result.value.price,
                imageUrl: result.value.imageUrl
            };
            produtos.push(novoProduto);
            renderProducts();
            Swal.fire('Produto adicionado!', `${result.value.name} foi incluído com sucesso.`, 'success');
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

renderProducts();
