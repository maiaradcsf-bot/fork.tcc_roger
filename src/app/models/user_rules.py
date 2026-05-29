from app.models import db

class UserRule(db.Model):
    __tablename__ = 'user_rules'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    rule_id = db.Column(db.Integer, db.ForeignKey('rules.id'), nullable=False)

    user = db.relationship('User', backref='user_rules')
    rule = db.relationship('Rule', backref='user_rules')
