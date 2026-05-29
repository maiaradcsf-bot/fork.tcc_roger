from app.models import db

class ClientAddress(db.Model):
    __tablename__ = 'client_addresses'

    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False)
    address_id = db.Column(db.Integer, db.ForeignKey('addresses.id'), nullable=False)
    is_primary = db.Column(db.Boolean, default=False)

    client = db.relationship('Client', backref='client_addresses')
    address = db.relationship('Address', backref='client_addresses')
