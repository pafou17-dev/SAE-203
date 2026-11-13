import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:8873';
const runId = crypto.randomUUID();
const a = { 'oai-authenticated-user-id': 'cycleup-local-qa-a-' + runId };
const b = { 'oai-authenticated-user-id': 'cycleup-local-qa-b-' + runId };
async function api(path = '', headers = a, body) {
  const response = await fetch(base + '/api/consultation' + path, { headers: { ...headers, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    ...(body !== undefined ? { method: 'POST', body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie') };
}
const start = await api(); assert.equal(start.status, 200); assert.equal(start.data.myVote, null);
const first = await api('/vote', a, { model: 'classique' });
assert.equal(first.status, 200); assert.equal(first.data.total, start.data.total + 1); assert.equal(first.data.myVote, 'classique');
const repeat = await api('/vote', a, { model: 'classique' }); assert.equal(repeat.data.total, first.data.total);
const change = await api('/vote', a, { model: 'cargo' });
assert.equal(change.data.total, first.data.total); assert.equal(change.data.myVote, 'cargo'); assert.equal(change.data.counts.classique, start.data.counts.classique);
const other = await api('/vote', b, { model: 'pluie' }); assert.equal(other.data.total, start.data.total + 2);
const shared = await api('', a); assert.deepEqual(shared.data.counts, other.data.counts); assert.equal(shared.data.myVote, 'cargo');
assert.equal((await api('/vote', a, { model: 'invalide' })).status, 400);
assert.equal((await api('/vote', a, null)).status, 400);
assert.equal((await api('/comments', a, { body: 'court' })).status, 400);
assert.equal((await api('/comments', a, { body: 'a'.repeat(1201) })).status, 400);
assert.equal((await api('/vote', { ...a, origin: 'https://elsewhere.invalid' }, { model: 'cargo' })).status, 403);
const text = 'Essai local : le bac Cargo est pratique. <b>Ce texte reste du texte.</b>';
const comment = await api('/comments', a, { alias: 'Essai local', model: 'cargo', body: text });
assert.equal(comment.status, 201); assert.equal(comment.data.commentTotal, start.data.commentTotal + 1);
const seen = await api('', b), saved = seen.data.comments.find(x => x.body === text);
assert.ok(saved); assert.equal(saved.alias, 'Essai local'); assert.equal(saved.model, 'cargo');
assert.ok(!JSON.stringify(seen.data).includes('author_key')); assert.ok(!JSON.stringify(seen.data).includes('voter_key'));
const anon = await api('', {}); assert.ok(anon.cookie?.includes('HttpOnly')); assert.ok(anon.cookie?.includes('SameSite=Lax'));
const cookie = anon.cookie.split(';')[0];
const anonymousVote = await api('/vote', { cookie }, { model: 'classique' }); assert.equal(anonymousVote.data.total, start.data.total + 3);
assert.equal((await api('', { cookie })).data.myVote, 'classique');
assert.equal((await api('/vote', { cookie }, { model: 'pluie' })).data.total, anonymousVote.data.total);
for (const path of ['/', '/contact/', '/boite-a-idees/', '/assets/journey/rosalie-cargo.png', '/assets/rosalie-cargo.glb']) {
  const r = await fetch(base + path); assert.equal(r.status, 200, path);
}
console.log('PASS: shared totals, one editable vote per identity, cookie persistence, validation, cross-origin rejection, shared plain-text comments, private identifiers withheld, existing pages and 3D assets. Local database only.');
