# services/file_service.py

import pdfplumber
from docx import Document

def extract_text(filepath: str, filetype: str) -> str:
    """
    Baca isi teks dari PDF atau DOCX.
    Return string teks, max 3000 karakter biar ga overflow token AI.
    """
    text = ''

    try:
        if filetype == 'pdf':
            with pdfplumber.open(filepath) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + '\n'
                    if len(text) >= 3000:
                        break

        elif filetype == 'docx':
            doc = Document(filepath)
            for para in doc.paragraphs:
                if para.text.strip():
                    text += para.text + '\n'
                if len(text) >= 3000:
                    break

    except Exception as e:
        print(f'[FILE_SERVICE] Error: {e}')
        return ''

    return text[:3000].strip()
