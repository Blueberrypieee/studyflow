import os
from functools import wraps
from flask import Flask, render_template, redirect, url_for, session, jsonify
from dotenv import load_dotenv
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_wtf.csrf import CSRFProtect, generate_csrf
from models import db
from models.material import Material
from models.folder import Folder
from models.session import QuizSession
from models.pomodoro import PomodoroSession, PomodoroStats
from routes.auth import auth_bp
from routes.materials import materials_bp
from routes.quiz import quiz_bp
from routes.pomodoro import pomodoro_bp
from routes.account import account_bp

load_dotenv()

app = Flask(__name__)

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_PATH  = os.path.join(BASE_DIR, 'studyflow.db')

app.config['SECRET_KEY']                     = os.getenv('SECRET_KEY', 'dev-key-123')
app.config['SQLALCHEMY_DATABASE_URI']        = 'sqlite:///' + DB_PATH
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER']                  = os.path.join(BASE_DIR, 'uploads')
app.config['MAX_CONTENT_LENGTH']             = 16 * 1024 * 1024

# ── Session cookie security ────────────────────────────────
# HttpOnly: JS di browser ga bisa baca cookie (default True di Flask, ditulis eksplisit biar jelas)
app.config['SESSION_COOKIE_HTTPONLY'] = True

# Secure: cookie cuma dikirim lewat HTTPS.
# Di lokal Termux (http://localhost) HARUS False, kalau True nanti login gagal terus
# karena browser nolak kirim cookie di koneksi non-HTTPS.
# Pas hosting nanti (PythonAnywhere dengan HTTPS), ganti FLASK_ENV=production di .env
# biar otomatis jadi True.
app.config['SESSION_COOKIE_SECURE'] = os.getenv('FLASK_ENV') == 'production'

# SameSite: cegah cookie ikut kekirim dari request lintas situs (proteksi dasar CSRF)
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# Session expire otomatis kalau browser ditutup (opsional, bisa dihapus kalau mau "remember me" permanen)
app.config['PERMANENT_SESSION_LIFETIME'] = 60 * 60 * 24 * 7  # 7 hari

# ── Rate limiting ─────────────────────────────────────────
# Batasi jumlah request per IP biar ga bisa brute force login/register.
# storage_uri default (in-memory) cukup buat single-server kayak sekarang.
limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    default_limits=[],  # ga ada limit global, cuma endpoint tertentu yang dibatasi
)

# ── CSRF Protection ───────────────────────────────────────
# Mencegah situs lain diam-diam nyuruh browser user ngirim request
# (misal ganti password, hapus data) ke StudyFlow tanpa sepengetahuan user.
# Semua request POST/PUT/PATCH/DELETE wajib bawa token CSRF yang valid,
# kecuali endpoint yang di-exempt secara eksplisit (lihat di bawah).
csrf = CSRFProtect(app)

@app.route('/api/csrf-token', methods=['GET'])
def get_csrf_token():
    """
    Endpoint buat JS ambil token CSRF pas halaman pertama kali load,
    dipakai ulang di semua fetch POST/PUT/PATCH/DELETE selanjutnya.
    """
    return jsonify({'csrfToken': generate_csrf()}), 200

@app.errorhandler(400)
def handle_csrf_error(e):
    # CSRFProtect defaultnya bikin halaman HTML error, kita ubah jadi JSON
    # biar konsisten sama response API lainnya dan gampang dihandle di JS.
    if 'CSRF' in str(e):
        return jsonify({'error': 'Sesi kamu sudah tidak valid, silakan muat ulang halaman.'}), 400
    return e

# ── Startup logs ──────────────────────────────────────────
print('=' * 50)
print(f'[APP] BASE_DIR : {BASE_DIR}')
print(f'[APP] DB PATH  : {DB_PATH}')
print(f'[APP] DB EXISTS: {os.path.exists(DB_PATH)}')
print('=' * 50)

db.init_app(app)

with app.app_context():
    db.create_all()
    print('[APP] Tables OK')

# ── Blueprints ────────────────────────────────────────────
app.register_blueprint(auth_bp)
app.register_blueprint(materials_bp)
app.register_blueprint(quiz_bp)
app.register_blueprint(pomodoro_bp)
app.register_blueprint(account_bp)

# ── Rate limit khusus endpoint sensitif ────────────────────
# 5 percobaan per menit per IP — cukup buat user asli yang salah ketik,
# tapi bikin brute force jadi ga efisien (lambat banget buat nyoba banyak password)
limiter.limit('5 per minute')(app.view_functions['auth.login'])
limiter.limit('5 per minute')(app.view_functions['auth.register'])

# ── Login required decorator ──────────────────────────────
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            print(f'[AUTH] Unauthorized → redirect to login')
            return redirect(url_for('login_page'))
        return f(*args, **kwargs)
    return decorated

# ── Public routes ─────────────────────────────────────────
@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('menu_page'))
    return redirect(url_for('login_page'))

@app.route('/login')
def login_page():
    if 'user_id' in session:
        return redirect(url_for('menu_page'))
    return render_template('login.html')

@app.route('/register')
def register_page():
    if 'user_id' in session:
        return redirect(url_for('menu_page'))
    return render_template('register.html')

# ── Protected routes ──────────────────────────────────────
@app.route('/menu')
@login_required
def menu_page():
    return render_template('menu.html')

@app.route('/materials')
@login_required
def materials_page():
    return render_template('materials.html')

@app.route('/quiz')
@login_required
def quiz_page():
    return render_template('quiz.html')

@app.route('/quiz-play')
@login_required
def quiz_play_page():
    return render_template('quiz-play.html')

@app.route('/history')
@login_required
def history_page():
    return render_template('history.html')

@app.route('/progress')
@login_required
def progress_page():
    return render_template('progress.html')

@app.route('/pomodoro')
@login_required
def pomodoro_page():
    return render_template('pomodoro.html')

@app.route('/account')
@login_required
def account_page():
    return render_template('account.html')

if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=os.getenv('FLASK_DEBUG', '0') == '1'
    )






