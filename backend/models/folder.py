# models/folder.py

from models import db
from datetime import datetime

class Folder(db.Model):
    __tablename__ = 'folders'

    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name       = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='folders')

    def to_dict(self):
        return {
            'id':        self.id,
            'name':      self.name,
            'createdAt': int(self.created_at.timestamp() * 1000),
        }

