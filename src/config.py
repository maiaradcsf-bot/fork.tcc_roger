import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-key-muito-segura')
    
    # Monta a string de conexão para o MySQL
    DB_USER = os.environ.get('DB_USER', 'developer')
    DB_PASSWORD = os.environ.get('DB_PASSWORD', '******')
    DB_HOST = os.environ.get('DB_HOST', 'mysql')
    DB_NAME = os.environ.get('DB_NAME', 'tcc_db')
    
    SQLALCHEMY_DATABASE_URI = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False