import assert from 'node:assert/strict';
const base='http://127.0.0.1:8873/api/consultation',origin='https://pafou17-dev.github.io';
const visitor=crypto.randomUUID();
const headers={origin,'x-cycleup-visitor':visitor};
const preflight=await fetch(base+'/vote',{method:'OPTIONS',headers:{origin,'access-control-request-method':'POST','access-control-request-headers':'content-type,x-cycleup-visitor'}});
assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),origin);
assert.match(preflight.headers.get('access-control-allow-headers'),/X-Cycleup-Visitor/);
assert.equal(preflight.headers.get('access-control-allow-credentials'),null);
assert.equal((await fetch(base,{method:'OPTIONS',headers:{origin:'https://elsewhere.invalid'}})).status,403);
async function get(){const r=await fetch(base,{headers});assert.equal(r.headers.get('access-control-allow-origin'),origin);assert.equal(r.headers.get('set-cookie'),null);return r.json();}
async function vote(model){const r=await fetch(base+'/vote',{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({model})});assert.equal(r.status,200);assert.equal(r.headers.get('access-control-allow-origin'),origin);return r.json();}
const start=await get();assert.equal(start.myVote,null);
const first=await vote('classique');assert.equal(first.total,start.total+1);assert.equal((await get()).myVote,'classique');
const changed=await vote('cargo');assert.equal(changed.total,first.total);assert.equal((await get()).myVote,'cargo');
const other=await (await fetch(base,{headers:{origin,'x-cycleup-visitor':crypto.randomUUID()}})).json();assert.equal(other.myVote,null);
const blocked=await fetch(base+'/vote',{method:'POST',headers:{...headers,origin:'https://elsewhere.invalid','content-type':'application/json'},body:JSON.stringify({model:'cargo'})});
assert.equal(blocked.status,403);assert.equal(blocked.headers.get('access-control-allow-origin'),null);
console.log('PASS: Pages preflight, exact allowed origin, no third-party cookies, stable editable vote, shared totals, separate identities and cross-origin rejection. Local database only.');
