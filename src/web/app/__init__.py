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

    _register_error_handlers(app)
    return app


def _register_error_handlers(app):
    from flask import jsonify
    from sqlalchemy.exc import DataError, IntegrityError
    from werkzeug.exceptions import RequestEntityTooLarge
    from app.api.utils import ValidationError

    @app.errorhandler(ValidationError)
    def _validation_error(error):
        db.session.rollback()
        return jsonify({'error': error.message}), error.status

    # Constraint violations that slipped past validation (e.g. two requests creating the same
    # unique value at once) are conflicts, not server errors
    @app.errorhandler(IntegrityError)
    def _integrity_error(error):
        db.session.rollback()
        app.logger.warning('IntegrityError: %s', error.orig)
        return jsonify({'error': 'Os dados conflitam com registros existentes', 'code': 'integrity_error'}), 409

    @app.errorhandler(DataError)
    def _data_error(error):
        db.session.rollback()
        app.logger.warning('DataError: %s', error.orig)
        return jsonify({'error': 'Valor inválido para o campo informado', 'code': 'invalid_data'}), 400

    @app.errorhandler(RequestEntityTooLarge)
    def _too_large(error):
        return jsonify({'error': 'Arquivo ou requisição maior que o limite permitido'}), 413

    @app.after_request
    def _security_headers(response):
        # uploaded files are served as static content: never let the browser sniff them as HTML
        response.headers.setdefault('X-Content-Type-Options', 'nosniff')
        return response