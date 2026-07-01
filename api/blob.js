export const runtime = 'nodejs';

let _blobSdk = null;
async function ensureBlobSdk(){
  if(!_blobSdk){
    _blobSdk = await import('@vercel/blob');
  }
  return _blobSdk;
}

// small helpers to call SDK methods
async function blobGet(...args){
  const sdk = await ensureBlobSdk();
  return sdk.get(...args);
}
async function blobPut(...args){
  const sdk = await ensureBlobSdk();
  return sdk.put(...args);
}
async function blobDel(...args){
  const sdk = await ensureBlobSdk();
  return sdk.del(...args);
}

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
const DEBUG = process.env.DEBUG_BLOB_API === 'true';

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
  const invocationId = req.headers['x-vercel-id'] || req.headers['x-now-deployment-id'] || req.headers['x-now-trace-id'];
  if (invocationId) console.error('api/blob invocation id', invocationId);
  if (req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const key = url.searchParams.get('key');
    if (!key) {
      return res.status(400).json({ error: 'Missing key' });
    }
    try {
      const blob = await blobGet(key, { access: 'public', token: BLOB_TOKEN, storeId: BLOB_STORE });
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
      const payload = { error: 'Storage read failed', details: e.message };
      if (DEBUG) payload.stack = e.stack;
      return res.status(500).json(payload);
    }
  }

  if (req.method === 'PUT') {
    try {
      const { key, value } = await readJsonBody(req);
      if (!key) {
        return res.status(400).json({ error: 'Missing key' });
      }
      const blobValue = typeof value === 'string' ? value : JSON.stringify(value);
      const blob = await blobPut(key, blobValue, { access: 'public', addRandomSuffix: false, token: BLOB_TOKEN, storeId: BLOB_STORE });
      return res.status(200).json({ url: blob?.url || null });
    } catch (e) {
      console.error('api/blob PUT error', e);
      const payload = { error: 'Storage update failed', details: e.message };
      if (DEBUG) payload.stack = e.stack;
      return res.status(500).json(payload);
    }
  } else if (req.method === 'DELETE') {
    try {
      const { key } = await readJsonBody(req);
      if (!key) {
        return res.status(400).json({ error: 'Missing key' });
      }
      await blobDel(key, { token: BLOB_TOKEN, storeId: BLOB_STORE });
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('api/blob DELETE error', e);
      const payload = { error: 'Storage delete failed', details: e.message };
      if (DEBUG) payload.stack = e.stack;
      return res.status(500).json(payload);
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
