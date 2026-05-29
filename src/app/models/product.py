from app.models import db

class Product(db.Model):
    __tablename__ = 'products'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    photo_path = db.Column(db.String(255), nullable=True) 
    description = db.Column(db.Text, nullable=True)
    price = db.Column(db.Numeric(10, 2), nullable=False, default=0.00) 
    
    sales = db.relationship('Sale', backref='product', lazy=True)