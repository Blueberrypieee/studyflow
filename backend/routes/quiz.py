# routes/quiz.py

import os
import uuid
import json
from flask import Blueprint, request, jsonify, session, current_app
from models import db
from models.session import QuizSession
from services.file_service import extract_text
from services.ai_service import generate_quiz

quiz_bp = Blueprint('quiz', __name__)

# ── File signature (magic bytes) ──────────────────────────
# Sama persis kayak validasi di routes/materials.py — mencegah
# orang upload file berbahaya yang cuma di-rename jadi .pdf/.docx
FILE_SIGNATURES = {
    'pdf':  [b'%PDF'],
    'docx': [b'PK\x03\x04', b'PK\x05\x06', b'PK\x07\x08'],
}

def verify_file_signature(file_storage, ext):
    signatures = FILE_SIGNATURES.get(ext)
    if not signatures:
        return False
    header = file_storage.stream.read(8)
    file_storage.stream.seek(0)  # balikin pointer biar bisa di-save normal
    return any(header.startswith(sig) for sig in signatures)

def get_current_user_id():
    return session.get('user_id')

# ── Generate Quiz ─────────────────────────────────────
@quiz_bp.route('/api/quiz/generate', methods=['POST'])
def generate():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Belum login.'}), 401

    if 'file' not in request.files:
        return jsonify({'error': 'Tidak ada file.'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'error': 'File kosong.'}), 400

    ext = file.filename.rsplit('.', 1)[-1].lower()
    if ext not in ['pdf', 'docx']:
        return jsonify({'error': 'Format tidak didukung.'}), 400

    # ── Validasi isi file, bukan cuma nama ─────────────────
    if not verify_file_signature(file, ext):
        print(f'[QUIZ] DITOLAK — file "{file.filename}" isinya bukan {ext.upper()} asli user={user_id}')
        return jsonify({'error': f'File bukan {ext.upper()} yang valid. Kemungkinan file rusak atau ekstensi dipalsukan.'}), 400

    tmp_filename = f'{uuid.uuid4().hex}.{ext}'
    tmp_path     = os.path.join(current_app.config['UPLOAD_FOLDER'], tmp_filename)
    os.makedirs(current_app.config['UPLOAD_FOLDER'], exist_ok=True)
    file.save(tmp_path)

    print(f'[QUIZ] File saved: {tmp_path}')

    try:
        text = extract_text(tmp_path, ext)
        print(f'[QUIZ] Extracted text: {len(text)} chars')

        if not text or len(text) < 50:
            return jsonify({'error': 'Teks terlalu sedikit untuk membuat quiz.'}), 400

        questions = generate_quiz(text)

        if not questions:
            return jsonify({'error': 'AI gagal membuat soal. Coba lagi.'}), 500

        return jsonify({
            'message':   'Quiz berhasil dibuat!',
            'material':  file.filename,
            'questions': questions,
        }), 200

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
            print(f'[QUIZ] Temp file deleted: {tmp_path}')

# ── Save Session ──────────────────────────────────────
@quiz_bp.route('/api/quiz/save', methods=['POST'])
def save():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Belum login.'}), 401

    data = request.get_json()

    session_obj = QuizSession(
        user_id      = user_id,
        material     = data.get('material', 'Unknown'),
        total        = data.get('total', 0),
        correct      = data.get('correct', 0),
        wrong        = data.get('wrong', 0),
        pct          = data.get('pct', 0),
        grade        = data.get('grade', 'D'),
        duration_sec = data.get('durationSec', 0),
        mistakes     = json.dumps(data.get('mistakes', [])),
    )

    db.session.add(session_obj)
    db.session.commit()

    print(f'[QUIZ] Session saved id={session_obj.id} user={user_id} grade={session_obj.grade}')

    return jsonify({'message': 'Hasil quiz disimpan!', 'id': session_obj.id}), 201

# ── Get Sessions ──────────────────────────────────────
@quiz_bp.route('/api/quiz/sessions', methods=['GET'])
def get_sessions():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Belum login.'}), 401

    sessions = QuizSession.query.filter_by(user_id=user_id)\
                                .order_by(QuizSession.created_at.desc()).all()

    return jsonify({'sessions': [s.to_dict() for s in sessions]}), 200

# ── Delete All Sessions ───────────────────────────────
@quiz_bp.route('/api/quiz/sessions', methods=['DELETE'])
def delete_all_sessions():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Belum login.'}), 401

    QuizSession.query.filter_by(user_id=user_id).delete()
    db.session.commit()

    print(f'[QUIZ] All sessions deleted user={user_id}')

    return jsonify({'message': 'Semua riwayat dihapus.'}), 200


