from app.models import db

class Address(db.Model):
    __tablename__ = 'addresses'

    id = db.Column(db.Integer, primary_key=True)
    street = db.Column(db.String(255), nullable=False)
    city = db.Column(db.String(100), nullable=False)
    state = db.Column(db.String(100), nullable=False)
    zipcode = db.Column(db.String(30), nullable=False)
    country = db.Column(db.String(100), nullable=False)
    address_type = db.Column(db.String(50), nullable=False)

    clients = db.relationship('Client', secondary='client_addresses', back_populates='addresses')
