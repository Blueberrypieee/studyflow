from models import db
from datetime import datetime

class Material(db.Model):
    __tablename__ = 'materials'

    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name       = db.Column(db.String(255), nullable=False)
    type       = db.Column(db.String(10))
    size       = db.Column(db.Integer)
    folder     = db.Column(db.String(100), nullable=True)
    filename   = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='materials')

    def to_dict(self):
        return {
            'id':         self.id,
            'name':       self.name,
            'type':       self.type,
            'size':       self.size,
            'folder':     self.folder,
            'uploadedAt': int(self.created_at.timestamp() * 1000),
        }
