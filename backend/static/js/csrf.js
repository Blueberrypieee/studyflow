/**
 * StudyFlow — csrf.js
 * Auto-inject CSRF token ke semua fetch() POST/PUT/PATCH/DELETE.
 * Cukup include file ini SEBELUM file JS lain di setiap halaman,
 * ga perlu ubah kode fetch yang udah ada di login.js, materials.js, dll.
 */

(function () {
  let csrfToken = null;

  /* ── Ambil token sekali di awal, simpan di memory ──────── */
  async function fetchCsrfToken() {
    try {
      const res  = await fetch('/api/csrf-token');
      const data = await res.json();
      csrfToken  = data.csrfToken;
    } catch (err) {
      console.error('[CSRF] Gagal ambil token:', err);
    }
  }

  /* ── Bungkus fetch bawaan browser ───────────────────────── */
  const originalFetch = window.fetch;

  window.fetch = async function (url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const needsToken = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    // Endpoint token itu sendiri ga perlu token (biar ga infinite loop)
    const isTokenEndpoint = typeof url === 'string' && url.includes('/api/csrf-token');

    if (needsToken && !isTokenEndpoint) {
      // Kalau token belum ada (misal request pertama kali super cepat), ambil dulu
      if (!csrfToken) {
        await fetchCsrfToken();
      }

      options.headers = {
        ...(options.headers || {}),
        'X-CSRFToken': csrfToken,
      };
    }

    const response = await originalFetch(url, options);

    // Kalau server bilang token invalid/expired, refresh token buat request berikutnya
    if (response.status === 400) {
      const clone = response.clone();
      try {
        const data = await clone.json();
        if (data.error && data.error.toLowerCase().includes('sesi')) {
          await fetchCsrfToken();
        }
      } catch (e) { /* bukan JSON, abaikan */ }
    }

    return response;
  };

  // Ambil token pertama kali begitu script ini dimuat
  fetchCsrfToken();
})();
