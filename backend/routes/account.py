# routes/account.py

from flask import Blueprint, request, jsonify, session
from models import db
from models.user import User
from models.session import QuizSession
from models.pomodoro import PomodoroStats
from datetime import date, timedelta

account_bp = Blueprint('account', __name__)

def get_current_user_id():
    return session.get('user_id')


# ── Get profile + stats ───────────────────────────────────
@account_bp.route('/api/account/me', methods=['GET'])
def me():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Belum login.'}), 401

    user = User.query.get(user_id)
    if not user:
        session.clear()
        return jsonify({'error': 'User tidak ditemukan.'}), 404

    # ── Total fokus & istirahat (all-time, SUM semua baris pomodoro_stats)
    all_stats = PomodoroStats.query.filter_by(user_id=user_id).all()
    total_focus_seconds = sum(s.focus_seconds for s in all_stats)
    total_rest_seconds  = sum(s.rest_seconds for s in all_stats)

    # ── Best streak (rekor tertinggi)
    best_streak = _calc_best_streak(user_id)

    # ── Grade rata-rata (dari semua quiz_sessions)
    sessions = QuizSession.query.filter_by(user_id=user_id).all()
    average_grade = _calc_average_grade(sessions)

    return jsonify({
        'username':           user.username,
        'joinDate':            user.created_at.isoformat(),
        'totalFocusSeconds':   total_focus_seconds,
        'totalRestSeconds':    total_rest_seconds,
        'bestStreak':          best_streak,
        'averageGrade':        average_grade,
    }), 200


# ── Change password ────────────────────────────────────────
@account_bp.route('/api/account/change-password', methods=['POST'])
def change_password():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Belum login.'}), 401

    data         = request.get_json()
    old_password = data.get('oldPassword', '').strip()
    new_password = data.get('newPassword', '').strip()

    if not old_password or not new_password:
        return jsonify({'error': 'Semua field wajib diisi.'}), 400
    if len(new_password) < 6:
        return jsonify({'error': 'Password baru minimal 6 karakter.'}), 400

    user = User.query.get(user_id)
    if not user or not user.check_password(old_password):
        return jsonify({'error': 'Password lama salah.'}), 401

    user.set_password(new_password)
    db.session.commit()

    print(f'[ACCOUNT] Password changed — user={user_id}')

    return jsonify({'message': 'Password berhasil diubah!'}), 200


# ── Delete account ─────────────────────────────────────────
@account_bp.route('/api/account/delete', methods=['POST'])
def delete_account():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Belum login.'}), 401

    data     = request.get_json()
    password = data.get('password', '').strip()

    if not password:
        return jsonify({'error': 'Password wajib diisi.'}), 400

    user = User.query.get(user_id)
    if not user or not user.check_password(password):
        return jsonify({'error': 'Password salah.'}), 401

    db.session.delete(user)
    db.session.commit()
    session.clear()

    print(f'[ACCOUNT] Account deleted — user={user_id}')

    return jsonify({'message': 'Akun berhasil dihapus.'}), 200


# ── Helpers ───────────────────────────────────────────────
def _calc_best_streak(user_id):
    """
    Hitung streak terpanjang yang pernah dicapai user,
    dihitung dari histori tanggal quiz_sessions.
    """
    sessions = QuizSession.query.filter_by(user_id=user_id).all()
    if not sessions:
        return 0

    quiz_dates = sorted(set(s.created_at.date() for s in sessions))

    best = 1
    current = 1

    for i in range(1, len(quiz_dates)):
        if quiz_dates[i] - quiz_dates[i-1] == timedelta(days=1):
            current += 1
            best = max(best, current)
        elif quiz_dates[i] != quiz_dates[i-1]:
            current = 1

    return best


def _calc_average_grade(sessions):
    """
    Rata-ratakan field pct semua sesi, lalu convert ke grade huruf.
    """
    if not sessions:
        return None

    avg_pct = sum(s.pct for s in sessions) / len(sessions)

    if avg_pct >= 90:
        return 'S'
    elif avg_pct >= 80:
        return 'A'
    elif avg_pct >= 70:
        return 'B'
    elif avg_pct >= 60:
        return 'C'
    else:
        return 'D'

