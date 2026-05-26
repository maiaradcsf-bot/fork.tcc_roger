import os

class Config:
    # Busca as variáveis do ambiente (definidas no docker-compose) ou usa um padrão (fallback)
    DB_USER = os.getenv('DB_USER', 'tcc_user')
    DB_PASSWORD = os.getenv('DB_PASSWORD', 'tcc_password')
    DB_HOST = os.getenv('DB_HOST', 'localhost') # localhost caso rode fora do docker
    DB_NAME = os.getenv('DB_NAME', 'tcc_database')

    # String de conexão utilizando PyMySQL (caso use Flask-SQLAlchemy)
    SQLALCHEMY_DATABASE_URI = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False