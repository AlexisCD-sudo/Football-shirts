import { braveUrl, cleanQuery, parseBraveImages } from './_brave';

/**
 * Funció de servidor (Vercel) que cerca imatges amb l'API oficial de Brave Search. La clau BRAVE_API_KEY només
 * existeix aquí (mai arriba al navegador). Només respon a persones amb sessió iniciada (es valida el token de
 * Supabase) i limita la mida de la consulta i el nombre de resultats.
 */
declare const process: { env: Record<string, string | undefined> };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function GET(request: Request): Promise<Response> {
  const brave = process.env.BRAVE_API_KEY;
  if (!brave) return json({ error: 'not_configured' }, 501);

  const supaUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const supaKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  const auth = request.headers.get('authorization');
  if (!supaUrl || !supaKey || !auth?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);
  try {
    const who = await fetch(`${supaUrl.replace(/\/$/, '')}/auth/v1/user`, { headers: { apikey: supaKey, authorization: auth } });
    if (!who.ok) return json({ error: 'unauthorized' }, 401);
  } catch {
    return json({ error: 'auth_unavailable' }, 502);
  }

  const q = cleanQuery(new URL(request.url).searchParams.get('q'));
  if (!q) return json({ error: 'bad_query' }, 400);

  try {
    const res = await fetch(braveUrl(q, 20), { headers: { accept: 'application/json', 'x-subscription-token': brave } });
    if (res.status === 429) return json({ error: 'rate_limited' }, 429);
    if (!res.ok) return json({ error: 'upstream', status: res.status }, 502);
    return json({ results: parseBraveImages(await res.json(), 10) });
  } catch {
    return json({ error: 'upstream' }, 502);
  }
}
