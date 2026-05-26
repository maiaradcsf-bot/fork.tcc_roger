FROM python:3.11-slim

WORKDIR /app

# Copia os arquivos de requisitos e instala as dependências
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia o restante do código do projeto
COPY . .

# Expõe a porta padrão do Flask
EXPOSE 5000

# Comando para rodar o Flask em modo de desenvolvimento (com auto-reload)
CMD ["python", "-m", "flask", "run", "--host=0.0.0.0", "--port=5000", "--debug"]