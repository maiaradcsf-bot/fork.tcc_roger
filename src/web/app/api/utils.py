import os
import re
from functools import wraps
from flask import request, jsonify
from sqlalchemy.exc import IntegrityError, OperationalError
from app.models import db
from app.models.products import Product
from app.models.status_enums import CartStatus, OrderStatus
from app.models.clients import Client
from app.models.users import User
from app.models.rules import Rule
from app.models.stock import Stock

UPLOAD_FOLDER = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'static', 'uploads'))
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

# Pasta temporária (fora de static/) usada pelo wizard de importação de produtos via CSV
IMPORT_TMP_FOLDER = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'tmp_imports'))

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


OPEN_CART_STATUSES = {CartStatus.OPEN.value}


def normalize_order_status(status):
    normalized = (status or '').lower()
    if normalized in {'initial', 'inicial', 'pendent', 'pendente'}:
        return OrderStatus.PENDING.value
    if normalized in {'aprovado'}:
        return OrderStatus.APPROVED.value
    if normalized in {'rejected', 'rejeitado', 'rejeitada'}:
        return OrderStatus.REJECTED.value
    if normalized in {'cancelled', 'cancelado', 'canceled'}:
        return OrderStatus.CANCELLED.value
    if normalized in {'completed', 'concluido', 'concluído', 'retirado', 'picked_up', 'withdrawn', 'checked_out'}:
        return OrderStatus.FINISHED.value
    return normalized


def get_active_products():
    return Product.query.filter(Product.deleted_at.is_(None)).all()


def get_product_by_id(product_id):
    return Product.query.filter(Product.id == product_id, Product.deleted_at.is_(None)).first()


def json_error(message, code=400):
    return jsonify({'error': message}), code


_INT_PATTERN = re.compile(r'^[+-]?\d+$')

# Largest value the INT columns holding stock quantities accept in MySQL
MAX_STOCK_QUANTITY = 2_147_483_647


def parse_int(value):
    """Return value as int when it is an integer or an integer string, otherwise None."""
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str) and _INT_PATTERN.match(value.strip()):
        return int(value.strip())
    return None


EMAIL_PATTERN = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
PASSWORD_MIN_LENGTH = 6


class ValidationError(Exception):
    """Invalid client input; rendered as a JSON error by the handler registered in create_app."""

    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


def json_body():
    """The request body as a dict. An empty body counts as {}; anything else that is not a JSON object is a 400."""
    if not request.get_data(cache=True):
        return {}
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ValidationError('O corpo da requisição deve ser um objeto JSON')
    return data


def text_field(data, key, label, max_length, required=False):
    """Stripped string value of data[key]; None when absent/null and not required."""
    value = data.get(key)
    if value is None:
        if required:
            raise ValidationError(f'{label} é obrigatório')
        return None
    if not isinstance(value, str):
        raise ValidationError(f'{label} deve ser um texto')
    value = value.strip()
    if required and not value:
        raise ValidationError(f'{label} é obrigatório')
    if len(value) > max_length:
        raise ValidationError(f'{label} pode ter no máximo {max_length} caracteres')
    return value


def email_field(data, key='email', required=False):
    value = text_field(data, key, 'email', 120, required=required)
    if value is not None and not EMAIL_PATTERN.match(value):
        raise ValidationError('email inválido')
    return value


def password_field(data, key='password', required=False):
    from app.models.passwords import password_too_long
    value = data.get(key)
    if value is None or value == '':
        if required:
            raise ValidationError('senha é obrigatória')
        return None
    if not isinstance(value, str):
        raise ValidationError('senha deve ser um texto')
    if len(value) < PASSWORD_MIN_LENGTH:
        raise ValidationError(f'A senha deve ter pelo menos {PASSWORD_MIN_LENGTH} caracteres')
    if password_too_long(value):
        raise ValidationError('A senha pode ter no máximo 72 bytes')
    return value


def id_list_field(data, key, label):
    """List of distinct positive integer ids (order kept); [] when absent/null."""
    value = data.get(key)
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValidationError(f'{label} deve ser uma lista de ids')
    ids = []
    for item in value:
        parsed = parse_int(item)
        if parsed is None or parsed <= 0:
            raise ValidationError(f'{label} deve conter apenas ids inteiros positivos')
        if parsed not in ids:
            ids.append(parsed)
    return ids


def optional_id_field(data, key, label):
    value = data.get(key)
    if value in (None, ''):
        return None
    parsed = parse_int(value)
    if parsed is None or parsed <= 0:
        raise ValidationError(f'{label} deve ser um id inteiro positivo')
    return parsed


def permission_names_of(rules):
    return {permission.name for rule in rules for permission in rule.permissions}


def ensure_can_grant(actor, permission_names):
    """An admin can only hand out (or touch) system permissions they hold themselves.

    Custom permissions are not checked anywhere in the code, so they grant no access and are
    left out (otherwise a newly created permission could never be assigned).
    """
    from app.permissions_catalog import SYSTEM_PERMISSION_NAMES
    missing = sorted((set(permission_names) & SYSTEM_PERMISSION_NAMES) - set(actor.get_permission_names()))
    if missing:
        raise ValidationError(
            f'Você não pode conceder ou alterar permissões que não possui: {", ".join(missing)}', 403)


_IMAGE_SIGNATURES = (
    (b'\x89PNG\r\n\x1a\n', 'png'),
    (b'\xff\xd8\xff', 'jpeg'),
    (b'GIF87a', 'gif'),
    (b'GIF89a', 'gif'),
)


def _image_kind(head):
    for signature, kind in _IMAGE_SIGNATURES:
        if head.startswith(signature):
            return kind
    if head[:4] == b'RIFF' and head[8:12] == b'WEBP':
        return 'webp'
    return None


def save_uploaded_image(file_storage):
    """Validate an uploaded image by extension and real content, store it and return its public URL."""
    import secrets
    from werkzeug.utils import secure_filename
    if file_storage is None:
        raise ValidationError('Nenhum arquivo enviado')
    if not file_storage.filename:
        raise ValidationError('Nenhum arquivo selecionado')
    if not allowed_file(file_storage.filename):
        raise ValidationError('Tipo de arquivo não permitido. Use: png, jpg, jpeg, gif, webp')
    head = file_storage.stream.read(16)
    file_storage.stream.seek(0)
    if _image_kind(head) is None:
        raise ValidationError('O arquivo enviado não é uma imagem válida')
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    filename = f"{secrets.token_hex(8)}_{secure_filename(file_storage.filename)}"
    file_storage.save(os.path.join(UPLOAD_FOLDER, filename))
    return f'/static/uploads/{filename}'


def price_field(data, key='price', required=False):
    import math
    value = data.get(key)
    if value is None or value == '':
        if required:
            raise ValidationError('preço é obrigatório')
        return None
    if isinstance(value, bool):
        raise ValidationError('preço deve ser um número')
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise ValidationError('preço deve ser um número')
    if not math.isfinite(number) or number < 0 or number > 99999999.99:
        raise ValidationError('preço deve ser um número entre 0 e 99999999.99')
    return round(number, 2)


def stock_limit_field(data, key, label):
    value = data.get(key)
    if value is None or value == '':
        return None
    parsed = parse_int(value)
    if parsed is None or parsed < 0 or parsed > MAX_STOCK_QUANTITY:
        raise ValidationError(f'{label} deve ser um número inteiro válido entre 0 e {MAX_STOCK_QUANTITY}')
    return parsed


def lock_stocks(product_ids):
    """Lock the stock rows of the given products and return them as {product_id: Stock}.

    Rows are always locked in ascending product_id order so that concurrent operations
    touching the same products wait for each other instead of deadlocking. Every route
    that locks stock does it before locking the order or stock moves it changes.
    Products without a stock row are left out of the result.
    """
    stocks = {}
    for product_id in sorted(set(product_ids)):
        stock = Stock.query.filter_by(product_id=product_id).with_for_update().populate_existing().one_or_none()
        if stock:
            stocks[product_id] = stock
    return stocks


# MySQL error codes: 1205 lock wait timeout, 1213 deadlock, 1062 duplicate entry
_LOCK_CONFLICT_CODES = {1205, 1213}
_DUPLICATE_ENTRY_CODE = 1062
# How MySQL and SQLite name the stock unique constraint in duplicate-entry errors
_STOCK_UNIQUE_MARKERS = ('uq_stock_product_id', 'stock.product_id')


def _db_error_code(exc):
    args = getattr(getattr(exc, 'orig', None), 'args', ())
    return args[0] if args and isinstance(args[0], int) else None


def _is_concurrency_conflict(exc):
    code = _db_error_code(exc)
    if isinstance(exc, OperationalError):
        return code in _LOCK_CONFLICT_CODES
    # Only a stock row created twice for the same product is a race; other duplicates
    # (e.g. a barcode) are real errors and must not be reported as "try again"
    message = str(getattr(exc, 'orig', ''))
    is_duplicate = code == _DUPLICATE_ENTRY_CODE or 'UNIQUE constraint failed' in message
    return is_duplicate and any(marker in message for marker in _STOCK_UNIQUE_MARKERS)


# Isolation level for stock_transaction routes (MySQL only; see the docstring below)
STOCK_TRANSACTION_ISOLATION = 'READ COMMITTED'


def stock_transaction(fn):
    """Run a route that changes stock or order status as one READ COMMITTED transaction.

    MySQL's default REPEATABLE READ keeps the snapshot taken by the first query of the
    request (the auth lookup), so after waiting for a row lock the route could still read
    stale data from other tables. READ COMMITTED makes every read after a lock see what the
    previous lock holder committed. Deadlocks, lock timeouts and a stock row created twice
    for the same product roll the whole transaction back and answer 409.

    Must be applied above permission_required so it runs before any query.
    """
    @wraps(fn)
    def wrapper(*args, **kwargs):
        session = db.session()
        if STOCK_TRANSACTION_ISOLATION and not session.in_transaction() and session.get_bind().dialect.name == 'mysql':
            session.connection(execution_options={'isolation_level': STOCK_TRANSACTION_ISOLATION})
        try:
            return fn(*args, **kwargs)
        except (OperationalError, IntegrityError) as exc:
            if not _is_concurrency_conflict(exc):
                raise
            db.session.rollback()
            return jsonify({
                'error': 'Outra operação alterou estes dados ao mesmo tempo. Tente novamente.',
                'code': 'concurrent_update',
            }), 409
    return wrapper


def get_auth_token():
    auth = request.headers.get('Authorization', '')
    if auth.startswith('Bearer '):
        return auth[7:]
    return None


def get_client_user():
    token = get_auth_token()
    if not token:
        return None, jsonify({'error': 'Token de autorização é obrigatório'}), 401
    client = Client.query.filter_by(auth_token=token).first()
    if not client:
        return None, jsonify({'error': 'Token de cliente inválido'}), 401
    if not client.active:
        return None, jsonify({'error': 'Conta de cliente está inativa'}), 403
    return client, None, None


def client_required(permission_name=None):
    client, error, status = get_client_user()
    if error:
        return None, error, status
    if permission_name and not client.has_permission(permission_name):
        return None, jsonify({'error': 'Permissão insuficiente'}), 403
    return client, None, None


def get_admin_user():
    token = get_auth_token()
    if not token:
        return None, jsonify({'error': 'Token de autorização é obrigatório'}), 401
    user = User.query.filter_by(auth_token=token).first()
    if not user:
        return None, jsonify({'error': 'Token de administrador inválido'}), 401
    if not getattr(user, 'rules', []):
        return None, jsonify({'error': 'Privilégios de administrador são necessários'}), 403
    return user, None, None


def admin_required(permission_name=None):
    user, error, status = get_admin_user()
    if error:
        return None, error, status
    if permission_name and not user.has_permission(permission_name):
        return None, jsonify({'error': 'Permissão insuficiente'}), 403
    return user, None, None


def permission_required(permission_name):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user, error, status = admin_required(permission_name)
            if error:
                return error, status
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def client_permission_required(permission_name):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            client, error, status = client_required(permission_name)
            if error:
                return error, status
            return fn(*args, **kwargs)
        return wrapper
    return decorator
