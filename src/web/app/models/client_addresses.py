from app.models import db

class ClientAddress(db.Model):
    __tablename__ = 'client_addresses'

    # Rows are written through the many-to-many `secondary` relationships; these ones are
    # read-only so SQLAlchemy does not manage the same table twice (that broke deletes)
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False)
    address_id = db.Column(db.Integer, db.ForeignKey('addresses.id'), nullable=False)
    is_primary = db.Column(db.Boolean, default=False)

    client = db.relationship('Client', backref=db.backref('client_addresses', viewonly=True), viewonly=True)
    address = db.relationship('Address', backref=db.backref('client_addresses', viewonly=True), viewonly=True)
