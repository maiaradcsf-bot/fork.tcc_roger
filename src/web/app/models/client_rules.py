from app.models import db


class ClientRule(db.Model):
    __tablename__ = 'client_rules'

    # Rows are written through the many-to-many `secondary` relationships; these ones are
    # read-only so SQLAlchemy does not manage the same table twice (that broke deletes)
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False)
    rule_id = db.Column(db.Integer, db.ForeignKey('rules.id'), nullable=False)

    client = db.relationship('Client', backref=db.backref('client_rules', viewonly=True), viewonly=True)
    rule = db.relationship('Rule', backref=db.backref('client_rules', viewonly=True), viewonly=True)
