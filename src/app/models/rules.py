from app.models import db
# Perfis de Usuarios ( Administrador, Gerente, Funcionario, etc. )
class Rule(db.Model):
    __tablename__ = 'rules'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=True)

    permissions = db.relationship('Permission', secondary='rule_permissions', back_populates='rules')
    users = db.relationship('User', secondary='user_rules', back_populates='rules')
