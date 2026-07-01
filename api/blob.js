import { put, del, get } from '@vercel/blob';

export const runtime = 'nodejs';

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const key = url.searchParams.get('key');
    if (!key) {
      return res.status(400).json({ error: 'Missing key' });
    }
    try {
      const blob = await get(key, { access: 'private' });
      if (!blob) {
        return res.status(200).json({ value: null });
      }
      let value = '';
      if (typeof blob.text === 'function') {
        value = await blob.text();
      } else {
        const stream = blob.stream || blob.blob?.stream;
        value = stream ? await new Response(stream).text() : '';
      }
      return res.status(200).json({ value });
    } catch (e) {
      console.error('api/blob GET error', e);
      return res.status(500).json({ error: 'Storage read failed' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { key, value } = await readJsonBody(req);
      if (!key) {
        return res.status(400).json({ error: 'Missing key' });
      }
      const blob = await put(key, value, { access: 'private', addRandomSuffix: false });
      return res.status(200).json({ url: blob.url });
    } catch (e) {
      return res.status(500).json({ error: 'Storage update failed' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { key } = await readJsonBody(req);
      if (!key) {
        return res.status(400).json({ error: 'Missing key' });
      }
      await del(key);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Storage delete failed' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
