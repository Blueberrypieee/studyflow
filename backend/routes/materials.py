import os
import uuid
from flask import Blueprint, request, jsonify, session, send_from_directory, current_app
from models import db
from models.material import Material
from models.folder import Folder

materials_bp = Blueprint('materials', __name__)

ALLOWED = {'pdf', 'docx'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED

def get_current_user_id():
    return session.get('user_id')

# ── Upload ────────────────────────────────────────────────
@materials_bp.route('/api/materials/upload', methods=['POST'])
def upload():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Belum login.'}), 401

    if 'file' not in request.files:
        return jsonify({'error': 'Tidak ada file.'}), 400

    file   = request.files['file']
    folder = request.form.get('folder', None)

    if file.filename == '':
        return jsonify({'error': 'File kosong.'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'Format tidak didukung. Gunakan PDF atau DOCX.'}), 400

    ext      = file.filename.rsplit('.', 1)[1].lower()
    filename = f'{uuid.uuid4().hex}.{ext}'
    filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)

    os.makedirs(current_app.config['UPLOAD_FOLDER'], exist_ok=True)
    file.save(filepath)
    size = os.path.getsize(filepath)

    material = Material(
        user_id  = user_id,
        name     = file.filename,
        type     = ext,
        size     = size,
        folder   = folder if folder else None,
        filename = filename,
    )
    db.session.add(material)
    db.session.commit()

    print(f'[UPLOAD] OK — {file.filename} ({size} bytes) user={user_id}')

    return jsonify({
        'message':  'File berhasil diupload!',
        'material': material.to_dict(),
    }), 201

# ── List Materials ────────────────────────────────────────
@materials_bp.route('/api/materials', methods=['GET'])
def list_materials():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Belum login.'}), 401

    materials = Material.query.filter_by(user_id=user_id)\
                              .order_by(Material.created_at.desc()).all()

    return jsonify({'materials': [m.to_dict() for m in materials]}), 200

# ── Delete Material ───────────────────────────────────────
@materials_bp.route('/api/materials/<int:material_id>', methods=['DELETE'])
def delete_material(material_id):
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Belum login.'}), 401

    material = Material.query.filter_by(id=material_id, user_id=user_id).first()
    if not material:
        return jsonify({'error': 'File tidak ditemukan.'}), 404

    filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], material.filename)
    if os.path.exists(filepath):
        os.remove(filepath)
        print(f'[DELETE] File dihapus dari disk: {material.filename}')

    db.session.delete(material)
    db.session.commit()

    print(f'[DELETE] OK — id={material_id} user={user_id}')

    return jsonify({'message': 'File berhasil dihapus.'}), 200

# ── Download Material ─────────────────────────────────────
@materials_bp.route('/api/materials/<int:material_id>/download', methods=['GET'])
def download_material(material_id):
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Belum login.'}), 401

    material = Material.query.filter_by(id=material_id, user_id=user_id).first()
    if not material:
        return jsonify({'error': 'File tidak ditemukan.'}), 404

    print(f'[DOWNLOAD] {material.name} user={user_id}')

    return send_from_directory(
        current_app.config['UPLOAD_FOLDER'],
        material.filename,
        as_attachment=True,
        download_name=material.name,
    )

# ── Move Material ──────────────────────────────────────────
@materials_bp.route('/api/materials/<int:material_id>/move', methods=['PATCH'])
def move_material(material_id):
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Belum login.'}), 401

    material = Material.query.filter_by(id=material_id, user_id=user_id).first()
    if not material:
        return jsonify({'error': 'File tidak ditemukan.'}), 404

    data   = request.get_json()
    folder = data.get('folder', None)

    material.folder = folder
    db.session.commit()

    print(f'[MOVE] id={material_id} folder={folder}')

    return jsonify({'message': 'File berhasil dipindah.', 'material': material.to_dict()}), 200

# ════════════════════════════════════════════════════════
#  FOLDER CRUD
# ════════════════════════════════════════════════════════

# ── Create Folder ──────────────────────────────────────────
@materials_bp.route('/api/folders', methods=['POST'])
def create_folder():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Belum login.'}), 401

    data = request.get_json()
    name = data.get('name', '').strip()

    if not name:
        return jsonify({'error': 'Nama folder tidak boleh kosong.'}), 400
    if len(name) < 2:
        return jsonify({'error': 'Nama folder minimal 2 karakter.'}), 400

    existing = Folder.query.filter_by(user_id=user_id, name=name).first()
    if existing:
        return jsonify({'error': 'Folder dengan nama ini sudah ada.'}), 409

    folder = Folder(user_id=user_id, name=name)
    db.session.add(folder)
    db.session.commit()

    print(f'[FOLDER] Created id={folder.id} name={name} user={user_id}')

    return jsonify({'message': 'Folder berhasil dibuat!', 'folder': folder.to_dict()}), 201

# ── List Folders ───────────────────────────────────────────
@materials_bp.route('/api/folders', methods=['GET'])
def list_folders():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Belum login.'}), 401

    folders = Folder.query.filter_by(user_id=user_id)\
                          .order_by(Folder.created_at.desc()).all()

    return jsonify({'folders': [f.to_dict() for f in folders]}), 200

# ── Delete Folder ──────────────────────────────────────────
@materials_bp.route('/api/folders/<int:folder_id>', methods=['DELETE'])
def delete_folder(folder_id):
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Belum login.'}), 401

    folder = Folder.query.filter_by(id=folder_id, user_id=user_id).first()
    if not folder:
        return jsonify({'error': 'Folder tidak ditemukan.'}), 404

    # Pindahkan semua file di folder ini ke root
    materials_in_folder = Material.query.filter_by(user_id=user_id, folder=folder.name).all()
    for m in materials_in_folder:
        m.folder = None

    db.session.delete(folder)
    db.session.commit()

    print(f'[FOLDER] Deleted id={folder_id} user={user_id}, {len(materials_in_folder)} files moved to root')

    return jsonify({'message': 'Folder berhasil dihapus.'}), 200

