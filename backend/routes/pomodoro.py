# routes/pomodoro.py

from flask import Blueprint, request, jsonify, session
from models import db
from models.pomodoro import PomodoroSession, PomodoroStats
from datetime import date, datetime

pomodoro_bp = Blueprint('pomodoro', __name__)

MAX_TOMATOES = 3

def get_current_user_id():
    return session.get('user_id')

def get_or_create_session(user_id):
    """Ambil PomodoroSession user, bikin baru kalau belum ada."""
    sess = PomodoroSession.query.filter_by(user_id=user_id).first()
    if not sess:
        sess = PomodoroSession(user_id=user_id)
        db.session.add(sess)
        db.session.commit()
    return sess

def get_or_create_today_stats(user_id):
    """Ambil PomodoroStats hari ini, bikin baru kalau belum ada (otomatis 'reset harian')."""
    today = date.today()
    stats = PomodoroStats.query.filter_by(user_id=user_id, date=today).first()
    if not stats:
        stats = PomodoroStats(user_id=user_id, date=today, tomatoes=0, focus_seconds=0, rest_seconds=0)
        db.session.add(stats)
        db.session.commit()
    return stats


# ── Start timer ───────────────────────────────────────────
@pomodoro_bp.route('/api/pomodoro/start', methods=['POST'])
def start():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Belum login.'}), 401

    data     = request.get_json()
    mode     = data.get('mode', 'focus')
    duration = data.get('durationMinutes', 25)
    end_time = data.get('endTime')  # timestamp ms dari frontend

    if mode not in ['focus', 'rest']:
        return jsonify({'error': 'Mode tidak valid.'}), 400
    if not end_time:
        return jsonify({'error': 'endTime wajib diisi.'}), 400

    sess = get_or_create_session(user_id)
    sess.mode              = mode
    sess.duration_minutes  = duration
    sess.end_time          = end_time
    sess.is_running        = True
    sess.remaining_seconds = None

    db.session.commit()

    print(f'[POMODORO] Start — user={user_id} mode={mode} duration={duration}m')

    return jsonify({'message': 'Timer dimulai.', 'session': sess.to_dict()}), 200


# ── Pause timer ───────────────────────────────────────────
@pomodoro_bp.route('/api/pomodoro/pause', methods=['POST'])
def pause():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Belum login.'}), 401

    data      = request.get_json()
    remaining = data.get('remainingSeconds')

    if remaining is None:
        return jsonify({'error': 'remainingSeconds wajib diisi.'}), 400

    sess = get_or_create_session(user_id)
    sess.is_running        = False
    sess.remaining_seconds = remaining
    sess.end_time           = None

    db.session.commit()

    print(f'[POMODORO] Pause — user={user_id} remaining={remaining}s')

    return jsonify({'message': 'Timer dijeda.', 'session': sess.to_dict()}), 200


# ── Reset timer ───────────────────────────────────────────
@pomodoro_bp.route('/api/pomodoro/reset', methods=['POST'])
def reset():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Belum login.'}), 401

    sess = get_or_create_session(user_id)
    sess.is_running        = False
    sess.end_time           = None
    sess.remaining_seconds = None

    db.session.commit()

    print(f'[POMODORO] Reset — user={user_id}')

    return jsonify({'message': 'Timer direset.'}), 200


# ── Get current state (buat resume pas refresh/buka lagi) ──
@pomodoro_bp.route('/api/pomodoro/state', methods=['GET'])
def get_state():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Belum login.'}), 401

    sess = PomodoroSession.query.filter_by(user_id=user_id).first()

    if not sess:
        return jsonify({'session': None}), 200

    return jsonify({'session': sess.to_dict()}), 200


# ── Complete session → tambah tomat / stats ─────────────────
@pomodoro_bp.route('/api/pomodoro/complete', methods=['POST'])
def complete():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Belum login.'}), 401

    data        = request.get_json()
    mode        = data.get('mode', 'focus')
    elapsed_sec = data.get('elapsedSeconds', 0)

    if mode not in ['focus', 'rest']:
        return jsonify({'error': 'Mode tidak valid.'}), 400
    if elapsed_sec <= 0:
        return jsonify({'error': 'elapsedSeconds harus lebih dari 0.'}), 400

    stats = get_or_create_today_stats(user_id)

    if mode == 'focus':
        stats.focus_seconds += elapsed_sec
        if stats.tomatoes < MAX_TOMATOES:
            stats.tomatoes += 1
    else:
        stats.rest_seconds += elapsed_sec

    # Reset session aktif karena sesi udah selesai
    sess = get_or_create_session(user_id)
    sess.is_running        = False
    sess.end_time           = None
    sess.remaining_seconds = None

    db.session.commit()

    print(f'[POMODORO] Complete — user={user_id} mode={mode} elapsed={elapsed_sec}s tomatoes={stats.tomatoes}')

    return jsonify({
        'message': 'Sesi tercatat!',
        'stats': stats.to_dict(),
    }), 200


# ── Get today's stats (tomat + total waktu) ─────────────────
@pomodoro_bp.route('/api/pomodoro/today', methods=['GET'])
def today_stats():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Belum login.'}), 401

    stats = get_or_create_today_stats(user_id)

    return jsonify({'stats': stats.to_dict()}), 200
