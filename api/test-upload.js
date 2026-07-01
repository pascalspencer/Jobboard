import { put } from '@vercel/blob';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const pathname = 'articles/blob.txt';
    const content = 'Hello World! ' + new Date().toISOString();
    const blob = await put(pathname, content, {
      access: 'public',
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      storeId: process.env.BLOB_STORE_ID,
    });
    return res.status(200).json({ ok: true, url: blob?.url || null });
  } catch (e) {
    console.error('api/test-upload error', e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
