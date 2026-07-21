import os
import sys
import random

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app
from app.models import db
from app.models.users import User
from app.models.rules import Rule
from app.models.permissions import Permission
from app.models.categories import Category
from app.models.products import Product
from app.models.stock import Stock
from app.models.stock_moves import StockMove


def seed_data():
    app = create_app()
    with app.app_context():
        db.create_all()

        def get_or_create(model, defaults=None, **kwargs):
            instance = model.query.filter_by(**kwargs).first()
            if instance:
                return instance, False
            params = dict(**kwargs)
            if defaults:
                params.update(defaults)
            instance = model(**params)
            db.session.add(instance)
            db.session.flush()
            return instance, True

        permissions = [
            ('admin.dashboard.view', 'Visualizar dashboard administrativo'),
            ('admin.categories.list', 'Listar categorias no admin'),
            ('admin.categories.create', 'Criar categorias no admin'),
            ('admin.categories.edit', 'Editar categorias no admin'),
            ('admin.categories.delete', 'Excluir categorias no admin'),
            ('admin.products.list', 'Listar produtos no admin'),
            ('admin.products.create', 'Criar produtos no admin'),
            ('admin.products.edit', 'Editar produtos no admin'),
            ('admin.products.delete', 'Excluir produtos no admin'),
            ('admin.products.import', 'Importar produtos via CSV no admin'),
            ('admin.stock.moves.list', 'Listar movimentações de estoque no admin'),
            ('admin.stock.moves.create', 'Registrar movimentações de estoque no admin'),
            ('admin.stock.moves.edit', 'Editar movimentações de estoque no admin'),
            ('admin.stock.moves.delete', 'Excluir movimentações de estoque no admin'),
            ('admin.orders.list', 'Listar pedidos no admin'),
            ('admin.orders.approve', 'Aprovar pedidos no admin'),
            ('admin.orders.reject', 'Rejeitar pedidos no admin'),
            ('admin.orders.cancel', 'Cancelar pedidos no admin'),
            ('admin.clients.list', 'Listar clientes no admin'),
            ('admin.clients.view', 'Visualizar dados de cliente no admin'),
            ('admin.clients.edit', 'Editar clientes no admin'),
            ('admin.settings.permissions.manage', 'Gerenciar permissões no admin'),
            ('admin.settings.profiles.manage', 'Gerenciar perfis no admin'),
            ('admin.settings.users.manage', 'Gerenciar usuários no admin'),
            ('clients.products.list', 'Listar produtos para clientes'),
            ('clients.products.view', 'Visualizar produto para cliente'),
            ('clients.products.request', 'Solicitar produto para cliente'),
            ('clients.orders.list', 'Listar solicitações para cliente'),
            ('clients.orders.view', 'Visualizar solicitação para cliente'),
            ('clients.orders.cancel', 'Cancelar solicitação para cliente'),
            ('clients.profile.view', 'Visualizar perfil do cliente'),
            ('clients.profile.edit', 'Editar perfil do cliente'),
            ('clients.cart.manage', 'Gerenciar carrinho do cliente'),
        ]

        permission_objects = []
        for name, description in permissions:
            permission, _ = get_or_create(Permission, name=name, defaults={'description': description})
            permission_objects.append(permission)

        administrator, created_admin_rule = get_or_create(Rule, name='administrator', defaults={'description': 'Administrador completo do sistema'})
        missing_permissions = [perm for perm in permission_objects if perm not in administrator.permissions]
        if missing_permissions:
            administrator.permissions = administrator.permissions + missing_permissions

        client_rule, created_client_rule = get_or_create(Rule, name='cliente', defaults={'description': 'Regra padrão para clientes'})
        client_permissions = [
            perm for perm in permission_objects
            if perm.name.startswith('clients.')
        ]
        if created_client_rule or not client_rule.permissions:
            client_rule.permissions = client_permissions

        admin_user = User.query.filter_by(username='admin').first()
        if not admin_user:
            admin_user = User(username='admin', email='admin@almoxarifado.com')
            admin_user.set_password('dev@123')
            admin_user.rules = [administrator]
            db.session.add(admin_user)
        else:
            admin_user.email = 'admin@almoxarifado.com'
            admin_user.set_password('dev@123')
            if administrator not in admin_user.rules:
                admin_user.rules.append(administrator)

        category_data = [
            {'name': 'Papelaria', 'description': 'Artigos e materiais de papelaria', 'parent': None},
            {'name': 'Escritório', 'description': 'Materiais e suprimentos para escritório', 'parent': None},
            {'name': 'Papel', 'description': 'Papeis e resmas para impressão e escrita', 'parent': None},
            {'name': 'Organização', 'description': 'Itens para organizar a mesa e o escritório', 'parent': None},
            {'name': 'Impressão', 'description': 'Suprimentos de impressão e etiquetas', 'parent': None},
            {'name': 'Utensílios de mesa', 'description': 'Ferramentas e acessórios para mesa de trabalho', 'parent': None},
            {'name': 'Canetas', 'description': 'Canetas, marcadores e instrumentos de escrita', 'parent': 'Papelaria'},
            {'name': 'Cadernos', 'description': 'Cadernos, blocos e agendas para anotações', 'parent': 'Papelaria'},
            {'name': 'Blocos de Notas', 'description': 'Blocos de anotações e post-its', 'parent': 'Papelaria'},
            {'name': 'Pastas e Fichários', 'description': 'Pastas, fichários e arquivos organizadores', 'parent': 'Escritório'},
        ]

        category_map = {}
        for item in category_data:
            parent = None
            if item['parent']:
                parent = category_map.get(item['parent']) or Category.query.filter_by(name=item['parent']).first()
            category, _ = get_or_create(Category, name=item['name'], defaults={'description': item['description'], 'parent': parent})
            if parent and category.parent is None:
                category.parent = parent
            category_map[item['name']] = category

        products_data = [
            {'name': 'Caneta Esferográfica Azul', 'description': 'Caneta esferográfica com tinta azul e escrita suave', 'price': 2.50, 'categories': ['Canetas']},
            {'name': 'Caneta Esferográfica Preta', 'description': 'Caneta esferográfica preta ideal para uso diário', 'price': 2.50, 'categories': ['Canetas']},
            {'name': 'Caneta Gel Preta', 'description': 'Caneta gel preta com ponta fina', 'price': 4.20, 'categories': ['Canetas']},
            {'name': 'Caneta Marca-Texto Amarela', 'description': 'Marca-texto amarelo para realçar textos', 'price': 3.80, 'categories': ['Canetas']},
            {'name': 'Caneta Marca-Texto Rosa', 'description': 'Marca-texto rosa fluorescente', 'price': 3.80, 'categories': ['Canetas']},
            {'name': 'Caneta Permanente Preta', 'description': 'Caneta permanente para escrita em plástico e metal', 'price': 5.40, 'categories': ['Canetas']},
            {'name': 'Caneta para Quadro Branco', 'description': 'Caneta para quadro branco com ponta média', 'price': 6.20, 'categories': ['Canetas']},
            {'name': 'Lapiseira 0.5 mm', 'description': 'Lapiseira com corpo emborrachado e ponta 0.5 mm', 'price': 12.90, 'categories': ['Canetas']},
            {'name': 'Lapiseira 0.7 mm', 'description': 'Lapiseira com ponta 0.7 mm para escrita precisa', 'price': 12.90, 'categories': ['Canetas']},
            {'name': 'Estojo para Canetas', 'description': 'Estojo compacto para guardar canetas e lápis', 'price': 18.00, 'categories': ['Utensílios de mesa']},
            {'name': 'Caderno Universitário 200 Folhas', 'description': 'Caderno universitário pautado com 200 folhas', 'price': 19.90, 'categories': ['Cadernos']},
            {'name': 'Caderno Brochura 96 Folhas', 'description': 'Caderno brochura pautado com 96 folhas', 'price': 14.50, 'categories': ['Cadernos']},
            {'name': 'Caderno Pautado A4', 'description': 'Caderno pautado tamanho A4 para anotações', 'price': 22.00, 'categories': ['Cadernos']},
            {'name': 'Caderno Sem Pauta A5', 'description': 'Caderno sem pauta A5 para desenho e rascunho', 'price': 18.50, 'categories': ['Cadernos']},
            {'name': 'Caderno de Desenho', 'description': 'Caderno de desenho com folhas brancas para sketch', 'price': 24.90, 'categories': ['Cadernos']},
            {'name': 'Porta-Canetas de Mesa', 'description': 'Porta-canetas de acrílico para mesa', 'price': 27.00, 'categories': ['Organização']},
            {'name': 'Bandeja Porta-Documentos', 'description': 'Bandeja para organizar documentos na mesa', 'price': 32.90, 'categories': ['Organização']},
            {'name': 'Suporte para Livros', 'description': 'Suporte para livros e pastas na mesa', 'price': 39.90, 'categories': ['Organização']},
            {'name': 'Arquivo Móvel', 'description': 'Caixa de arquivo móvel para armazenamento de documentos', 'price': 79.90, 'categories': ['Organização']},
            {'name': 'Etiquetas Adesivas A4', 'description': 'Folhas de etiquetas adesivas para impressora', 'price': 31.90, 'categories': ['Impressão']},
            {'name': 'Papel Adesivo para Impressora', 'description': 'Papel adesivo A4 para etiquetas e rótulos', 'price': 33.50, 'categories': ['Impressão']},
            {'name': 'Cartucho de Tinta Preta', 'description': 'Cartucho de tinta preta compatível para impressora', 'price': 89.90, 'categories': ['Impressão']},
            {'name': 'Cartucho de Tinta Colorida', 'description': 'Cartucho de tinta colorida compatível para impressora', 'price': 95.90, 'categories': ['Impressão']},
            {'name': 'Toner Compatível HP', 'description': 'Toner compatível para impressoras HP', 'price': 219.90, 'categories': ['Impressão']},
            {'name': 'Clip de Papel 100 Unidades', 'description': 'Pacote com 100 clipes de papel', 'price': 8.90, 'categories': ['Utensílios de mesa']},
            {'name': 'Borracha Branca', 'description': 'Borracha branca para apagar com precisão', 'price': 4.50, 'categories': ['Utensílios de mesa']},
            {'name': 'Apontador Duplo', 'description': 'Apontador duplo com reservatório', 'price': 9.90, 'categories': ['Utensílios de mesa']},
            {'name': 'Régua de 30cm', 'description': 'Régua transparente de 30 cm para desenho', 'price': 7.90, 'categories': ['Utensílios de mesa']},
            {'name': 'Tesoura Escolar', 'description': 'Tesoura escolar com ponta arredondada', 'price': 12.50, 'categories': ['Utensílios de mesa']},
            {'name': 'Calculadora de Mesa', 'description': 'Calculadora de mesa com display grande', 'price': 49.90, 'categories': ['Utensílios de mesa']},
            {'name': 'Grampeador com Grampos', 'description': 'Grampeador compacto com 100 grampos', 'price': 24.90, 'categories': ['Utensílios de mesa']},
            {'name': 'Marcador Permanente Vermelho', 'description': 'Marcador permanente vermelho para escrita duradoura', 'price': 5.90, 'categories': ['Canetas']},
            {'name': 'Marcador Permanente Azul', 'description': 'Marcador permanente azul para escrita duradoura', 'price': 5.90, 'categories': ['Canetas']},
            {'name': 'Refil de Caneta Marca-Texto', 'description': 'Refil para caneta marca-texto amarelo', 'price': 11.90, 'categories': ['Canetas']},
            {'name': 'Kit de Lapiseira 0.5 mm', 'description': 'Kit com 2 lapiseiras 0.5 mm e grafites extras', 'price': 29.90, 'categories': ['Canetas']},
            {'name': 'Organizador de Gaveta', 'description': 'Organizador modular para gavetas de escritório', 'price': 26.90, 'categories': ['Organização']},
        ]

        for product_data in products_data:
            def generate_barcode():
                while True:
                    code = ''.join([str(random.randint(0, 9)) for _ in range(13)])
                    exists = Product.query.filter_by(barcode=code).first()
                    if not exists:
                        return code

            min_stock_val = random.randint(5, 15)
            max_stock_val = min_stock_val + random.randint(20, 100)
            barcode_val = generate_barcode()

            product, created = get_or_create(Product, name=product_data['name'], defaults={
                'description': product_data['description'],
                'price': product_data['price'],
                'barcode': barcode_val,
                'min_stock': min_stock_val,
                'max_stock': max_stock_val,
            })
            if not created:
                updated = False
                if not product.barcode:
                    product.barcode = generate_barcode()
                    updated = True
                if product.min_stock is None:
                    product.min_stock = min_stock_val
                    updated = True
                if product.max_stock is None:
                    product.max_stock = max_stock_val
                    updated = True
                if updated:
                    db.session.add(product)
            for category_name in product_data['categories']:
                category = category_map.get(category_name) or Category.query.filter_by(name=category_name).first()
                if category and category not in product.categories:
                    product.categories.append(category)

            stock, created_stock = get_or_create(Stock, product_id=product.id, defaults={'quantity': random.randint(10, 99)})

            products_with_losses = {
                'Caneta Esferográfica Azul',
                'Caderno Universitário 200 Folhas',
                'Resma de Papel Sulfite A4 500 Folhas',
                'Kit de Lapiseira 0.5 mm',
                'Pasta Catálogo com Elástico',
            }
            loss_reason = 'Perda - validade vencida'

            if product.name in products_with_losses:
                if stock.quantity is None:
                    stock.quantity = 0
                # Definir quantidade final abaixo ou no mínimo, para enfatizar baixa de estoque
                target_quantity = max(0, product.min_stock - random.randint(1, 3))
                if stock.quantity > target_quantity:
                    quantity_change = target_quantity - stock.quantity
                    stock.quantity = target_quantity
                    db.session.add(stock)
                    existing_loss_move = StockMove.query.filter_by(
                        stock_id=stock.id,
                        reason=loss_reason,
                        move_type='saida',
                        quantity_change=quantity_change,
                    ).first()
                    if not existing_loss_move:
                        db.session.add(StockMove(
                            stock_id=stock.id,
                            quantity_change=quantity_change,
                            reason=loss_reason,
                            move_type='saida',
                        ))

        db.session.commit()
        print('Seeds criados com sucesso!')


if __name__ == '__main__':
    seed_data()
