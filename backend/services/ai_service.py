# services/ai_service.py

import os
import json
import urllib.request
import urllib.error

def generate_quiz(text: str) -> list:
    """
    Kirim teks ke OpenRouter AI → return list 10 soal.
    Format soal:
    [
      {
        "question": "...",
        "options": ["A", "B", "C", "D"],
        "answer": 0  # index jawaban benar (0-based)
      },
      ...
    ]
    """

    api_key  = os.getenv('OPENROUTER_API_KEY')
    base_url = os.getenv('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1')
    model    = os.getenv('OPENROUTER_MODEL', 'mistralai/mistral-7b-instruct:free')

    if not api_key or api_key == 'sk-or-xxxxxxxxxxxxxx':
        print('[AI_SERVICE] API key belum diset!')
        return []

    prompt = f"""Kamu adalah guru yang membuat soal kuis.
Berdasarkan teks berikut, buat 10 soal pilihan ganda dalam Bahasa Indonesia.

Aturan:
- Setiap soal punya 4 pilihan (A, B, C, D)
- Hanya 1 jawaban yang benar
- Soal harus relevan dengan isi teks
- Jawab HANYA dengan JSON, tanpa teks lain

Format JSON yang harus dikembalikan:
[
  {{
    "question": "pertanyaan di sini",
    "options": ["pilihan A", "pilihan B", "pilihan C", "pilihan D"],
    "answer": 0
  }}
]

Teks materi:
{text}

Ingat: jawab HANYA dengan JSON array, tanpa penjelasan tambahan."""

    payload = json.dumps({
        'model': model,
        'max_tokens': 2000,
        'messages': [
            {'role': 'user', 'content': prompt}
        ]
    }).encode('utf-8')

    req = urllib.request.Request(
        f'{base_url}/chat/completions',
        data=payload,
        headers={
            'Content-Type':  'application/json',
            'Authorization': f'Bearer {api_key}',
        },
        method='POST'
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            data     = json.loads(res.read().decode('utf-8'))
            content  = data['choices'][0]['message']['content'].strip()

            print(f'[AI_SERVICE] Raw response: {content[:200]}')

            # Bersihkan markdown kalau ada
            if content.startswith('```'):
                content = content.split('```')[1]
                if content.startswith('json'):
                    content = content[4:]

            questions = json.loads(content)

            # Validasi struktur
            validated = []
            for q in questions:
                if 'question' in q and 'options' in q and 'answer' in q:
                    if len(q['options']) == 4 and isinstance(q['answer'], int):
                        validated.append(q)

            print(f'[AI_SERVICE] Generated {len(validated)} questions')
            return validated

    except urllib.error.HTTPError as e:
        print(f'[AI_SERVICE] HTTP Error: {e.code} {e.reason}')
        return []
    except Exception as e:
        print(f'[AI_SERVICE] Error: {e}')
        return []
