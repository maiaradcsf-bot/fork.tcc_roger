from app.models import db

class ProductCategory(db.Model):
    __tablename__ = 'product_categories'

    # Rows are written through the many-to-many `secondary` relationships; these ones are
    # read-only so SQLAlchemy does not manage the same table twice (that broke deletes)
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=False)

    product = db.relationship('Product', backref=db.backref('product_categories', viewonly=True), viewonly=True)
    category = db.relationship('Category', backref=db.backref('product_categories', viewonly=True), viewonly=True)
