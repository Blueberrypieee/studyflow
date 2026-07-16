import os
from functools import wraps
from flask import Flask, render_template, redirect, url_for, session
from dotenv import load_dotenv
from models import db
from models.material import Material
from models.folder import Folder
from models.session import QuizSession
from routes.auth import auth_bp
from routes.materials import materials_bp
from routes.quiz import quiz_bp

load_dotenv()

app = Flask(__name__)

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_PATH  = os.path.join(BASE_DIR, 'studyflow.db')

app.config['SECRET_KEY']                     = os.getenv('SECRET_KEY', 'dev-key-123')
app.config['SQLALCHEMY_DATABASE_URI']        = 'sqlite:///' + DB_PATH
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER']                  = os.path.join(BASE_DIR, 'uploads')
app.config['MAX_CONTENT_LENGTH']             = 16 * 1024 * 1024

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

if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=os.getenv('FLASK_DEBUG', '0') == '1'
    )


