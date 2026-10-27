from app.models import db
# Tabela de associação entre Regras de Perfil e Permissões ( Muitos para Muitos )
class RulePermission(db.Model):
    __tablename__ = 'rule_permissions'

    # Rows are written through the many-to-many `secondary` relationships; these ones are
    # read-only so SQLAlchemy does not manage the same table twice (that broke deletes)
    id = db.Column(db.Integer, primary_key=True)
    rule_id = db.Column(db.Integer, db.ForeignKey('rules.id'), nullable=False)
    permission_id = db.Column(db.Integer, db.ForeignKey('permissions.id'), nullable=False)

    rule = db.relationship('Rule', backref=db.backref('rule_permissions', viewonly=True), viewonly=True)
    permission = db.relationship('Permission', backref=db.backref('rule_permissions', viewonly=True), viewonly=True)
