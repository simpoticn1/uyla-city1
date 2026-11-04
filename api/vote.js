// Голосование «Что строим первым?»: счётчики в Abacus (бесплатный счётчик без ключа). GET ?op=get | POST {opt}
const NS = 'uyla-city-vote';
const OPTS = ['masjid', 'choyxona', 'bozor', 'stadion'];
async function val(k, hit) {
  const r = await fetch(`https://abacus.jasoncameron.dev/${hit ? 'hit' : 'get'}/${NS}/${k}`);
  if (r.status === 404) return 0; if (!r.ok) throw new Error('counter ' + r.status); const j = await r.json(); return j.value ?? 0;
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (!OPTS.includes(body.opt)) return res.status(400).json({ error: 'bad option' });
      if ((req.headers.cookie || '').includes('tlc_voted=1')) return res.status(409).json({ error: 'already' });
      await val(body.opt, true);
      res.setHeader('Set-Cookie', 'tlc_voted=1; Path=/; Max-Age=31536000; SameSite=Lax; Secure');
    }
    const out = {}; for (const k of OPTS) out[k] = await val(k, false);
    res.status(200).json(out);
  } catch (e) { res.status(502).json({ error: 'counter unavailable' }); }
}
