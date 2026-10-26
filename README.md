# Almoxarifado — Gestão de Estoque (TCC SESI/SENAI)

Aplicação Flask + MySQL com interface web (HTML/CSS/JS) e API REST em JSON para o app mobile.

## Subir o ambiente

```sh
cp .env.example .env      # ajuste as senhas
docker compose up -d --build
```

Um único comando: o MySQL fica saudável, a imagem da aplicação é construída (`Dockerfile`), o
container aplica as migrações pendentes, cria os dados iniciais (seed idempotente: não altera
usuários nem dados existentes) e inicia o servidor (gunicorn).

| Serviço | Endereço |
|---|---|
| Web e API (nginx) | `http://<host>/` e `http://<host>/api/...` |
| phpMyAdmin | `http://127.0.0.1:8080` (pede o login do MySQL; `PMA_BIND_ADDRESS` libera outro endereço) |

Conta inicial: usuário `admin`, senha `dev@123` (ou `ADMIN_PASSWORD` do `.env` na primeira subida).
Senhas são armazenadas com **bcrypt**; contas antigas (hash werkzeug) são convertidas no próximo login.

Variáveis do container `app`: `RUN_MIGRATIONS=0` e `RUN_SEED=0` pulam essas etapas na subida.

## Testes

```sh
docker exec <container-de-testes> python -m pytest tests -q      # SQLite em memória + MySQL tcc_test (concorrência)
cd src/tests/frontend && npm ci && cd - && node --test src/tests/frontend/
```

Os testes de concorrência usam somente o banco `tcc_test` e são ignorados quando ele não está acessível.

## API

Todas as rotas recebem e devolvem JSON (`Content-Type: application/json`). Rotas protegidas exigem
`Authorization: Bearer <token>` (obtido no login). Códigos usados: `200`/`201` sucesso, `400` dados
inválidos, `401` sem autenticação, `403` sem permissão, `404` inexistente, `409` conflito
(duplicidade, estoque insuficiente, concorrência), `413` arquivo grande demais.

### Autenticação

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/login` | Login unificado `{email, password}` → `{token, role}` |
| POST | `/api/admin/login` | Login administrativo `{username, password}` |
| POST | `/api/admin/logout` | Encerra a sessão do administrador |
| POST | `/api/client/register` | Cadastro `{name, email, password, phone?}` → `{token, id}` |
| POST | `/api/client/login` | Login do cliente `{email, password}` |
| POST | `/api/client/logout` | Encerra a sessão do cliente |

### Administração (requer token de administrador e a permissão indicada)

| Método | Rota | Descrição | Permissão |
|---|---|---|---|
| GET | `/api/admin/me` | Dados e permissões do usuário logado | — |
| GET / POST | `/api/admin/products` | Lista / cria produto `{name, price, barcode?, description?, category_ids?, min_stock?, max_stock?, photo_path?}` | `admin.products.list` / `.create` |
| GET / PUT / DELETE | `/api/admin/products/<id>` | Consulta / edita (só os campos enviados) / exclui (exclusão lógica) | `admin.products.list` / `.edit` / `.delete` |
| DELETE | `/api/admin/products/delete-all` | Exclui logicamente todos os produtos | `admin.products.delete` |
| POST | `/api/admin/upload` | Envia imagem (`multipart/form-data`, campo `file`, até 5 MB) | `admin.products.edit` |
| POST | `/api/admin/products/import/upload` · `/preview` · `/commit` | Importação de produtos por CSV | `admin.products.import` |
| DELETE | `/api/admin/products/import/<import_id>` | Descarta uma importação | `admin.products.import` |
| GET / POST | `/api/admin/categories` | Lista / cria categoria `{name, description?, parent_id?}` | `admin.categories.list` / `.create` |
| PUT / DELETE | `/api/admin/categories/<id>` | Edita / exclui | `admin.categories.edit` / `.delete` |
| GET / POST | `/api/admin/stock` | Lista saldos / cria o estoque de um produto `{product_id, quantity}` | `admin.stock.moves.list` / `.create` |
| DELETE | `/api/admin/stock` | Apaga todos os saldos e o histórico | `admin.stock.moves.delete` |
| GET / POST | `/api/admin/stock/moves` | Histórico (`?start_date&end_date&product_id`) / entrada ou saída `{stock_id\|product_id, quantity_change, reason?}` | `admin.stock.moves.list` / `.create` |
| POST | `/api/admin/stock/moves/<id>/revert` | Estorna uma movimentação manual | `admin.stock.moves.delete` |
| GET | `/api/admin/orders` · `/api/admin/orders/<id>` | Lista / detalha pedidos | `admin.orders.list` |
| PATCH | `/api/admin/orders/<id>/status` | `{action: approve\|reject\|finish\|cancel, allow_partial?}` | `admin.orders.approve` / `.reject` / `.cancel` |
| GET | `/api/admin/clients` · `/clients/summary` · `/clients/<id>/details` | Clientes e seus pedidos | `admin.clients.list` / `.view` |
| PATCH | `/api/admin/clients/<id>/status` | `{active: true\|false}` | `admin.clients.edit` |
| GET / POST | `/api/admin/users` | Lista / cria usuário `{username, email, password, rule_ids?}` | `admin.settings.users.manage` |
| PUT / DELETE | `/api/admin/users/<id>` | Edita / exclui | `admin.settings.users.manage` |
| GET / POST | `/api/admin/rules` | Perfis `{name, description?, permission_ids?}` | `admin.settings.profiles.manage` |
| PUT / DELETE | `/api/admin/rules/<id>` | Edita / exclui perfil | `admin.settings.profiles.manage` |
| GET / POST | `/api/admin/permissions` | Permissões `{name, description?}` | `admin.settings.permissions.manage` |
| PUT / DELETE | `/api/admin/permissions/<id>` | Edita / exclui (as do sistema não podem ser renomeadas nem excluídas) | `admin.settings.permissions.manage` |

Regras de autorização: ninguém concede (a usuários ou perfis) permissões do sistema que não possui,
nem altera ou exclui contas e perfis com mais permissões que as suas; ninguém exclui a própria conta.

### Cliente (requer token de cliente)

| Método | Rota | Descrição | Permissão |
|---|---|---|---|
| GET | `/api/client/me` | Dados e permissões do cliente | — |
| GET / PUT | `/api/client/profile` | Perfil / atualização (trocar senha exige `current_password`) | `clients.profile.view` / `.edit` |
| POST | `/api/client/upload` | Foto de perfil (`multipart/form-data`) | `clients.profile.edit` |
| GET | `/api/client/products` · `/api/client/products/<id>` | Lista / consulta produtos | `clients.products.list` / `.view` |
| GET / POST | `/api/client/carts` | Carrinhos / cria carrinho | `clients.cart.manage` |
| POST | `/api/client/carts/<id>/items` | Adiciona item `{product_id, quantity}` | `clients.cart.manage` |
| PUT / DELETE | `/api/client/carts/<id>/items/<item_id>` | Altera quantidade / remove item | `clients.cart.manage` |
| POST | `/api/client/carts/<id>/checkout` | Gera o pedido `{reason?}` | `clients.cart.manage` |
| GET / POST | `/api/client/orders` | Lista / cria pedido `{items: [{product_id, quantity}]}` | `clients.orders.list` / `clients.products.request` |
| GET | `/api/client/orders/<id>` | Detalhe do próprio pedido | `clients.orders.view` |
| PATCH | `/api/client/orders/<id>/status` | `{action: cancel}` (somente pedido pendente) | `clients.orders.cancel` |
| GET | `/api/client/summary` | Resumo dos pedidos | `clients.orders.list` |

A coleção `postman_collection.json` traz exemplos das principais rotas.
