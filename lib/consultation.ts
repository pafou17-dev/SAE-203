const models = ['classique', 'cargo', 'pluie'];
const cookieName = 'cycleup-visitor';
export const pagesOrigin = 'https://pafou17-dev.github.io';
const json = (data: unknown, status = 200, cookie?: string) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
    'x-content-type-options': 'nosniff', ...(cookie ? { 'set-cookie': cookie } : {}) },
});

export async function consultation(request: Request, db: D1Database): Promise<Response> {
  const url = new URL(request.url);
  const authId = request.headers.get('oai-authenticated-user-id');
  const pagesVisitor = request.headers.get('origin') === pagesOrigin ? request.headers.get('x-cycleup-visitor') : null;
  const validPagesVisitor = pagesVisitor && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(pagesVisitor);
  const existing = request.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
  const validCookie = existing && /^[a-f0-9-]{36}$/.test(existing);
  const visitor = validPagesVisitor ? 'pages:' + pagesVisitor : authId ? 'account:' + authId : 'browser:' + (validCookie ? existing : crypto.randomUUID());
  const cookie = !validPagesVisitor && !authId && !validCookie ? `${cookieName}=${visitor.slice(8)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${url.protocol === 'https:' ? '; Secure' : ''}` : undefined;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(visitor));
  const key = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
  const snapshot = async () => {
    const rows = await db.batch([
      db.prepare('SELECT model, COUNT(*) AS count FROM consultation_votes GROUP BY model'),
      db.prepare('SELECT model FROM consultation_votes WHERE voter_key = ?').bind(key),
      db.prepare("SELECT id, alias, model, body, created_at FROM consultation_comments WHERE status = 'published' ORDER BY created_at DESC, id DESC LIMIT 30"),
      db.prepare("SELECT COUNT(*) AS count FROM consultation_comments WHERE status = 'published'"),
    ]);
    const counts = Object.fromEntries(models.map(model => [model, 0]));
    for (const row of rows[0].results as { model: string; count: number }[]) if (models.includes(row.model)) counts[row.model] = Number(row.count);
    return { counts, total: Object.values(counts).reduce((a, b) => a + b, 0),
      myVote: (rows[1].results[0] as { model?: string } | undefined)?.model ?? null,
      comments: rows[2].results.map((row: any) => ({ id: row.id, alias: row.alias, model: row.model, body: row.body, createdAt: row.created_at })),
      commentTotal: Number((rows[3].results[0] as any)?.count ?? 0) };
  };
  if (request.method === 'GET' && url.pathname === '/api/consultation') return json(await snapshot(), 200, cookie);
  if (request.method !== 'POST') return json({ error: 'Cette action n’est pas disponible.' }, 405, cookie);
  // Consume the request before early validation responses so a keep-alive
  // connection cannot leave an unread body attached to the next request.
  const input = await request.text();
  if (input.length > 8000) return json({ error: 'Votre message est trop long.' }, 413, cookie);
  const origin = request.headers.get('origin');
  if (origin && ![url.origin, pagesOrigin, 'https://rosalie-atelier-3d-paul.pafou17.chatgpt.site'].includes(origin)) return json({ error: 'Origine non autorisée.' }, 403, cookie);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'Format de demande incorrect.' }, 415, cookie);
  let body: any;
  try { body = JSON.parse(input); } catch { return json({ error: 'Demande incorrecte.' }, 400, cookie); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Demande incorrecte.' }, 400, cookie);
  const now = Date.now();
  if (url.pathname === '/api/consultation/vote') {
    if (!models.includes(body.model)) return json({ error: 'Choisissez l’un des trois modèles.' }, 400, cookie);
    await db.prepare('INSERT INTO consultation_votes (voter_key, model, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(voter_key) DO UPDATE SET model = excluded.model, updated_at = excluded.updated_at').bind(key, body.model, now, now).run();
    return json(await snapshot(), 200, cookie);
  }
  if (url.pathname === '/api/consultation/comments') {
    const text = typeof body.body === 'string' ? body.body.trim() : '';
    const alias = typeof body.alias === 'string' ? body.alias.trim() : '';
    const model = body.model || null;
    if (text.length < 12 || text.length > 1200 || alias.length > 50 || (model !== null && !models.includes(model))) return json({ error: 'Écrivez un avis de 12 à 1 200 caractères, avec un pseudonyme de 50 caractères maximum.' }, 400, cookie);
    const recent = await db.prepare('SELECT COUNT(*) AS count FROM consultation_comments WHERE author_key = ? AND created_at > ?').bind(key, now - 600_000).first<{ count: number }>();
    if ((recent?.count ?? 0) >= 5) return json({ error: 'Vous avez déjà publié plusieurs avis. Revenez dans quelques minutes.' }, 429, cookie);
    await db.prepare("INSERT INTO consultation_comments (id, author_key, alias, model, body, status, created_at) VALUES (?, ?, ?, ?, ?, 'published', ?)").bind(crypto.randomUUID(), key, alias || 'Visiteur', model, text, now).run();
    return json(await snapshot(), 201, cookie);
  }
  return json({ error: 'Page introuvable.' }, 404, cookie);
}
