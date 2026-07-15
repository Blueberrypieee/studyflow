# models/session.py

from models import db
from datetime import datetime
import json

class QuizSession(db.Model):
    __tablename__ = 'quiz_sessions'

    id           = db.Column(db.Integer, primary_key=True)
    user_id      = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    material     = db.Column(db.String(255))
    total        = db.Column(db.Integer, default=0)
    correct      = db.Column(db.Integer, default=0)
    wrong        = db.Column(db.Integer, default=0)
    pct          = db.Column(db.Integer, default=0)
    grade        = db.Column(db.String(2))
    duration_sec = db.Column(db.Integer, default=0)
    mistakes     = db.Column(db.Text)  # JSON string
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='sessions')

    def to_dict(self):
        return {
            'id':          self.id,
            'material':    self.material,
            'total':       self.total,
            'correct':     self.correct,
            'wrong':       self.wrong,
            'pct':         self.pct,
            'grade':       self.grade,
            'durationSec': self.duration_sec,
            'mistakes':    json.loads(self.mistakes or '[]'),
            'date':        int(self.created_at.timestamp() * 1000),
        }
