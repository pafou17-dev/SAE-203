const $ = id => document.getElementById(id);
const labels = { classique: 'Classique', cargo: 'Cargo', pluie: 'Protection pluie' };
const voteForm = $('vote-form'), opinionForm = $('opinion-form');
const apiBase=document.querySelector('meta[name="cycleup-api"]')?.content||'/api/consultation';
const crossSite=new URL(apiBase,document.baseURI).origin!==location.origin;
let pagesVisitor='';
if(crossSite){
  try{const saved=localStorage.getItem('cycleup-pages-visitor');pagesVisitor=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(saved||'')?saved:crypto.randomUUID();localStorage.setItem('cycleup-pages-visitor',pagesVisitor);}
  catch{pagesVisitor=crypto.randomUUID();}
}
let snapshot = null, choice = '', voteBusy = false, opinionBusy = false;
function voteButton() {
  $('vote-submit').disabled = !snapshot || !choice || voteBusy || choice === snapshot.myVote;
  $('vote-submit').textContent = voteBusy ? 'Enregistrement…' : snapshot?.myVote ? (choice === snapshot.myVote ? 'Vote enregistré ✓' : 'Modifier mon vote ↗') : 'Valider mon vote ↗';
  $('vote-instruction').textContent = choice ? `Votre choix : ${labels[choice]}` : 'Sélectionnez un modèle.';
}
function render(data, keepChoice = false) {
  snapshot = data;
  if ((!keepChoice || !choice) && data.myVote) { choice = data.myVote; voteForm.elements.model.value = choice; }
  $('vote-total').textContent = data.total;
  $('vote-total-label').textContent = data.total > 1 ? 'votes exprimés' : 'vote exprimé';
  $('results-note').textContent = data.total ? '' : 'Aucun vote pour le moment.';
  for (const [model, count] of Object.entries(data.counts)) {
    const row = document.querySelector(`[data-result="${model}"]`), percent = data.total ? count / data.total * 100 : 0;
    row.querySelector('[data-percent]').textContent = Math.round(percent) + ' %';
    row.querySelector('.result-fill').style.width = percent + '%';
    row.querySelector('[role="meter"]').setAttribute('aria-valuenow', percent.toFixed(1));
    row.querySelector('[role="meter"]').setAttribute('aria-valuetext', `${count} vote${count > 1 ? 's' : ''} sur ${data.total}, ${Math.round(percent)} %`);
    row.querySelector('.result-count').textContent = count + (count > 1 ? ' votes' : ' vote');
  }
  $('comment-total').textContent = data.commentTotal + (data.commentTotal > 1 ? ' commentaires' : ' commentaire');
  $('comments-empty').hidden = data.comments.length > 0;
  $('comments-empty').textContent = 'Aucun commentaire pour le moment.';
  $('comments-limit').hidden = data.commentTotal <= 30;
  const fragment = document.createDocumentFragment();
  data.comments.forEach(comment => {
    const article = document.createElement('article'); article.className = 'comment-item';
    const meta = document.createElement('div'); meta.className = 'comment-meta';
    const alias = document.createElement('strong'); alias.textContent = comment.alias;
    const time = document.createElement('time'); time.dateTime = new Date(comment.createdAt).toISOString();
    time.textContent = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(comment.createdAt));
    meta.append(alias, time);
    const model = document.createElement('span'); model.className = 'comment-model'; model.textContent = labels[comment.model] ?? 'Les trois versions';
    const text = document.createElement('p'); text.textContent = comment.body;
    article.append(meta, model, text); fragment.append(article);
  });
  $('comments-list').replaceChildren(fragment);
  $('opinion-submit').disabled = opinionBusy;
  voteButton();
}
async function api(path = '', body) {
  const response = await fetch(apiBase + path, { credentials: crossSite?'omit':'same-origin', cache: 'no-store',
    headers:{...(crossSite?{'x-cycleup-visitor':pagesVisitor}:{}),...(body?{'content-type':'application/json'}:{})},
    ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Impossible de joindre le service. Réessayez.');
  return data;
}
async function refresh() {
  $('refresh-results').disabled = true;
  $('results-status').textContent = 'Actualisation…';
  try { render(await api(), true); $('results-status').textContent = ''; $('vote-status').textContent = ''; }
  catch { $('results-status').textContent = 'Les résultats sont indisponibles pour le moment. Réessayez.'; }
  finally { $('refresh-results').disabled = false; }
}
voteForm.addEventListener('change', event => { if (event.target.name === 'model') { choice = event.target.value; $('vote-status').textContent = ''; voteButton(); } });
voteForm.addEventListener('submit', async event => {
  event.preventDefault(); if (!choice || voteBusy || !snapshot) return;
  voteBusy = true; voteButton(); $('vote-status').textContent = '';
  try {
    render(await api('/vote', { model: choice }));
    $('vote-status').textContent = 'Votre vote est enregistré.';
    if (!opinionForm.elements.model.value) opinionForm.elements.model.value = choice;
  } catch (error) { $('vote-status').textContent = error.message; }
  finally { voteBusy = false; voteButton(); }
});
$('opinion-body').addEventListener('input', event => { $('opinion-count').textContent = event.target.value.length.toLocaleString('fr-FR') + ' / 1 200'; });
opinionForm.addEventListener('submit', async event => {
  event.preventDefault(); if (opinionBusy || !snapshot) return;
  opinionBusy = true; $('opinion-submit').disabled = true; $('opinion-submit').textContent = 'Publication…'; $('opinion-status').textContent = '';
  try {
    const fields = new FormData(opinionForm);
    render(await api('/comments', { alias: fields.get('alias'), model: fields.get('model'), body: fields.get('body') }), true);
    opinionForm.elements.body.value = ''; $('opinion-count').textContent = '0 / 1 200';
    $('opinion-status').textContent = 'Votre avis est publié.';
  } catch (error) { $('opinion-status').textContent = error.message; }
  finally { opinionBusy = false; $('opinion-submit').disabled = !snapshot; $('opinion-submit').textContent = 'Publier mon avis ↗'; }
});
$('refresh-results').addEventListener('click', refresh);
document.addEventListener('visibilitychange', () => { if (!document.hidden && snapshot && !voteBusy && !opinionBusy) refresh(); });
try { render(await api()); }
catch { $('results-status').textContent = 'Les résultats sont indisponibles pour le moment. Réessayez.'; $('comments-empty').textContent = 'Les avis sont momentanément indisponibles.'; $('comment-total').textContent = 'Indisponible'; $('vote-status').textContent = 'Service indisponible. Cliquez sur « Actualiser les résultats » pour réessayer.'; }
