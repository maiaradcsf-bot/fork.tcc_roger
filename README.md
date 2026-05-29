# TCC - Projeto SESI

Sistema de gerenciamento de pedidos desenvolvido em Flask com MySQL, utilizando Docker para containerização.

## 📋 Estrutura do Projeto

```
.
├── .docker/                 # Configurações do Docker
│   ├── nginx.conf          # Configuração do proxy Nginx
│   ├── requirements.txt    # Dependências Python
│   └── mysql/              # Dados persistentes do MySQL
├── src/                    # Código-fonte da aplicação
│   ├── app.py             # Aplicação principal
│   ├── config.py          # Configurações
│   ├── migrations/        # Migrations do Alembic
│   ├── static/            # Arquivos estáticos (CSS, JS, imagens)
│   └── templates/         # Templates HTML
├── docker-compose.yml     # Definição dos serviços Docker
├── .env.example          # Exemplo de variáveis de ambiente
├── .gitignore            # Arquivo de exclusão do Git
└── README.md             # Este arquivo
```

## 🚀 Como Rodar o Projeto

### Pré-requisitos
- Docker e Docker Compose instalados
- Git

### Passos Iniciais

#### 1. Clonar o Repositório
```bash
git clone <seu-repositorio>
cd sesi
```

#### 2. Configurar Variáveis de Ambiente
Copie o arquivo `.env.example` para `.env`:
```bash
cp .env.example .env
```

> ⚠️ **Importante:** Alerar as senhas no arquivo .env onde esta *****, nunca mudar no aruivo .env.example, somente adicionar novas variaveis se necessarias!

> ⚠️ **Importante:** O arquivo `.env` contém variáveis sensíveis (senhas). Nunca commit este arquivo no Git!

#### 3. Construir e Iniciar os Containers
```bash
docker-compose up --build
```

A primeira execução vai:
- Construir a imagem da aplicação Flask
- Criar os containers (MySQL, Flask App, Nginx, phpMyAdmin)
- Criar a rede `network_tcc`
- Criar o volume para persistência dos dados do MySQL

#### 4. Rodar as Migrations do Banco de Dados (Primeira Instalação)

Em um novo terminal, execute:
```bash
docker-compose exec app flask db upgrade
```

Isso vai criar todas as tabelas no banco de dados de acordo com os arquivos em `src/migrations/versions/`.

## 🌐 Acessando a Aplicação

| Serviço | URL | Descrição |
|---------|-----|-----------|
| **Aplicação** | http://localhost | App Flask via proxy Nginx (porta 80) |
| **phpMyAdmin** | http://localhost:8080 | Gerenciador MySQL |
| **MySQL** | localhost:3306 | Banco de dados (apenas interno) |

### Credenciais de exemplo

```
Usuário: developer
Senha: developer
Banco: tcc_20226_sesi_t3d
Root Password: root
```

> ⚠️ **Segurança:** Altere as senhas no arquivo `.env` em ambiente local e principalmente de produção!

## 🛠️ Comandos Úteis

### Parar os Containers
```bash
docker-compose down
```

### Ver Logs da Aplicação
```bash
docker-compose logs app -f
```

### Acessar o Shell do Container
```bash
docker-compose exec app bash
```

### Rodar as Migrations
```bash
docker-compose exec app flask db upgrade
```

### Criar uma Nova Migration
```bash
docker-compose exec app flask db migrate -m "descrição da mudança"
```

### Reverter a Última Migration
```bash
docker-compose exec app flask db downgrade
```

## 📦 Serviços Docker

### 1. **MySQL 8.0**
- Banco de dados relacional
- Porta interna: 3306
- Volume persistente: `.docker/mysql/`
- Rede: `network_tcc`

### 2. **Flask App**
- Aplicação Python com Flask
- Porta interna: 5000 (exposta via proxy)
- Debug: ativado em desenvolvimento
- Rede: `network_tcc`

### 3. **Nginx (Proxy)**
- Proxy reverso
- Porta exposta: 80 (localhost)
- Redireciona para Flask App na porta 5000
- Rede: `network_tcc`

### 4. **phpMyAdmin**
- Interface web para MySQL
- Porta exposta: 8080
- Acesso: http://localhost:8080
- Rede: `network_tcc`

## 🔧 Variáveis de Ambiente

O arquivo `.env` contém as seguintes variáveis:

```env
# Flask Configuration
FLASK_APP=app.py
FLASK_ENV=development
DEBUG=True

# Python Configuration
PYTHONUNBUFFERED=1
PYTHONDONTWRITEBYTECODE=1

# Database Configuration
DB_HOST=mysql
DB_PORT=3306
DB_USER=developer
DB_PASSWORD=developer
DB_NAME=tcc_20226_sesi_t3d

# MySQL Root Password
MYSQL_ROOT_PASSWORD=@12Sesi4#215

# PHPMyAdmin Configuration
PMA_HOST=mysql
PMA_USER=developer
PMA_PASSWORD=developer
```

## 📝 Desenvolvimento

### Estrutura de Migrations

As migrations do banco de dados estão em `src/migrations/versions/`. Para criar uma nova migration:

1. Faça as alterações no modelo em `src/app.py`
2. Execute:
   ```bash
   docker-compose exec app flask db migrate -m "descrição"
   ```
3. Revise o arquivo gerado em `src/migrations/versions/`
4. Execute a migration:
   ```bash
   docker-compose exec app flask db upgrade
   ```

### Hot Reload

A aplicação está configurada com debug ativado, permitindo:
- Recarga automática do código quando você faz alterações
- Debugger interativo em caso de erro
- Output em tempo real dos logs

## 🚨 Troubleshooting

### "Connection refused" ao acessar a aplicação
- Certifique-se de que os containers estão rodando: `docker-compose ps`
- Verifique os logs: `docker-compose logs app`

### MySQL não conecta
- Aguarde alguns segundos na primeira execução (MySQL precisa de tempo para iniciar)
- Verifique se o arquivo `.env` tem as credenciais corretas

### Caso a porta 80 já em uso na maquina
Edite `docker-compose.yml` e altere a porta do Nginx e sobe o container novamente:
```yaml
ports:
  - "8000:80"  # Agora acesse em http://localhost:8000
```

### Limpar tudo e começar do zero
```bash
docker-compose down -v
docker volume prune
docker-compose up --build
docker-compose exec app flask db upgrade
```

## 📚 Recursos Adicionais

- [Flask Documentation](https://flask.palletsprojects.com/)
- [SQLAlchemy Documentation](https://www.sqlalchemy.org/)
- [Docker Documentation](https://docs.docker.com/)
- [Alembic Documentation](https://alembic.sqlalchemy.org/)

## 📄 Licença

Este projeto é propriedade da SESI.

---

**Última atualização:** 28 de maio de 2026
