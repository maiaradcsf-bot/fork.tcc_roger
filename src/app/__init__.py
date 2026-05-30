from pathlib import Path
from flask import Flask
from flask_migrate import Migrate
from app.models import db
from config import Config

migrate = Migrate()

def create_app(config_class=Config):
    base_path = Path(__file__).resolve().parent
    app = Flask(
        __name__,
        template_folder=str(base_path / 'templates'),
        static_folder=str(base_path / 'static'),
    )
    app.config.from_object(config_class)

    # Inicializa o banco e as migrações no app
    db.init_app(app)
    migrate.init_app(app, db)

    # Registrar os Blueprints (Rotas)
    from app.views import views_bp
    from app.api import api_bp

    app.register_blueprint(views_bp)
    app.register_blueprint(api_bp)  # Note que este já tem o prefixo /api configurado no arquivo dele

    return app