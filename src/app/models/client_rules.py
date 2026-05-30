from app.models import db


class ClientRule(db.Model):
    __tablename__ = 'client_rules'

    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False)
    rule_id = db.Column(db.Integer, db.ForeignKey('rules.id'), nullable=False)

    client = db.relationship('Client', backref='client_rules')
    rule = db.relationship('Rule', backref='client_rules')
