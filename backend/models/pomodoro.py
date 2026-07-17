# models/pomodoro.py

from models import db
from datetime import datetime, date

class PomodoroSession(db.Model):
    """
    State timer yang lagi aktif per user.
    Cuma ada 1 row per user (di-overwrite tiap kali start/pause/reset).
    """
    __tablename__ = 'pomodoro_sessions'

    id                = db.Column(db.Integer, primary_key=True)
    user_id           = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, unique=True)
    mode              = db.Column(db.String(10), default='focus')   # 'focus' | 'rest'
    duration_minutes  = db.Column(db.Integer, default=25)
    end_time          = db.Column(db.BigInteger, nullable=True)     # timestamp ms, null kalau ga jalan
    is_running        = db.Column(db.Boolean, default=False)
    remaining_seconds = db.Column(db.Integer, nullable=True)        # dipakai saat pause
    updated_at        = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship('User', backref=db.backref('pomodoro_session', uselist=False))

    def to_dict(self):
        return {
            'mode':             self.mode,
            'durationMinutes':  self.duration_minutes,
            'endTime':          self.end_time,
            'isRunning':        self.is_running,
            'remainingSeconds': self.remaining_seconds,
        }


class PomodoroStats(db.Model):
    """
    Tomat & total waktu fokus/istirahat per user per hari.
    1 row per user per tanggal — otomatis 'reset' karena baris baru dibuat tiap hari beda.
    """
    __tablename__ = 'pomodoro_stats'

    id            = db.Column(db.Integer, primary_key=True)
    user_id       = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    date          = db.Column(db.Date, default=date.today, nullable=False)
    tomatoes      = db.Column(db.Integer, default=0)
    focus_seconds = db.Column(db.Integer, default=0)
    rest_seconds  = db.Column(db.Integer, default=0)

    user = db.relationship('User', backref='pomodoro_stats')

    __table_args__ = (
        db.UniqueConstraint('user_id', 'date', name='uq_user_date'),
    )

    def to_dict(self):
        return {
            'tomatoes':     self.tomatoes,
            'focusSeconds': self.focus_seconds,
            'restSeconds':  self.rest_seconds,
        }
