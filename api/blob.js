import { put, del, get } from '@vercel/blob';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'GET') {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');
    if (!key) {
      return new Response(JSON.stringify({ error: 'Missing key' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    try {
      const blob = await get(key, { access: 'private' });
      if (!blob) {
        return Response.json({ value: null });
      }
      return Response.json({ value: blob.text });
    } catch (e) {
      return Response.json({ value: null });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { key, value } = await req.json();
      if (!key) {
        return new Response(JSON.stringify({ error: 'Missing key' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      const blob = await put(key, value, { access: 'private', addRandomSuffix: false });
      return Response.json({ url: blob.url });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Storage update failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { key } = await req.json();
      if (!key) {
        return new Response(JSON.stringify({ error: 'Missing key' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      await del(key);
      return Response.json({ ok: true });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Storage delete failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
}
