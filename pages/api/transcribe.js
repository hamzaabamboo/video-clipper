// POST /api/transcribe?offset=0&lang=id
// Body: potongan audio WAV mentah (Content-Type: application/octet-stream), maks ~4,4 MB.
// Balasan: { words: [{w, s, e}], text } dengan waktu sudah ditambah offset potongan.

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const MAX_BYTES = 4.4 * 1024 * 1024;

function readBody(req) {
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    const parts = [];
    req.on('data', (c) => parts.push(c));
    req.on('end', () => resolve(Buffer.concat(parts)));
    req.on('error', reject);
  });
}

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
    const buf = await readBody(req);
    if (!buf || !buf.length) {
      res.status(400).json({ error: 'Body kosong' });
      return;
    }
    if (buf.length > MAX_BYTES) {
      res.status(413).json({ error: 'Potongan audio terlalu besar, kecilkan durasi potongan' });
      return;
    }

    const offset = Number(req.query && req.query.offset) || 0;
    const lang = (req.query && req.query.lang) || '';

    const form = new FormData();
    form.append('file', new Blob([buf], { type: 'audio/wav' }), 'chunk.wav');
    form.append('model', process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo');
    form.append('response_format', 'verbose_json');
    form.append('temperature', '0');
    form.append('timestamp_granularities[]', 'word');
    form.append('timestamp_granularities[]', 'segment');
    if (lang && lang !== 'auto') form.append('language', lang);

    const r = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key },
      body: form,
    });

    if (!r.ok) {
      const txt = await r.text();
      const retry = Number(r.headers.get('retry-after')) || 0;
      res.status(r.status).json({ error: 'Groq: ' + txt.slice(0, 300), retryAfter: retry });
      return;
    }

    const data = await r.json();
    let words = [];
    if (Array.isArray(data.words) && data.words.length) {
      words = data.words.map((x) => ({ w: String(x.word).trim(), s: x.start + offset, e: x.end + offset }));
    } else if (Array.isArray(data.segments)) {
      // cadangan: bagi rata kata di tiap segmen
      for (const seg of data.segments) {
        const ws = String(seg.text || '').trim().split(/\s+/).filter(Boolean);
        const step = (seg.end - seg.start) / Math.max(1, ws.length);
        ws.forEach((w, i) => {
          words.push({ w, s: seg.start + i * step + offset, e: seg.start + (i + 1) * step + offset });
        });
      }
    }
    words = words.filter((x) => x.w);

    res.status(200).json({ words, text: data.text || '' });
  } catch (err) {
    res.status(500).json({ error: String((err && err.message) || err) });
  }
}

export const config = { maxDuration: 60, api: { bodyParser: false } };
