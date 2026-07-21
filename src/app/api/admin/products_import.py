import os
import csv
import secrets

from app.api.admin import admin_bp
from flask import jsonify, request
from app.api.utils import admin_required, permission_required, IMPORT_TMP_FOLDER
from app.models.products import Product
from app.models.categories import Category
from app.models.stock import Stock
from app.models.stock_moves import StockMove
from app.models import db


# Campos do sistema disponíveis para mapeamento no wizard de importação
IMPORTABLE_FIELDS = [
    {'key': 'name', 'label': 'Nome do produto', 'required': True},
    {'key': 'barcode', 'label': 'Código de Barras (referência)', 'required': False},
    {'key': 'price', 'label': 'Preço', 'required': True},
    {'key': 'description', 'label': 'Descrição', 'required': False},
    {'key': 'min_stock', 'label': 'Estoque mínimo', 'required': False},
    {'key': 'max_stock', 'label': 'Estoque máximo', 'required': False},
    {'key': 'stock_quantity', 'label': 'Quantidade em estoque', 'required': False},
    {'key': 'category', 'label': 'Categoria', 'required': False},
]


def _import_path(import_id):
    safe_id = ''.join(ch for ch in (import_id or '') if ch.isalnum())
    if not safe_id:
        return None
    return os.path.join(IMPORT_TMP_FOLDER, f'{safe_id}.csv')


def _decode_bytes(raw_bytes):
    for encoding in ('utf-8-sig', 'latin-1'):
        try:
            return raw_bytes.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw_bytes.decode('utf-8', errors='replace')


def _sniff_dialect(sample_text):
    try:
        return csv.Sniffer().sniff(sample_text, delimiters=',;\t')
    except csv.Error:
        class _FallbackDialect(csv.excel):
            delimiter = ';' if sample_text.count(';') > sample_text.count(',') else ','
        return _FallbackDialect


def _read_csv(filepath):
    with open(filepath, 'r', encoding='utf-8', newline='') as f:
        sample = f.read(4096)
        f.seek(0)
        dialect = _sniff_dialect(sample)
        rows = list(csv.reader(f, dialect))
    if not rows:
        return [], []
    headers = [(h or '').strip() for h in rows[0]]
    data_rows = [row for row in rows[1:] if any((cell or '').strip() for cell in row)]
    return headers, data_rows


def _parse_decimal(value):
    if value is None:
        return None
    text = str(value).strip().replace('R$', '').strip()
    if not text:
        return None
    if ',' in text and '.' in text:
        text = text.replace('.', '').replace(',', '.')
    elif ',' in text:
        text = text.replace(',', '.')
    try:
        return round(float(text), 2)
    except ValueError:
        return None


def _parse_int(value):
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return int(float(text.replace(',', '.')))
    except ValueError:
        return None


def _split_categories(raw):
    if not raw:
        return []
    separator = ';' if ';' in raw else ','
    return [part.strip() for part in raw.split(separator) if part.strip()]


def _build_rows(import_id, mapping):
    """Lê o CSV temporário e monta a lista de linhas (criação/atualização/inválidas)
    de acordo com o mapeamento de colunas informado. Usado tanto na prévia quanto no commit."""
    filepath = _import_path(import_id)
    if not filepath or not os.path.isfile(filepath):
        return None, (jsonify({'error': 'Importação expirada ou não encontrada. Envie o arquivo novamente.'}), 404)

    if not mapping.get('name') or not mapping.get('price'):
        return None, (jsonify({'error': 'É obrigatório mapear as colunas de Nome e Preço.'}), 400)

    headers, data_rows = _read_csv(filepath)
    header_index = {h: i for i, h in enumerate(headers)}

    def cell(row, field):
        col = mapping.get(field)
        if not col or col not in header_index:
            return None
        idx = header_index[col]
        if idx >= len(row):
            return None
        value = row[idx]
        return value.strip() if value is not None else None

    results = []
    for i, row in enumerate(data_rows, start=2):  # linha 1 é o cabeçalho
        name = cell(row, 'name')
        price_raw = cell(row, 'price')
        price = _parse_decimal(price_raw)
        barcode = cell(row, 'barcode') or None
        description = cell(row, 'description')
        min_stock = _parse_int(cell(row, 'min_stock'))
        max_stock = _parse_int(cell(row, 'max_stock'))
        stock_quantity = _parse_int(cell(row, 'stock_quantity'))
        categories = _split_categories(cell(row, 'category'))

        errors = []
        if not name:
            errors.append('Nome é obrigatório')
        if not price_raw:
            errors.append('Preço é obrigatório')
        elif price is None:
            errors.append('Preço inválido')
        if min_stock is not None and min_stock < 0:
            errors.append('Estoque mínimo inválido')
        if max_stock is not None and max_stock < 0:
            errors.append('Estoque máximo inválido')

        existing_product = None
        if barcode:
            existing_product = Product.query.filter(
                Product.barcode == barcode, Product.deleted_at.is_(None)
            ).first()

        action = 'invalid' if errors else ('update' if existing_product else 'create')

        results.append({
            'row': i,
            'action': action,
            'errors': errors,
            'product_id': existing_product.id if existing_product else None,
            'data': {
                'name': name,
                'barcode': barcode,
                'price': price,
                'description': description,
                'min_stock': min_stock,
                'max_stock': max_stock,
                'stock_quantity': stock_quantity,
                'categories': categories,
            },
            'current': ({
                'name': existing_product.name,
                'barcode': existing_product.barcode,
                'price': float(existing_product.price) if existing_product.price is not None else None,
                'min_stock': existing_product.min_stock,
                'max_stock': existing_product.max_stock,
                'stock_quantity': existing_product.stock.quantity if existing_product.stock else None,
            } if existing_product else None),
        })

    return results, None


@admin_bp.route('/products/import/upload', methods=['POST'])
@permission_required('admin.products.import')
def admin_import_upload():
    user, error, status = admin_required()
    if error:
        return error, status

    if 'file' not in request.files:
        return jsonify({'error': 'Nenhum arquivo enviado'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Nenhum arquivo selecionado'}), 400
    if not file.filename.lower().endswith('.csv'):
        return jsonify({'error': 'Envie um arquivo no formato .csv'}), 400

    raw = file.read()
    if not raw:
        return jsonify({'error': 'Arquivo vazio'}), 400
    text = _decode_bytes(raw)

    os.makedirs(IMPORT_TMP_FOLDER, exist_ok=True)
    import_id = secrets.token_hex(16)
    filepath = _import_path(import_id)
    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        f.write(text)

    headers, data_rows = _read_csv(filepath)
    if not headers:
        os.remove(filepath)
        return jsonify({'error': 'Não foi possível identificar as colunas do arquivo CSV'}), 400

    sample_rows = [dict(zip(headers, row)) for row in data_rows[:5]]

    return jsonify({
        'import_id': import_id,
        'headers': headers,
        'row_count': len(data_rows),
        'sample_rows': sample_rows,
        'fields': IMPORTABLE_FIELDS,
    }), 201


@admin_bp.route('/products/import/preview', methods=['POST'])
@permission_required('admin.products.import')
def admin_import_preview():
    user, error, status = admin_required()
    if error:
        return error, status

    data = request.get_json() or {}
    results, err = _build_rows(data.get('import_id'), data.get('mapping') or {})
    if err:
        return err

    summary = {
        'total': len(results),
        'to_create': sum(1 for r in results if r['action'] == 'create'),
        'to_update': sum(1 for r in results if r['action'] == 'update'),
        'invalid': sum(1 for r in results if r['action'] == 'invalid'),
    }
    return jsonify({'summary': summary, 'rows': results})


@admin_bp.route('/products/import/commit', methods=['POST'])
@permission_required('admin.products.import')
def admin_import_commit():
    user, error, status = admin_required()
    if error:
        return error, status

    data = request.get_json() or {}
    import_id = data.get('import_id')
    results, err = _build_rows(import_id, data.get('mapping') or {})
    if err:
        return err

    created = 0
    updated = 0
    skipped = 0
    row_errors = []

    for entry in results:
        if entry['action'] == 'invalid':
            skipped += 1
            row_errors.append({'row': entry['row'], 'errors': entry['errors']})
            continue

        row_data = entry['data']
        product = Product.query.get(entry['product_id']) if entry['product_id'] else None

        categories = []
        for category_name in row_data['categories']:
            category = Category.query.filter(db.func.lower(Category.name) == category_name.lower()).first()
            if not category:
                category = Category(name=category_name)
                db.session.add(category)
                db.session.flush()
            categories.append(category)

        if product:
            product.name = row_data['name']
            if row_data['description'] is not None:
                product.description = row_data['description']
            product.price = row_data['price']
            if row_data['barcode']:
                product.barcode = row_data['barcode']
            if row_data['min_stock'] is not None:
                product.min_stock = row_data['min_stock']
            if row_data['max_stock'] is not None:
                product.max_stock = row_data['max_stock']
            if categories:
                product.categories = categories
            updated += 1
        else:
            product = Product(
                name=row_data['name'],
                description=row_data['description'],
                price=row_data['price'],
                barcode=row_data['barcode'],
                min_stock=row_data['min_stock'] or 0,
                max_stock=row_data['max_stock'],
            )
            if categories:
                product.categories = categories
            db.session.add(product)
            db.session.flush()
            created += 1

        if row_data['stock_quantity'] is not None:
            stock = product.stock
            if not stock:
                stock = Stock(product=product, quantity=0)
                db.session.add(stock)
                db.session.flush()
            diff = row_data['stock_quantity'] - (stock.quantity or 0)
            if diff != 0:
                stock.quantity = row_data['stock_quantity']
                db.session.add(StockMove(
                    stock=stock,
                    user_id=user.id,
                    quantity_change=diff,
                    reason='Importação de produtos via CSV',
                    move_type='entrada' if diff > 0 else 'saida',
                ))

    db.session.commit()

    filepath = _import_path(import_id)
    if filepath and os.path.isfile(filepath):
        try:
            os.remove(filepath)
        except OSError:
            pass

    return jsonify({
        'created': created,
        'updated': updated,
        'skipped': skipped,
        'errors': row_errors,
    })


@admin_bp.route('/products/import/<import_id>', methods=['DELETE'])
@permission_required('admin.products.import')
def admin_import_cancel(import_id):
    user, error, status = admin_required()
    if error:
        return error, status
    filepath = _import_path(import_id)
    if filepath and os.path.isfile(filepath):
        try:
            os.remove(filepath)
        except OSError:
            pass
    return jsonify({'message': 'Importação cancelada'})
