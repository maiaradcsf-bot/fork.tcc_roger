from app.models import db

class Category(db.Model):
    __tablename__ = 'categories'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=True)
    parent_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=True)

    products = db.relationship('Product', secondary='product_categories', back_populates='categories')
    children = db.relationship('Category', backref=db.backref('parent', remote_side=[id]), lazy=True)
