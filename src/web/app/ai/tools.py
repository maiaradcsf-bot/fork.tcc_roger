"""Read-only data tools the assistant can call. Every tool declares the permission it needs and is
only offered to (and runnable by) an actor that holds it, so the model can never see more than the
user could see on screen. No tool changes data: cart changes go back to the UI as suggestions."""
import unicodedata
from datetime import datetime, timedelta

from sqlalchemy import func

from app.api.utils import get_active_products, get_product_by_id, normalize_order_status
from app.models import db
from app.models.order_items import OrderItem
from app.models.orders import Order
from app.models.status_enums import OrderStatus
from app.models.stock import Stock
from app.models.stock_moves import StockMove

MAX_RESULTS = 25
MAX_DAYS = 365

STATUS_LABELS = {
    OrderStatus.PENDING.value: 'pendente',
    OrderStatus.APPROVED.value: 'aprovado (aguardando retirada)',
    OrderStatus.FINISHED.value: 'retirado',
    OrderStatus.REJECTED.value: 'rejeitado',
    OrderStatus.CANCELLED.value: 'cancelado',
}


def _normalize(text):
    text = unicodedata.normalize('NFKD', str(text or '').lower())
    return ''.join(ch for ch in text if not unicodedata.combining(ch))


def _int_arg(args, key, default, minimum, maximum):
    try:
        value = int(args.get(key, default))
    except (TypeError, ValueError):
        value = default
    return max(minimum, min(maximum, value))


def _quantity(product):
    return product.stock.quantity if product.stock else 0


def _category_names(product):
    return [category.name for category in product.categories]


def _haystack(product):
    return _normalize(' '.join([product.name or '', product.description or '', product.barcode or '', *_category_names(product)]))


def _matches(product, term, any_word=False):
    if not term:
        return True
    words = [word for word in _normalize(term).split() if len(word) > 2] or _normalize(term).split()
    haystack = _haystack(product)
    check = any if any_word else all
    return check(word in haystack for word in words)


def _search(products, term):
    found = [p for p in products if _matches(p, term)]
    return found or [p for p in products if _matches(p, term, any_word=True)]


def _admin_product(product):
    return {
        'id': product.id,
        'nome': product.name,
        'codigo_barras': product.barcode,
        'categorias': _category_names(product),
        'preco': float(product.price or 0),
        'estoque': _quantity(product),
        'estoque_minimo': product.min_stock,
        'estoque_maximo': product.max_stock,
    }


def _client_product(product):
    return {
        'id': product.id,
        'nome': product.name,
        'descricao': (product.description or '')[:200],
        'categorias': _category_names(product),
        'preco': float(product.price or 0),
        'estoque_disponivel': _quantity(product),
    }


def _since(days):
    return datetime.utcnow() - timedelta(days=days)


def _order_summary(order, include_client):
    data = {
        'id': order.id,
        'status': STATUS_LABELS.get(normalize_order_status(order.status), order.status),
        'total': float(order.total or 0),
        'data': order.created_at.strftime('%d/%m/%Y %H:%M') if order.created_at else None,
        'itens': [
            {'produto': item.product.name if item.product else None, 'quantidade': item.quantity}
            for item in order.items
        ],
    }
    if include_client:
        data['cliente'] = order.client.name if order.client else None
    return data


def admin_summary(actor, args):
    products = get_active_products()
    pending = Order.query.filter(func.lower(Order.status).in_(['pending', 'pendente', 'initial', 'inicial'])).count()
    low = [p for p in products if p.min_stock is not None and _quantity(p) <= p.min_stock]
    return {
        'produtos_ativos': len(products),
        'estoque_total_unidades': sum(_quantity(p) for p in products),
        'produtos_sem_estoque': sum(1 for p in products if _quantity(p) <= 0),
        'produtos_abaixo_do_minimo': len(low),
        'solicitacoes_pendentes': pending,
        'total_solicitacoes': Order.query.count(),
    }


def admin_search_products(actor, args):
    term = str(args.get('termo') or '')[:100]
    limit = _int_arg(args, 'limite', 10, 1, MAX_RESULTS)
    found = _search(get_active_products(), term)
    return {'total_encontrado': len(found), 'produtos': [_admin_product(p) for p in found[:limit]]}


def admin_low_stock(actor, args):
    limit = _int_arg(args, 'limite', 15, 1, MAX_RESULTS)
    low = [p for p in get_active_products() if _quantity(p) <= 0 or (p.min_stock is not None and _quantity(p) <= p.min_stock)]
    low.sort(key=lambda p: _quantity(p) - (p.min_stock or 0))
    return {'total': len(low), 'produtos': [_admin_product(p) for p in low[:limit]]}


def admin_product_moves(actor, args):
    days = _int_arg(args, 'dias', 30, 1, MAX_DAYS)
    product = None
    if args.get('produto_id') is not None:
        product = get_product_by_id(_int_arg(args, 'produto_id', 0, 0, 2_147_483_647))
    elif args.get('termo'):
        candidates = [p for p in get_active_products() if _matches(p, str(args['termo'])[:100])]
        if len(candidates) > 1:
            return {'erro': 'Mais de um produto encontrado; peça para o usuário escolher.', 'opcoes': [{'id': p.id, 'nome': p.name} for p in candidates[:10]]}
        product = candidates[0] if candidates else None
    if not product:
        return {'erro': 'Produto não encontrado.'}

    moves = (
        StockMove.query.join(Stock, StockMove.stock_id == Stock.id)
        .filter(Stock.product_id == product.id, StockMove.created_at >= _since(days))
        .order_by(StockMove.created_at.desc())
        .all()
    )
    return {
        'produto': product.name,
        'periodo_dias': days,
        'estoque_atual': _quantity(product),
        'total_entradas': sum(m.quantity_change for m in moves if m.quantity_change > 0),
        'total_saidas': -sum(m.quantity_change for m in moves if m.quantity_change < 0),
        'ultimas_movimentacoes': [
            {
                'quantidade': m.quantity_change,
                'motivo': m.reason,
                'data': m.created_at.strftime('%d/%m/%Y %H:%M') if m.created_at else None,
                'estorno': bool(m.is_reversal),
            }
            for m in moves[:10]
        ],
    }


def admin_list_orders(actor, args):
    limit = _int_arg(args, 'limite', 10, 1, MAX_RESULTS)
    status = normalize_order_status(str(args.get('status') or ''))
    orders = Order.query.order_by(Order.created_at.desc()).all()
    if status:
        orders = [o for o in orders if normalize_order_status(o.status) == status]
    return {'total': len(orders), 'solicitacoes': [_order_summary(o, include_client=True) for o in orders[:limit]]}


def admin_top_requested(actor, args):
    days = _int_arg(args, 'dias', 30, 1, MAX_DAYS)
    limit = _int_arg(args, 'limite', 10, 1, MAX_RESULTS)
    excluded = [OrderStatus.CANCELLED.value, OrderStatus.REJECTED.value]
    rows = (
        db.session.query(OrderItem.product_id, func.sum(OrderItem.quantity).label('quantidade'), func.count(func.distinct(OrderItem.order_id)).label('pedidos'))
        .join(Order, OrderItem.order_id == Order.id)
        .filter(Order.created_at >= _since(days), func.lower(Order.status).notin_(excluded))
        .group_by(OrderItem.product_id)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(limit)
        .all()
    )
    result = []
    for product_id, quantity, orders in rows:
        product = get_product_by_id(product_id)
        if product:
            result.append({'produto': product.name, 'unidades_solicitadas': int(quantity or 0), 'numero_de_pedidos': int(orders or 0), 'estoque_atual': _quantity(product)})
    return {'periodo_dias': days, 'produtos': result}


def client_search_products(actor, args):
    term = str(args.get('termo') or '')[:100]
    limit = _int_arg(args, 'limite', 10, 1, MAX_RESULTS)
    found = _search([p for p in get_active_products() if _quantity(p) > 0], term)
    return {'total_encontrado': len(found), 'produtos': [_client_product(p) for p in found[:limit]]}


def client_my_orders(actor, args):
    limit = _int_arg(args, 'limite', 10, 1, MAX_RESULTS)
    orders = Order.query.filter_by(client_id=actor.id).order_by(Order.created_at.desc()).limit(limit).all()
    return {'solicitacoes': [_order_summary(o, include_client=False) for o in orders]}


def client_suggest_items(actor, args, suggestions):
    """Validate the products the model wants to suggest and keep them for the UI (nothing is added to the cart)."""
    accepted, rejected = [], []
    for raw in (args.get('itens') or [])[:10]:
        if not isinstance(raw, dict):
            continue
        product = get_product_by_id(_int_arg(raw, 'produto_id', 0, 0, 2_147_483_647))
        stock = _quantity(product) if product else 0
        if not product or stock <= 0:
            rejected.append(raw.get('produto_id'))
            continue
        quantity = _int_arg(raw, 'quantidade', 1, 1, stock)
        if any(s['product_id'] == product.id for s in suggestions):
            continue
        suggestions.append({
            'product_id': product.id,
            'name': product.name,
            'quantity': quantity,
            'stock': stock,
            'price': float(product.price or 0),
            'photo_path': product.photo_path,
        })
        accepted.append(product.name)
    return {'sugeridos': accepted, 'indisponiveis': rejected, 'observacao': 'O cliente confirma na tela antes de adicionar ao carrinho.'}


def _schema(properties=None, required=None):
    return {'type': 'object', 'properties': properties or {}, 'required': required or []}


LIMIT_PROP = {'limite': {'type': 'integer', 'description': f'Máximo de resultados (1 a {MAX_RESULTS})'}}
DAYS_PROP = {'dias': {'type': 'integer', 'description': f'Período em dias até hoje (1 a {MAX_DAYS})'}}

ADMIN_TOOLS = [
    ('resumo_almoxarifado', 'Números gerais: produtos ativos, estoque total, itens sem estoque ou abaixo do mínimo e solicitações pendentes.',
     _schema(), 'admin.dashboard.view', admin_summary),
    ('buscar_produtos', 'Busca produtos por nome, descrição, código de barras ou categoria, com estoque, mínimo, máximo e preço.',
     _schema({'termo': {'type': 'string', 'description': 'Texto de busca; vazio lista todos'}, **LIMIT_PROP}), 'admin.products.list', admin_search_products),
    ('produtos_estoque_baixo', 'Produtos sem estoque ou com estoque igual ou abaixo do mínimo.',
     _schema(LIMIT_PROP), 'admin.products.list', admin_low_stock),
    ('movimentacoes_produto', 'Entradas, saídas e últimas movimentações de estoque de um produto em um período.',
     _schema({'produto_id': {'type': 'integer'}, 'termo': {'type': 'string', 'description': 'Nome do produto, se não souber o id'}, **DAYS_PROP}),
     'admin.stock.moves.list', admin_product_moves),
    ('listar_solicitacoes', 'Lista solicitações (pedidos) mais recentes, opcionalmente filtradas por status.',
     _schema({'status': {'type': 'string', 'enum': ['pending', 'approved', 'finished', 'rejected', 'cancelled']}, **LIMIT_PROP}),
     'admin.orders.list', admin_list_orders),
    ('mais_solicitados', 'Produtos mais solicitados no período (ignora pedidos cancelados e rejeitados).',
     _schema({**DAYS_PROP, **LIMIT_PROP}), 'admin.orders.list', admin_top_requested),
]

CLIENT_TOOLS = [
    ('buscar_produtos_disponiveis', 'Busca produtos com estoque disponível por nome, descrição ou categoria.',
     _schema({'termo': {'type': 'string', 'description': 'Texto de busca; vazio lista os disponíveis'}, **LIMIT_PROP}),
     'clients.products.list', client_search_products),
    ('minhas_solicitacoes', 'Solicitações do próprio cliente com status, itens e total.',
     _schema(LIMIT_PROP), 'clients.orders.list', client_my_orders),
    ('sugerir_para_carrinho', 'Mostra ao cliente produtos sugeridos com quantidade, para ele confirmar e adicionar ao carrinho. Use apenas ids vindos de buscar_produtos_disponiveis.',
     _schema({'itens': {'type': 'array', 'items': _schema({'produto_id': {'type': 'integer'}, 'quantidade': {'type': 'integer'}}, ['produto_id', 'quantidade'])}}, ['itens']),
     'clients.products.request', None),
]


def available_tools(catalog, actor):
    return [tool for tool in catalog if actor.has_permission(tool[3])]


def tool_definitions(tools):
    return [
        {'type': 'function', 'function': {'name': name, 'description': description, 'parameters': parameters}}
        for name, description, parameters, _permission, _handler in tools
    ]
