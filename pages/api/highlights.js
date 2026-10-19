// POST /api/highlights
// Body JSON: { text: "[detik] kalimat\n...", from: detikAwal, to: detikAkhir }
// Balasan: { clips: [{start, end, title, score}], keywords: ["kata", ...] }

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM = [
  'Kamu editor klip viral untuk TikTok/Reels/Shorts.',
  'Dari transkrip berformat "[detik] teks", pilih paling banyak 2 segmen yang berdiri sendiri.',
  'Aturan segmen: durasi 15 sampai 45 detik, dimulai dengan hook kuat (pertanyaan, klaim berani, atau cerita), berakhir di akhir kalimat.',
  'Gunakan angka detik persis dari transkrip untuk start dan end.',
  'Beri score 1 sampai 10 untuk potensi viral.',
  'Pilih juga sampai 12 kata kunci (satu kata, huruf kecil) dari segmen terpilih yang pantas ditonjolkan di layar.',
  'Balas HANYA JSON: {"clips":[{"start":0,"end":0,"title":"","score":0}],"keywords":[""]}',
].join(' ');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Gunakan POST' });
    return;
  }
  const key = String(req.headers['x-groq-key'] || process.env.GROQ_API_KEY || '').trim();
  if (!key) {
    res.status(500).json({ error: 'API Key Groq belum diisi. Isi di kolom API Key pada halaman, lalu Simpan.' });
    return;
  }

  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);
    const text = String((body && body.text) || '').slice(0, 12000);
    const from = Number(body && body.from) || 0;
    const to = Number(body && body.to) || 0;
    if (!text.trim()) {
      res.status(400).json({ error: 'Transkrip kosong' });
      return;
    }

    const r = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.GROQ_LLM_MODEL || 'llama-3.1-8b-instant',
        temperature: 0.3,
        max_tokens: 700,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: text },
        ],
      }),
    });

    if (!r.ok) {
      const txt = await r.text();
      const retry = Number(r.headers.get('retry-after')) || 0;
      res.status(r.status).json({ error: 'Groq: ' + txt.slice(0, 300), retryAfter: retry });
      return;
    }

    const data = await r.json();
    let parsed = {};
    try {
      parsed = JSON.parse(data.choices[0].message.content);
    } catch (e) {
      parsed = {};
    }

    const clips = (Array.isArray(parsed.clips) ? parsed.clips : [])
      .map((c) => ({
        start: Number(c.start),
        end: Number(c.end),
        title: String(c.title || 'Momen').slice(0, 80),
        score: Math.max(1, Math.min(10, Number(c.score) || 5)),
      }))
      .filter((c) => isFinite(c.start) && isFinite(c.end) && c.end > c.start)
      .map((c) => {
        if (to > from) {
          c.start = Math.max(from, c.start);
          c.end = Math.min(to, c.end);
        }
        if (c.end - c.start > 60) c.end = c.start + 60;
        return c;
      })
      .filter((c) => c.end - c.start >= 8);

    const keywords = (Array.isArray(parsed.keywords) ? parsed.keywords : [])
      .map((k) => String(k).toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''))
      .filter((k) => k.length > 2)
      .slice(0, 20);

    res.status(200).json({ clips, keywords });
  } catch (err) {
    res.status(500).json({ error: String((err && err.message) || err) });
  }
}

export const config = { maxDuration: 60 };
