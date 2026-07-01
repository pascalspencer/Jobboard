import { put, del, get } from '@vercel/blob';

export const runtime = 'nodejs';

function blobAuthStatus() {
  return {
    hasReadWriteToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    hasOidcToken: Boolean(process.env.VERCEL_OIDC_TOKEN),
    hasBlobStoreId: Boolean(process.env.BLOB_STORE_ID),
  };
}

function hasBlobCredentials() {
  const status = blobAuthStatus();
  return status.hasReadWriteToken || (status.hasOidcToken && status.hasBlobStoreId);
}

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || undefined;
const BLOB_STORE = process.env.BLOB_STORE_ID || undefined;

async function readJsonBody(req) {
  if (req.body) {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
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
      const blob = await get(key, { access: 'public', token: BLOB_TOKEN, storeId: BLOB_STORE });
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
      return res.status(500).json({ error: 'Storage read failed', details: e.message });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { key, value } = await readJsonBody(req);
      if (!key) {
        return res.status(400).json({ error: 'Missing key' });
      }
      const blobValue = typeof value === 'string' ? value : JSON.stringify(value);
      const blob = await put(key, blobValue, { access: 'public', addRandomSuffix: false, token: BLOB_TOKEN, storeId: BLOB_STORE });
      return res.status(200).json({ url: blob?.url || null });
    } catch (e) {
      console.error('api/blob PUT error', e);
      return res.status(500).json({ error: 'Storage update failed', details: e.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { key } = await readJsonBody(req);
      if (!key) {
        return res.status(400).json({ error: 'Missing key' });
      }
      await del(key, { token: BLOB_TOKEN, storeId: BLOB_STORE });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Storage delete failed' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
