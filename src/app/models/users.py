from app.models import db
from datetime import datetime
from app.models.passwords import hash_password, verify_password

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    auth_token = db.Column(db.String(255), unique=True, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    rules = db.relationship('Rule', secondary='user_rules', back_populates='users')

    def set_password(self, password):
        self.password = hash_password(password)

    def check_password(self, password):
        matches, upgraded_hash = verify_password(self.password, password)
        if upgraded_hash:
            # legacy werkzeug hash: switch to bcrypt; persisted by the caller's commit
            self.password = upgraded_hash
        return matches

    def has_permission(self, permission_name):
        return any(
            permission.name == permission_name
            for rule in self.rules
            for permission in rule.permissions
        )

    def get_permission_names(self):
        return sorted({
            permission.name
            for rule in self.rules
            for permission in rule.permissions
        })
