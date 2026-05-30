from app.models import db
# Tabela de associação entre Regras de Perfil e Permissões ( Muitos para Muitos )
class RulePermission(db.Model):
    __tablename__ = 'rule_permissions'

    id = db.Column(db.Integer, primary_key=True)
    rule_id = db.Column(db.Integer, db.ForeignKey('rules.id'), nullable=False)
    permission_id = db.Column(db.Integer, db.ForeignKey('permissions.id'), nullable=False)

    rule = db.relationship('Rule', backref='rule_permissions')
    permission = db.relationship('Permission', backref='rule_permissions')
