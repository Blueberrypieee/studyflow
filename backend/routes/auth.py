from flask import Blueprint, request, jsonify, session
from models import db
from models.user import User
from models.session import QuizSession
from datetime import datetime, date, timedelta

auth_bp = Blueprint('auth', __name__)

# ── Register ─────────────────────────────────────────────
@auth_bp.route('/api/register', methods=['POST'])
def register():
    data     = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    if not username or not password:
        return jsonify({'error': 'Username dan password wajib diisi.'}), 400
    if len(username) < 6:
        return jsonify({'error': 'Username minimal 6 karakter.'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password minimal 6 karakter.'}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username sudah digunakan.'}), 409

    user = User(username=username)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    print(f'[REGISTER] OK — id={user.id} username={user.username}')
    return jsonify({'message': 'Registrasi berhasil!'}), 201

# ── Login ─────────────────────────────────────────────────
@auth_bp.route('/api/login', methods=['POST'])
def login():
    data     = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    print(f'[LOGIN] Request: username={username}')

    if not username or not password:
        return jsonify({'error': 'Username dan password wajib diisi.'}), 400

    all_users = User.query.all()
    print(f'[LOGIN] Total users di DB: {len(all_users)}')
    for u in all_users:
        print(f'[LOGIN] User: id={u.id} username={u.username}')

    user = User.query.filter_by(username=username).first()
    print(f'[LOGIN] Query result: {user}')

    if not user or not user.check_password(password):
        print(f'[LOGIN] GAGAL')
        return jsonify({'error': 'Username atau password salah.'}), 401

    session.clear()
    session['user_id']  = user.id
    session['username'] = user.username

    print(f'[LOGIN] OK — {username}')
    return jsonify({'message': 'Login berhasil!', 'user': user.to_dict()}), 200

# ── Logout ────────────────────────────────────────────────
@auth_bp.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    print(f'[LOGOUT] OK')
    return jsonify({'message': 'Logout berhasil!'}), 200

# ── Me ────────────────────────────────────────────────────
@auth_bp.route('/api/me', methods=['GET'])
def me():
    if 'user_id' not in session:
        return jsonify({'error': 'Belum login.'}), 401

    user = User.query.get(session['user_id'])
    if not user:
        session.clear()
        return jsonify({'error': 'User tidak ditemukan.'}), 404

    # Ambil semua sessions user
    sessions = QuizSession.query.filter_by(user_id=user.id).all()

    # Hitung stats
    total_days = len(set(s.created_at.strftime('%Y-%m-%d') for s in sessions))
    best_grade = _calc_best_grade(sessions)
    streak     = _calc_streak(sessions)

    user_data = user.to_dict()
    user_data.update({
        'streak': streak,
        'grade':  best_grade,
        'days':   total_days,
    })

    return jsonify({'user': user_data}), 200

# ── Helpers ───────────────────────────────────────────────
def _calc_best_grade(sessions):
    order = ['S', 'A', 'B', 'C', 'D']
    for g in order:
        if any(s.grade == g for s in sessions):
            return g
    return None

def _calc_streak(sessions):
    if not sessions:
        return 0

    # Kumpulkan semua tanggal quiz unik
    quiz_dates = set(s.created_at.date() for s in sessions)

    # Hitung streak mundur dari hari ini
    streak = 0
    check  = date.today()

    while check in quiz_dates:
        streak += 1
        check  -= timedelta(days=1)

    return streak

