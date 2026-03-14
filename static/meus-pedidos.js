let requestedItems = [];

        function loadHistory() {
            const savedRequests = localStorage.getItem('requestedItems');
            if (savedRequests) {
                requestedItems = JSON.parse(savedRequests);
            }
            renderHistory();
        }

        function renderHistory() {
            const tbody = document.getElementById('history-body');
            const emptyMessage = document.getElementById('empty-message');
            
            tbody.innerHTML = '';

            if (requestedItems.length === 0) {
                emptyMessage.style.display = 'block';
                return;
            }

            emptyMessage.style.display = 'none';

            requestedItems.forEach(item => {
                const row = `
                    <tr>
                        <td>${item.id}</td>
                        <td>${item.name}</td>
                        <td>${item.qty}</td>
                        <td>${item.email}</td>
                        <td>${item.requestDate || 'Data não disponível'}</td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });
        }

        function clearHistory() {
            if (confirm('Tem certeza que deseja limpar todo o histórico de requisições?')) {
                requestedItems = [];
                localStorage.setItem('requestedItems', JSON.stringify(requestedItems));
                renderHistory();
                Swal.fire('Limpado!', 'O histórico foi removido.', 'success');
            }
        }

        // Carregar ao iniciar
        loadHistory();