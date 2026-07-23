# StudyFlow

**Belajar lebih cerdas, bukan lebih keras.**

StudyFlow adalah platform belajar mandiri berbasis AI yang membantu kamu menguji pemahaman terhadap suatu materi — tanpa perlu teman belajar atau tutor. Upload catatan kamu, biarkan AI membuatkan quiz, dan pantau progres belajarmu dari waktu ke waktu.

Live demo: [studyfloww.pythonanywhere.com](https://studyfloww.pythonanywhere.com)

---

## Kenapa StudyFlow?

Belajar sendiri itu susah divalidasi — kamu ngerasa udah paham, tapi gimana cara mastiin beneran paham? StudyFlow menjawab itu dengan:

- Upload materi (PDF/DOCX) lalu AI generate soal dari isinya secara otomatis
- Uji diri sendiri lewat quiz interaktif, bukan cuma baca ulang catatan
- Lihat pola kesalahan lewat riwayat dan bank soal salah
- Bangun kebiasaan belajar konsisten lewat streak dan Pomodoro timer

Cocok buat kamu yang belajar sendirian — pelajar, mahasiswa, atau siapa pun yang lagi self-study tanpa partner belajar.

---

## Fitur Utama

### Manajemen Materi
- Upload dan simpan catatan dalam format PDF & DOCX
- Organisasi file dengan sistem folder
- Pencarian dan filter berdasarkan tanggal
- Validasi keamanan file (magic bytes check, bukan cuma ekstensi)

### Quiz AI
- AI otomatis membaca materi dan membuat soal pilihan ganda
- Timer per soal, progress bar, dan feedback instan
- Sistem grading S/A/B/C/D di akhir sesi
- Pembahasan lengkap tiap jawaban

### Riwayat & Progress
- Riwayat lengkap semua sesi quiz
- Bank soal yang pernah salah dijawab, untuk direview ulang
- Grafik skor dari waktu ke waktu
- Distribusi grade dan kalender streak belajar
- Deteksi topik/materi terlemah berdasarkan histori kesalahan

### Pomodoro Timer
- Timer fokus dan istirahat yang bisa disesuaikan (1–90 menit)
- Visual circular progress ring
- Musik latar Lo-Fi dan Rain (loop otomatis)
- Sistem goal harian (tomat) dan statistik fokus/istirahat
- State timer tersimpan di server, tidak reset walau tab ditutup

### Akun & Profil
- Statistik menyeluruh: total waktu fokus, streak terbaik, grade rata-rata
- Ganti password dengan verifikasi
- Manajemen sesi login yang aman

---

## Tech Stack

**Frontend**
- HTML5, CSS3, Vanilla JavaScript (tanpa framework)
- Desain mobile-first, responsive di semua ukuran layar

**Backend**
- Python (Flask) dengan struktur Blueprint modular
- SQLAlchemy ORM dan SQLite
- Werkzeug untuk password hashing

**AI & Processing**
- OpenRouter API untuk generate soal quiz
- pdfplumber dan python-docx untuk ekstraksi teks materi

**Keamanan**
- CSRF Protection (Flask-WTF)
- Rate limiting pada endpoint sensitif (Flask-Limiter)
- Validasi file berbasis signature/magic bytes, bukan sekadar ekstensi
- Session cookie hardening (HttpOnly, Secure, SameSite)

**Hosting**
- PythonAnywhere

---

## Struktur Project

```
studyflow/
└── backend/
    ├── app.py                  # Entry point Flask
    ├── models/                 # Model database (User, Material, QuizSession, dll)
    ├── routes/                 # API endpoints per fitur (Blueprint)
    ├── services/                # Logic AI dan ekstraksi file
    ├── static/
    │   ├── css/                # Styling per halaman
    │   ├── js/                 # Logic frontend per halaman
    │   └── audio/               # Musik pomodoro
    └── templates/               # Halaman HTML (Jinja2)
```

---

## Menjalankan di Lokal

```bash
# Clone repo
git clone https://github.com/Blueberrypieee/studyflow.git
cd studyflow/backend

# Setup virtual environment
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Konfigurasi environment
# Buat file .env berisi:
#   SECRET_KEY=
#   FLASK_DEBUG=1
#   OPENROUTER_API_KEY=
#   OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
#   OPENROUTER_MODEL=

# Jalankan
python app.py
```

Buka `http://localhost:5000` di browser.

---

## Status Project

Project ini masih terus dikembangkan. Beberapa hal yang direncanakan ke depannya:
- Notifikasi push untuk Pomodoro (PWA)
- Peningkatan analitik progress belajar

---

## Author

Dibuat oleh **Blueberrypieee** — dikembangkan dari nol sebagai project pembelajaran full-stack, mulai dari desain UI, backend API, integrasi AI, hingga deployment production.

