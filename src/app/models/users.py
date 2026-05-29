from app.models import db
from datetime import datetime

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    password = db.Column(db.String(255), nullable=False) 
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # O relacionamento aponta para a string com o nome da classe 'Sale'
    sales = db.relationship('Sale', backref='buyer', lazy=True)