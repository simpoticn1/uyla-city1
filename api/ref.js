// Улучшение домов: друзья, пришедшие по ссылке жителя (?ref=ник), — счётчик в Abacus. GET ?nick= | POST {nick}
const NS = 'my-city-ref';
const key = (n) => 'r-' + String(n).toLowerCase().replace(/[^a-z0-9_]/g, '-').slice(0, 60);
async function val(k, hit) {
  const r = await fetch(`https://abacus.jasoncameron.dev/${hit ? 'hit' : 'get'}/${NS}/${k}`);
  if (r.status === 404) return 0; if (!r.ok) throw new Error('counter ' + r.status); const j = await r.json(); return j.value ?? 0;
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    let nick = req.query?.nick;
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); nick = body.nick;
      if (!/^[A-Za-z0-9._]{1,30}$/.test(nick || '')) return res.status(400).json({ error: 'bad nick' });
      const ck = 'tlc_r_' + key(nick).slice(2, 40);
      if ((req.headers.cookie || '').includes(ck + '=1')) return res.status(200).json({ count: await val(key(nick), false), already: true });
      const count = await val(key(nick), true);
      res.setHeader('Set-Cookie', `${ck}=1; Path=/; Max-Age=31536000; SameSite=Lax; Secure`);
      return res.status(200).json({ count });
    }
    if (!/^[A-Za-z0-9._]{1,30}$/.test(nick || '')) return res.status(400).json({ error: 'bad nick' });
    res.status(200).json({ count: await val(key(nick), false) });
  } catch (e) { res.status(502).json({ error: 'counter unavailable' }); }
}
