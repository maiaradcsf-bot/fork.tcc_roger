from app.models import db

class UserRule(db.Model):
    __tablename__ = 'user_rules'

    # Rows are written through the many-to-many `secondary` relationships; these ones are
    # read-only so SQLAlchemy does not manage the same table twice (that broke deletes)
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    rule_id = db.Column(db.Integer, db.ForeignKey('rules.id'), nullable=False)

    user = db.relationship('User', backref=db.backref('user_rules', viewonly=True), viewonly=True)
    rule = db.relationship('Rule', backref=db.backref('user_rules', viewonly=True), viewonly=True)
