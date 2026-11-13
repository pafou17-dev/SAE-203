/* ============================================================
   Cycle'Up · Carte interactive — SCRIPT
   Dépend de Leaflet 1.9.4 (dossier lib/), à charger avant ce fichier.

   Utilisation : une div class="cu-carte" avec l'attribut data-cu-carte,
   puis charger lib/leaflet.js, donnees-carte.js, carte.js (dans cet ordre).
   La carte se construit toute seule dans chaque élément [data-cu-carte].

   Pour l'appeler soi-même : CuCarte.init(element, options)
     options.donnees            : données (par défaut window.CU_CARTE_DONNEES)
     options.liens              : { 'rosalie-3d': 'rosalie.html', ... } → ouvre la page au clic
     options.prochainsPassages  : function(arret) → remplace les horaires simulés

   Chaque bouton d'action envoie l'événement « cu-carte:action » (detail : { action, id }).
   ============================================================ */
(function () {
  'use strict';
  var C = { petrole:'#173F46', creme:'#F6F2E8', jaune:'#F2C94C', argile:'#AA4D37', velo:'#2F6F86' };
  var LARGEUR_GRAND_FORMAT = 820;
  var VITESSE_ROSALIE = 12; // km/h
  var PROFILS = { ligne:'car', marche:'foot', rosalie:'bike' };

  var MESSAGES = {
    'itineraire-vers':   'Pour afficher le trajet de démonstration, cliquez sur « Voir l’itinéraire ».',
    'imprimer-horaires': 'Horaires fictifs. Consultez le réseau de transport pour les horaires officiels.',
    'voir-trajets':      'Ces points de covoiturage sont fictifs. Aucun trajet n’est proposé à la réservation.',
    'rosalie-3d':        'La Rosalie en 3D se trouve en haut de cette page.',
    'reserver-rosalie':  'Parcours fictif : la réservation est indisponible dans cette démonstration.'
  };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }
  function hhmm(m) { m = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ' h ' + String(m % 60).padStart(2, '0'); }
  function distance(a, b) { // mètres, formule de haversine
    var R = 6371000, r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function longueur(pts) { var d = 0; for (var i = 1; i < pts.length; i++) d += distance(pts[i - 1], pts[i]); return d; }
  function km(m) { return (m / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' km'; }

  /* ---------- Tracés qui suivent les routes (avec cache et repli en ligne droite) ---------- */
  var cacheRoutes = {};
  function tracer(base, profil, pts) {
    var cle = profil + ':' + pts.map(function (p) { return p[0].toFixed(5) + ',' + p[1].toFixed(5); }).join(';');
    if (cacheRoutes[cle]) return cacheRoutes[cle];
    try { var memo = localStorage.getItem('cu-route:' + cle); if (memo) return (cacheRoutes[cle] = Promise.resolve(JSON.parse(memo))); } catch (e) {}
    if (!base || !window.fetch) return Promise.resolve(null);
    var url = base + '/routed-' + profil + '/route/v1/driving/' + pts.map(function (p) { return p[1] + ',' + p[0]; }).join(';') + '?overview=full&geometries=geojson';
    var ctrl = window.AbortController ? new AbortController() : null;
    var delai = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);
    cacheRoutes[cle] = fetch(url, ctrl ? { signal: ctrl.signal } : {}).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      clearTimeout(delai);
      if (!j || !j.routes || !j.routes[0]) return null;
      // 5 décimales ≈ 1 m : largement assez précis, et le cache est 2 à 3 fois plus léger
      var res = { pts: j.routes[0].geometry.coordinates.map(function (c) { return [+c[1].toFixed(5), +c[0].toFixed(5)]; }), metres: Math.round(j.routes[0].distance) };
      try { localStorage.setItem('cu-route:' + cle, JSON.stringify(res)); } catch (e) {}
      return res;
    }).catch(function () { clearTimeout(delai); return null; });
    return cacheRoutes[cle];
  }

  var GABARIT =
    '<h2 class="cu-sr">Carte des trajets</h2>' +
    '<div class="cu-outils">' +
      '<section class="cu-recherche" aria-label="Rechercher un trajet">' +
        '<form class="cu-trajet" data-cu="form">' +
          '<div class="cu-points" aria-hidden="true"><i></i><b></b><i></i></div>' +
          '<label><span>Départ</span><input data-cu="de" autocomplete="off"></label>' +
          '<button class="cu-inverser" type="button" data-cu="inverser" aria-label="Inverser départ et arrivée"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#173F46" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3"/></svg></button>' +
          '<label><span>Arrivée</span><input data-cu="a" autocomplete="off"></label>' +
        '</form>' +
        '<div class="cu-ligne-outils">' +
          '<button class="cu-btn" type="button" data-cu="itineraire">Voir l’itinéraire</button>' +
          '<button class="cu-btn cu-btn--sec" type="button" data-cu="proche">Arrêt le plus proche</button>' +
        '</div>' +
        '<div class="cu-ligne-outils"><div class="cu-filtres" role="group" aria-label="Afficher sur la carte" data-cu="filtres"></div></div>' +
        '<div class="cu-ligne-outils">' +
          '<div class="cu-zones" role="group" aria-label="Aller à" data-cu="zones"></div>' +
          '<div class="cu-bascule" role="group" aria-label="Affichage">' +
            '<button type="button" data-cu="vue-carte" aria-pressed="true">Carte</button>' +
            '<button type="button" data-cu="vue-liste" aria-pressed="false">Liste</button>' +
          '</div>' +
        '</div>' +
      '</section>' +
      '<div class="cu-lateral" data-cu="lateral"></div>' +
    '</div>' +
    '<div class="cu-scene" data-cu="scene">' +
      '<div class="cu-plan" data-cu="plan" role="application" aria-label="Carte des arrêts et des Rosalies. Touche Tab pour parcourir les points, Entrée pour ouvrir une fiche, flèches pour déplacer la carte."></div>' +
      '<div class="cu-legende" aria-hidden="true"><b>Démonstration</b>Lignes, horaires et disponibilités fictifs.</div>' +
      '<div class="cu-controles">' +
        '<button type="button" data-cu="zoom-plus" aria-label="Zoomer">+</button>' +
        '<button type="button" data-cu="zoom-moins" aria-label="Dézoomer">−</button>' +
        '<button type="button" data-cu="localiser" aria-label="Me localiser"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#173F46" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2" fill="#173F46"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg></button>' +
      '</div>' +
      '<div class="cu-liste" data-cu="liste" hidden></div>' +
      '<section class="cu-fiche" data-cu="fiche" hidden aria-live="polite" aria-label="Détail"></section>' +
      '<div class="cu-message" data-cu="message" role="status" hidden></div>' +
    '</div>';

  function init(racine, options) {
    options = options || {};
    var D = options.donnees || window.CU_CARTE_DONNEES;
    if (!racine || !D) { console.warn('[Cycle’Up carte] Élément ou données manquants (donnees-carte.js chargé avant carte.js ?)'); return null; }
    if (!window.L) { console.warn('[Cycle’Up carte] Leaflet manquant : charger lib/leaflet.js avant carte.js.'); racine.textContent = 'La carte ne peut pas s’afficher. Rechargez la page.'; return null; }
    if (racine._cuCarte) return racine._cuCarte;

    racine.classList.add('cu-carte');
    racine.innerHTML = GABARIT;
    var $ = function (nom) { return racine.querySelector('[data-cu="' + nom + '"]'); };
    var L = D.lignes, ARRETS = D.arrets, AUTRES = D.autres || [], ROSALIES = D.rosalies || [];
    var reduit = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var etat = { couches: { bus:true, lio:true, velo:true, covoit:true, rosalie:true }, sel: null, vue: 'carte', moi: null };
    var fiche = $('fiche'), liste = $('liste');
    var minuteur = 0, msgMinuteur = 0, busMinuteur = 0;

    $('de').value = D.depart.nom; $('a').value = D.arrivee.nom;
    var PAR_ID = {}; ARRETS.concat(AUTRES, ROSALIES).forEach(function (o) { PAR_ID[o.id] = o; });
    function arret(id) { return PAR_ID[id]; }
    function point(p) { return p === 'depart' ? D.depart.pos : p === 'arrivee' ? D.arrivee.pos : typeof p === 'string' ? arret(p).pos : p; }
    function couche(k) { return k === 'L960' ? 'lio' : 'bus'; }

    /* ---------- Carte Leaflet ---------- */
    var Z = D.zones && D.zones[0] || { centre: D.depart.pos, zoom: 13 };
    var carte = window.L.map($('plan'), { zoomControl:false, keyboard:true, zoomSnap:0.5, scrollWheelZoom:false, preferCanvas:true, fadeAnimation:!reduit, zoomAnimation:!reduit, markerZoomAnimation:!reduit })
      .setView(Z.centre, Z.zoom);
    /* Fonds de carte (sans clé API) : sélecteur + bascule automatique si un fond ne répond pas. */
    var FONDS = D.fonds || (D.fond ? [D.fond] : []);
    var couchesFond = FONDS.map(function (f) {
      // updateWhenZooming:false : pas de téléchargement de tuiles intermédiaires pendant le zoom
      var c = window.L.tileLayer(f.url, { subdomains:f.sousDomaines || 'abc', attribution:f.attribution, maxZoom:f.zoomMax || 19, referrerPolicy:'strict-origin-when-cross-origin', updateWhenZooming:false });
      c._cuOk = 0; c._cuKo = 0;
      c.on('tileload', function () { c._cuOk++; });
      c.on('tileerror', function () {
        c._cuKo++;
        if (c._cuOk === 0 && c._cuKo === 4 && carte.hasLayer(c)) {
          var i = couchesFond.indexOf(c), suivant = couchesFond[i + 1];
          if (suivant) { carte.removeLayer(c); suivant.addTo(carte); message('Le fond « ' + FONDS[i].nom + ' » ne répond pas : passage au fond « ' + FONDS[i + 1].nom + ' ».'); }
          else message('Le fond de carte ne se charge pas. Vérifiez la connexion internet.');
        }
      });
      return c;
    });
    if (couchesFond.length) {
      var depuisFichier = location.protocol === 'file:';
      var iFond = 0;
      if (depuisFichier) FONDS.some(function (f, i) { if (f.marcheFichier) { iFond = i; return true; } });
      couchesFond[iFond].addTo(carte);
      if (couchesFond.length > 1) {
        var choix = {};
        FONDS.forEach(function (f, i) { choix[f.nom] = couchesFond[i]; });
        window.L.control.layers(choix, null, { position:'bottomleft', collapsed:true }).addTo(carte);
      }
    }
    // Molette : zoom seulement avec Ctrl / Cmd (sinon la page défile normalement)
    $('plan').addEventListener('wheel', function (e) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault(); carte.setZoom(carte.getZoom() + (e.deltaY > 0 ? -0.5 : 0.5));
    }, { passive:false });
    $('zoom-plus').onclick = function () { carte.zoomIn(); };
    $('zoom-moins').onclick = function () { carte.zoomOut(); };

    /* ---------- Calques et marqueurs ----------
       Tout est créé UNE fois. Ensuite on ne fait qu'ajouter / retirer des calques (filtres)
       et changer une classe (sélection) : aucun marqueur n'est reconstruit. */
    var G = {}; ['bus','lio','rosalie','arrets','velo','covoit','trajet','repere'].forEach(function (k) { G[k] = window.L.layerGroup(); });
    G.trajet.addTo(carte); G.repere.addTo(carte);
    var ICONES = {};
    function icone(classe, html, taille, ancre) {
      var cle = classe + '|' + html + '|' + taille;
      return ICONES[cle] || (ICONES[cle] = window.L.divIcon({ className:'cu-m ' + classe, html:html, iconSize:taille, iconAnchor:ancre || [taille[0] / 2, taille[1] / 2] }));
    }
    var MARQUEURS = {}; // id → marqueur cliquable (pour la sélection)
    function marqueur(pos, ic, titre, groupe, fn, id, options) {
      var o = { icon:ic, keyboard:!!fn, title:titre, riseOnHover:!!fn, interactive:!!fn };
      for (var k in options) o[k] = options[k];
      var m = window.L.marker(pos, o);
      // L'élément HTML est recréé à chaque affichage : on remet l'accessibilité et la sélection à ce moment-là
      m.on('add', function () {
        var e = m.getElement(); if (!e) return;
        if (fn) {
          e.setAttribute('aria-label', titre);
          // Entrée ou Espace ouvre la fiche (accessibilité clavier)
          e.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); fn(); } });
        } else e.setAttribute('aria-hidden', 'true');
        if (id) e.classList.toggle('cu-m--choisi', !!(etat.sel && etat.sel.id === id));
      });
      if (fn) m.on('click', fn);
      if (id) MARQUEURS[id] = m;
      return m.addTo(groupe);
    }

    // Lignes de bus : tracé droit, remplacé par le tracé routier dès qu'il arrive
    var traceLignes = {};
    Object.keys(L).forEach(function (k) {
      var pts = L[k].arrets.map(function (id) { return arret(id).pos; });
      var dessous = window.L.polyline(pts, { color:'#fff', weight:9, opacity:.9, interactive:false }).addTo(G[couche(k)]);
      var dessus = window.L.polyline(pts, { color:L[k].couleur, weight:5, opacity:.95, interactive:false }).addTo(G[couche(k)]);
      traceLignes[k] = { dessous:dessous, dessus:dessus, pts:pts, cumul:cumuler(pts) };
      tracer(D.routage, PROFILS.ligne, pts).then(function (r) { if (r) { dessous.setLatLngs(r.pts); dessus.setLatLngs(r.pts); traceLignes[k].pts = r.pts; traceLignes[k].cumul = cumuler(r.pts); } });
    });
    // Rosalies : tracé à vélo + relais de départ + point d'arrivée
    var traceRosalies = {};
    ROSALIES.forEach(function (r) {
      var pts = r.etapes.map(function (e) { return e.pos; });
      var contour = window.L.polyline(pts, { color:C.petrole, weight:9, opacity:.55, interactive:false }).addTo(G.rosalie);
      var ligne = window.L.polyline(pts, { color:C.jaune, weight:5, opacity:1, dashArray:'10 8', interactive:false }).addTo(G.rosalie);
      traceRosalies[r.id] = { contour:contour, ligne:ligne, metres:longueur(pts) * 1.25, pts:pts };
      tracer(D.routage, PROFILS.rosalie, pts).then(function (res) { if (res) { contour.setLatLngs(res.pts); ligne.setLatLngs(res.pts); traceRosalies[r.id].metres = res.metres; traceRosalies[r.id].pts = res.pts; } });
      marqueur(r.etapes[0].pos, icone('cu-m-rosalie', '<span>R' + r.numero + '</span>', [34, 34]),
        'Rosalie ' + r.numero + ' : ' + r.nom + ', ' + r.disponibles + ' disponible' + (r.disponibles > 1 ? 's' : ''), G.rosalie, function () { ouvrirRosalie(r); }, r.id, { zIndexOffset:400 });
      var fin = r.etapes[r.etapes.length - 1];
      if (distance(fin.pos, r.etapes[0].pos) > 50) marqueur(fin.pos, icone('cu-m-fin', '<span></span>', [16, 16]), 'Arrivée de la Rosalie ' + r.numero + ' : ' + fin.nom, G.rosalie, null, null, { zIndexOffset:400 });
    });
    AUTRES.forEach(function (o) {
      if (o.type === 'velo') marqueur(o.pos, icone('cu-m-velo' + (o.velos ? '' : ' cu-m-velo--vide'), '<span>' + o.velos + '</span>', [30, 30]), o.nom + ', ' + o.velos + ' vélos disponibles', G.velo, function () { ouvrirAutre(o); }, o.id);
      else marqueur(o.pos, icone('cu-m-covoit', '<span>CV</span>', [32, 32]), o.nom, G.covoit, function () { ouvrirAutre(o); }, o.id);
    });
    ARRETS.forEach(function (s) {
      var t = s.important ? 24 : 18;
      s._m = marqueur(s.pos, icone('cu-m-arret' + (s.important ? ' cu-m-arret--pole' : ''), '<span></span>', [t, t]),
        'Arrêt ' + s.nom + ', lignes ' + s.lignes.map(function (k) { return L[k].nom; }).join(' et '), G.arrets, function () { ouvrirArret(s); }, s.id);
    });
    G.arrets.clearLayers(); // les arrêts sont ajoutés selon les filtres, dans filtrer()
    [[D.depart, 'cu-m-depart'], [D.arrivee, 'cu-m-arrivee']].forEach(function (r) {
      marqueur(r[0].pos, icone(r[1], '<span></span>', [28, 36], [14, 34]), '', G.repere);
    });
    var moiMarqueur = null;

    // Filtres : on ajoute / retire des calques entiers
    function filtrer() {
      ['bus','lio','rosalie','velo','covoit'].forEach(function (k) {
        if (etat.couches[k]) { if (!carte.hasLayer(G[k])) G[k].addTo(carte); } else carte.removeLayer(G[k]);
      });
      ARRETS.forEach(function (s) {
        var visible = s.lignes.some(function (k) { return etat.couches[couche(k)]; });
        if (visible !== G.arrets.hasLayer(s._m)) { if (visible) G.arrets.addLayer(s._m); else G.arrets.removeLayer(s._m); }
      });
      if (!carte.hasLayer(G.arrets)) G.arrets.addTo(carte);
      if (busMarqueur) { if (etat.couches.bus) G.repere.addLayer(busMarqueur); else G.repere.removeLayer(busMarqueur); }
      if (etat.couches.rosalie) G.rosalie.eachLayer(function (l) { if (l.bringToFront) l.bringToFront(); }); // Rosalies au-dessus des bus
    }
    // Sélection : une classe sur l'ancien et le nouveau marqueur, et l'opacité des tracés
    var selPrecedente = null;
    function selectionner(sel) {
      if (selPrecedente && MARQUEURS[selPrecedente] && MARQUEURS[selPrecedente].getElement()) MARQUEURS[selPrecedente].getElement().classList.remove('cu-m--choisi');
      etat.sel = sel; selPrecedente = sel && sel.id;
      var m = selPrecedente && MARQUEURS[selPrecedente];
      if (m && m.getElement()) m.getElement().classList.add('cu-m--choisi');
      var rosalie = sel && sel.type === 'rosalie';
      Object.keys(traceLignes).forEach(function (k) { traceLignes[k].dessus.setStyle({ opacity: rosalie ? .35 : .95 }); });
      ROSALIES.forEach(function (r) {
        var choisie = rosalie && sel.id === r.id, autre = rosalie && !choisie, t = traceRosalies[r.id];
        t.contour.setStyle({ opacity: autre ? .15 : .55, weight: choisie ? 12 : 9 });
        t.ligne.setStyle({ opacity: autre ? .35 : 1, weight: choisie ? 7 : 5 });
        if (choisie) { t.contour.bringToFront(); t.ligne.bringToFront(); }
      });
    }

    /* ---------- Bus « simulé » simulé sur la première ligne temps réel ---------- */
    // Distances cumulées calculées une fois par tracé (et non à chaque image)
    function cumuler(pts) { var c = [0]; for (var i = 1; i < pts.length; i++) c.push(c[i - 1] + distance(pts[i - 1], pts[i])); return c; }
    function le_long(t, c) {
      var pts = t.pts, cu = t.cumul, cible = c * cu[cu.length - 1], lo = 1, hi = cu.length - 1;
      while (lo < hi) { var mid = (lo + hi) >> 1; if (cu[mid] < cible) lo = mid + 1; else hi = mid; } // recherche dichotomique
      var d = cu[lo] - cu[lo - 1], r = d ? (cible - cu[lo - 1]) / d : 0;
      return [pts[lo - 1][0] + (pts[lo][0] - pts[lo - 1][0]) * r, pts[lo - 1][1] + (pts[lo][1] - pts[lo - 1][1]) * r];
    }
    var ligneDirecte = Object.keys(L).filter(function (k) { return L[k].direct; })[0], busMarqueur = null, tBus = 0.2;
    if (ligneDirecte) {
      var tl = traceLignes[ligneDirecte];
      busMarqueur = window.L.marker(le_long(tl, tBus), { icon:icone('cu-m-bus', '<span style="background:' + esc(L[ligneDirecte].couleur) + '">' + esc(L[ligneDirecte].nom) + '</span>', [38, 24]), keyboard:false, interactive:false, zIndexOffset:500 });
      busMarqueur.on('add', function () { busMarqueur.getElement().setAttribute('aria-hidden', 'true'); });
      // Animation en pause quand l'onglet est caché ou la carte hors de l'écran
      if (!reduit) busMinuteur = setInterval(function () {
        if (document.hidden || !visibleEcran || !carte.hasLayer(busMarqueur)) return;
        tBus = (tBus + 0.004) % 1; busMarqueur.setLatLng(le_long(tl, tBus));
      }, 400);
    }
    var visibleEcran = true, vigie = null;
    if (window.IntersectionObserver) { vigie = new IntersectionObserver(function (e) { visibleEcran = e[0].isIntersecting; }); vigie.observe(racine); }

    /* ---------- Horaires (simulés à partir de l'heure actuelle) ---------- */
    function passagesSimules(s) {
      var now = new Date(), mins = now.getHours() * 60 + now.getMinutes(), res = [];
      s.lignes.forEach(function (k, li) {
        var ligne = L[k], idx = Math.max(0, ligne.arrets.indexOf(s.id));
        var decalage = (idx * 4 + li * 7 + k.length * 3) % ligne.freq;
        for (var t = 0; t < 3; t++) {
          var m = Math.ceil((mins - decalage) / ligne.freq) * ligne.freq + decalage + t * ligne.freq;
          if (m < mins) m += ligne.freq;
          var retard = (ligne.direct && t === 0) ? 2 : 0;
          res.push({ ligne:k, attente:m - mins + retard, heure:m + retard, direct:ligne.direct && t < 2, retard:retard, vers:(s.vers && s.vers[k]) || ligne.libelle });
        }
      });
      return res.sort(function (a, b) { return a.attente - b.attente; }).slice(0, 4);
    }
    var prochains = options.prochainsPassages || passagesSimules;

    /* ---------- Fiche ---------- */
    function badge(k) { return '<span class="cu-badge" style="--c:' + esc(L[k].couleur) + '">' + esc(L[k].nom) + '</span>'; }
    function bouton(texte, action, id, secondaire) { return '<button class="cu-btn' + (secondaire ? ' cu-btn--sec' : '') + '" type="button" data-action="' + action + '" data-id="' + esc(id || '') + '">' + esc(texte) + '</button>'; }
    function large() { return racine.classList.contains('cu-carte--large'); }
    function montrer(pos, zoom) { // centre le point en tenant compte de la fiche en bas sur mobile
      carte.setView(pos, Math.max(carte.getZoom(), zoom || 14), { animate:!reduit });
      if (!large() && !fiche.hidden) carte.panBy([0, Math.round(fiche.offsetHeight / 2)], { animate:false });
    }
    function cadrer(pts) {
      var b = window.L.latLngBounds(pts);
      var bas = (!large() && !fiche.hidden) ? fiche.offsetHeight + 20 : 40;
      carte.fitBounds(b, { paddingTopLeft:[40, 60], paddingBottomRight:[70, bas], maxZoom:15, animate:!reduit });
    }
    function afficher(html) {
      fiche.innerHTML = '<div class="cu-poignee" aria-hidden="true"></div><button class="cu-fermer" type="button" aria-label="Fermer">×</button>' + html;
      fiche.hidden = false; racine.classList.add('cu-carte--fiche');
      fiche.querySelector('.cu-fermer').onclick = fermer;
      var h = fiche.querySelector('h3'); if (h) { h.tabIndex = -1; h.focus({ preventScroll:true }); }
      fiche.scrollTop = 0;
      setTimeout(function () { carte.invalidateSize(); }, 0);
    }
    function fermer() {
      fiche.hidden = true; racine.classList.remove('cu-carte--fiche');
      selectionner(null); G.trajet.clearLayers();
      setTimeout(function () { carte.invalidateSize(); }, 0);
    }
    function passages(s) {
      return prochains(s).map(function (x) {
        return '<li>' + badge(x.ligne) + '<span class="cu-dir">' + esc(x.vers) + '<small>' +
          (x.direct ? '<span class="cu-direct">Simulation</span>' + (x.retard ? ' · retard ' + x.retard + ' min' : '') : '<span class="cu-prevu">Horaire simulé</span>') +
          '</small></span><span class="cu-min">' + (x.attente <= 1 ? 'à l’arrêt' : x.attente + ' min') + '<small>' + hhmm(x.heure) + '</small></span></li>';
      }).join('');
    }
    function ouvrirArret(s, proche) {
      selectionner({ type:'arret', id:s.id }); G.trajet.clearLayers();
      var lis = passages(s);
      var aPied = Math.round(distance(etat.moi || D.depart.pos, s.pos) * 1.3 / 80);
      afficher('<h3>' + esc(s.nom) + '</h3><p class="cu-sous-titre">Arrêt de bus · ' + (proche ? '<strong>le plus proche</strong>, ' : '') + 'à ' + (aPied < 60 ? aPied + ' min à pied' : km(distance(etat.moi || D.depart.pos, s.pos))) + (etat.moi ? ' de vous' : ' du point de départ') + '</p>' +
        '<div class="cu-lignes">' + s.lignes.map(badge).join('') + '</div>' +
        '<ul class="cu-passages" aria-label="Prochains passages">' + lis + '</ul>' +
        '<div class="cu-infos"><div><b>Accès fauteuil</b>' + (s.pmr ? 'Oui, quai accessible' : 'Non renseigné') + '</div>' +
        '<div><b>Fréquence</b>' + s.lignes.map(function (k) { return esc(L[k].nom) + ' : toutes les ' + L[k].freq + ' min'; }).join('<br>') + '</div></div>' +
        '<div class="cu-actions">' + bouton('Itinéraire jusqu’ici', 'itineraire-vers', s.id) + bouton('À propos des horaires', 'imprimer-horaires', s.id, true) + '</div>' +
        '<p class="cu-note">Positions et horaires fictifs.</p>');
      if (proche) cadrer([etat.moi || D.depart.pos, s.pos]); else montrer(s.pos, 15);
    }
    function ouvrirAutre(o) {
      selectionner({ type:o.type, id:o.id }); G.trajet.clearLayers();
      if (o.type === 'velo') afficher('<h3>' + esc(o.nom) + '</h3><p class="cu-sous-titre">Vélos en libre-service</p>' +
        '<div class="cu-infos"><div><b>Vélos disponibles</b><span class="cu-grand">' + o.velos + '</span></div><div><b>Places libres</b><span class="cu-grand">' + (o.places - o.velos) + '</span></div></div>' +
        '<p>' + (o.velos ? '<span class="cu-direct">Simulation</span> · disponibilités fictives' : 'Aucun vélo dans cette station fictive.') + '</p>' +
        '<div class="cu-actions">' + bouton('Itinéraire jusqu’ici', 'itineraire-vers', o.id) + '</div><p class="cu-note">Formule Bus + vélo, 6 € par mois (tarif fictif).</p>');
      else afficher('<h3>' + esc(o.nom) + '</h3><p class="cu-sous-titre">Point de rendez-vous de covoiturage</p>' +
        '<div class="cu-infos"><div><b>Places</b>24 places, éclairé</div><div><b>Trajets simulés</b>3 conducteurs vers Tarbes</div></div>' +
        '<div class="cu-actions">' + bouton('Voir les trajets', 'voir-trajets', o.id) + '</div>');
      montrer(o.pos, 15);
    }
    function ouvrirRosalie(r) {
      selectionner({ type:'rosalie', id:r.id }); G.trajet.clearLayers();
      var t = traceRosalies[r.id], minutes = Math.round(t.metres / 1000 / VITESSE_ROSALIE * 60);
      var etapes = r.etapes.map(function (e, i) {
        var dernier = i === r.etapes.length - 1;
        return '<li style="--lc:' + C.jaune + '"><span class="cu-num' + (i === 0 || dernier ? '' : ' cu-num--pied') + '">' + (i + 1) + '</span><span class="cu-etape">' + esc(e.nom) +
          '<small>' + (i === 0 ? 'Départ · relais Rosalie' : dernier ? 'Arrivée' : 'Arrêt possible') + '</small></span><span class="cu-heure"></span></li>';
      }).join('');
      afficher('<h3>Rosalie ' + r.numero + ' · ' + esc(r.nom) + '</h3>' +
        '<p class="cu-sous-titre">Véhicule à pédales partagé · ' + esc(r.usage) + ' · parcours fictif</p>' +
        '<div class="cu-infos"><div><b>Parcours</b>≈ ' + km(t.metres) + ' · ≈ ' + minutes + ' min</div><div><b>Disponibles</b>' + r.disponibles + ' sur ' + r.places + ' places</div></div>' +
        '<ol class="cu-etapes" aria-label="Itinéraire de la Rosalie ' + r.numero + '">' + etapes + '</ol>' +
        '<div class="cu-infos cu-infos--1"><div><b>Horaires</b>' + esc(r.horaires) + '</div></div>' +
        '<div class="cu-actions">' + bouton('Réserver une place', 'reserver-rosalie', r.id) + bouton('Voir la Rosalie en 3D', 'rosalie-3d', r.id, true) + '</div>' +
        '<p class="cu-note">Parcours et horaires fictifs.</p>');
      cadrer(t.pts);
    }
    function ouvrirTrajet() {
      selectionner({ type:'trajet' }); G.trajet.clearLayers();
      var T = D.trajet, etapes = T.etapes, iLigne = -1, tousPts = [];
      etapes.forEach(function (e) {
        if (!e.points) return;
        var pts = e.points.map(point); tousPts = tousPts.concat(pts);
        var estLigne = e.type === 'ligne';
        var fond = window.L.polyline(pts, estLigne ? { color:C.jaune, weight:16, opacity:.7, interactive:false } : { color:C.petrole, weight:4, dashArray:'2 9', lineCap:'round', interactive:false }).addTo(G.trajet);
        var dessus = estLigne ? window.L.polyline(pts, { color:L[e.ligne].couleur, weight:5, interactive:false }).addTo(G.trajet) : null;
        tracer(D.routage, estLigne ? PROFILS.ligne : PROFILS.marche, pts).then(function (r) { if (r && etat.sel && etat.sel.type === 'trajet') { fond.setLatLngs(r.pts); if (dessus) dessus.setLatLngs(r.pts); } });
      });
      etapes.some(function (e, i) { if (e.type === 'ligne' && e.arret) { iLigne = i; return true; } return false; });
      var now = new Date(), maintenant = now.getHours() * 60 + now.getMinutes(), t = maintenant + 5;
      if (iLigne >= 0) {
        var dep = prochains(arret(etapes[iLigne].arret)).filter(function (x) { return x.ligne === etapes[iLigne].ligne; })[0];
        var avant = 0; for (var j = 0; j < iLigne; j++) avant += etapes[j].minutes || 0;
        if (dep) { t = dep.heure - avant; if (t < maintenant) t += L[etapes[iLigne].ligne].freq; }
      }
      var debut = t, nb = 0;
      var lis = etapes.map(function (e, i) {
        var h = t; t += e.minutes || 0;
        if (e.type === 'correspondance') nb++;
        var estLigne = e.type === 'ligne';
        var libelle = estLigne ? badge(e.ligne) + ' ' + esc(e.vers) + ' ' + (e.direct ? '<span class="cu-direct">Simulation</span>' : '<span class="cu-prevu">Horaire simulé</span>') : esc(e.titre);
        return '<li' + (estLigne ? ' style="--lc:' + esc(L[e.ligne].couleur) + '"' : '') + '><span class="cu-num' + (estLigne ? '' : ' cu-num--pied') + '">' + (i + 1) + '</span>' +
          '<span class="cu-etape">' + libelle + '<small>' + esc(e.detail) + '</small></span><span class="cu-heure">' + hhmm(e.type === 'arrivee' ? t : h) + '</span></li>';
      }).join('');
      afficher('<h3>' + esc($('de').value) + ' → ' + esc($('a').value) + '</h3>' +
        '<p class="cu-sous-titre">Partir à ' + hhmm(debut) + ' · arrivée ' + hhmm(t) + ' · ' + (t - debut) + ' min · ' + nb + ' correspondance' + (nb > 1 ? 's' : '') + '</p>' +
        '<ol class="cu-etapes">' + lis + '</ol>' +
        '<div class="cu-infos"><div><b>Si vous ratez le bus</b>' + esc(T.planB) + '</div><div><b>Prix</b>' + esc(T.prix) + '</div></div>' +
        '<p class="cu-note">Trajet fictif pour une étudiante de Séméac.</p>');
      cadrer(tousPts);
    }
    function arretProche() {
      var ref = etat.moi || D.depart.pos;
      return ARRETS.filter(function (s) { return s.lignes.some(function (k) { return etat.couches[couche(k)]; }); })
        .sort(function (a, b) { return distance(ref, a.pos) - distance(ref, b.pos); })[0];
    }

    /* ---------- Actions ---------- */
    function action(nom, id) {
      var continuer = racine.dispatchEvent(new CustomEvent('cu-carte:action', { bubbles:true, cancelable:true, detail:{ action:nom, id:id } }));
      if (options.liens && options.liens[nom]) { window.location.href = options.liens[nom]; return; }
      if (continuer) message(MESSAGES[nom] || nom);
    }
    racine.addEventListener('click', function (e) {
      var b = e.target.closest('[data-action]');
      if (b && racine.contains(b)) action(b.getAttribute('data-action'), b.getAttribute('data-id'));
    });
    function message(m) {
      var el = $('message'); el.textContent = m; el.hidden = false;
      clearTimeout(msgMinuteur); msgMinuteur = setTimeout(function () { el.hidden = true; }, 3500);
    }

    /* ---------- Recherche, position ---------- */
    $('itineraire').onclick = ouvrirTrajet;
    $('form').addEventListener('submit', function (e) { e.preventDefault(); ouvrirTrajet(); });
    $('proche').onclick = function () { var p = arretProche(); if (p) ouvrirArret(p, true); };
    $('inverser').onclick = function () { var a = $('de'), b = $('a'), t = a.value; a.value = b.value; b.value = t; };
    $('localiser').onclick = function () {
      if (!navigator.geolocation) { message('La localisation n’est pas disponible sur cet appareil.'); return; }
      message('Recherche de votre position… Elle n’est pas enregistrée.');
      navigator.geolocation.getCurrentPosition(function (p) {
        etat.moi = [p.coords.latitude, p.coords.longitude];
        if (moiMarqueur) moiMarqueur.setLatLng(etat.moi); else moiMarqueur = marqueur(etat.moi, icone('cu-m-moi', '<span></span>', [20, 20]), 'Votre position', G.repere);
        montrer(etat.moi, 14);
        message('Position trouvée. Les arrêts sont maintenant classés depuis votre position.');
      }, function () { message('Position indisponible. Le départ de démonstration à Séméac est conservé.'); }, { timeout:10000, maximumAge:60000 });
    };

    /* ---------- Filtres et zones ---------- */
    [['bus','Bus TLP',C.petrole],['rosalie','Rosalies',C.jaune],['velo','Vélos',C.velo],['lio','liO','#5B7F3A'],['covoit','Covoiturage','#fff']].forEach(function (f) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'cu-filtre'; b.setAttribute('aria-pressed', 'true');
      b.innerHTML = '<i style="--c:' + f[2] + '"></i>' + f[1];
      b.onclick = function () { etat.couches[f[0]] = !etat.couches[f[0]]; b.setAttribute('aria-pressed', String(etat.couches[f[0]])); filtrer(); if (etat.vue === 'liste') remplirListe(); };
      $('filtres').appendChild(b);
    });
    (D.zones || []).forEach(function (z) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'cu-zone'; b.textContent = z.nom;
      b.onclick = function () { carte.setView(z.centre, z.zoom, { animate:!reduit }); };
      $('zones').appendChild(b);
    });

    /* ---------- Liste ---------- */
    function remplirListe() {
      var ref = etat.moi || D.depart.pos;
      var arrets = ARRETS.filter(function (s) { return s.lignes.some(function (k) { return etat.couches[couche(k)]; }); })
        .map(function (s) { return { s:s, p:prochains(s)[0], d:distance(ref, s.pos) }; })
        .sort(function (a, b) { return a.d - b.d; });
      var html = '<h3>Arrêts et prochains passages</h3>' + arrets.map(function (r) {
        var noms = r.s.lignes.map(function (k) { return L[k].nom; });
        return '<button class="cu-element" type="button" data-arret="' + esc(r.s.id) + '"><span class="cu-pastille">' + esc(noms.join(' ')) + '</span>' +
          '<span class="cu-nom">' + esc(r.s.nom) + '<small>à ' + km(r.d) + ' · Lignes ' + esc(noms.join(', ')) + '</small></span>' +
          '<span class="cu-suivant">' + r.p.attente + ' min<small>' + (r.p.direct ? 'simulé' : 'horaire fictif') + ' · ' + esc(L[r.p.ligne].nom) + '</small></span></button>';
      }).join('');
      if (etat.couches.rosalie && ROSALIES.length) html += '<h3>Rosalies</h3>' + ROSALIES.map(function (r) {
        var t = traceRosalies[r.id];
        return '<button class="cu-element" type="button" data-rosalie="' + esc(r.id) + '"><span class="cu-pastille cu-pastille--rosalie">R' + r.numero + '</span>' +
          '<span class="cu-nom">' + esc(r.nom) + '<small>' + esc(r.usage) + ' · ≈ ' + km(t.metres) + ' · ' + r.etapes.length + ' étapes</small></span>' +
          '<span class="cu-suivant">' + r.disponibles + '<small>disponible' + (r.disponibles > 1 ? 's' : '') + '</small></span></button>';
      }).join('');
      if (etat.couches.velo) html += '<h3>Stations vélos</h3>' + AUTRES.filter(function (o) { return o.type === 'velo'; }).map(function (o) {
        return '<button class="cu-element" type="button" data-autre="' + esc(o.id) + '"><span class="cu-pastille cu-pastille--velo">' + o.velos + '</span>' +
          '<span class="cu-nom">' + esc(o.nom) + '<small>disponibilités fictives</small></span><span class="cu-suivant">' + (o.places - o.velos) + '<small>places libres</small></span></button>';
      }).join('');
      liste.innerHTML = html;
    }
    // Un seul écouteur pour toute la liste (au lieu d'un par élément, recréés à chaque mise à jour)
    liste.addEventListener('click', function (e) {
      var b = e.target.closest('.cu-element'); if (!b) return;
      if (b.dataset.arret) ouvrirArret(PAR_ID[b.dataset.arret]);
      else if (b.dataset.rosalie) ouvrirRosalie(PAR_ID[b.dataset.rosalie]);
      else if (b.dataset.autre) ouvrirAutre(PAR_ID[b.dataset.autre]);
    });
    function changerVue(v) {
      etat.vue = v;
      $('vue-carte').setAttribute('aria-pressed', String(v === 'carte'));
      $('vue-liste').setAttribute('aria-pressed', String(v === 'liste'));
      liste.hidden = v !== 'liste';
      if (v === 'liste') remplirListe();
    }
    $('vue-carte').onclick = function () { changerVue('carte'); };
    $('vue-liste').onclick = function () { changerVue('liste'); };

    /* ---------- Mise en page selon la largeur disponible ---------- */
    function placer() {
      var grand = racine.clientWidth >= LARGEUR_GRAND_FORMAT;
      racine.classList.toggle('cu-carte--large', grand);
      var cible = grand ? $('lateral') : $('scene');
      if (fiche.parentNode !== cible || liste.parentNode !== cible) {
        if (grand) { cible.appendChild(fiche); cible.appendChild(liste); }
        else { cible.insertBefore(liste, $('message')); cible.insertBefore(fiche, $('message')); }
      }
      carte.invalidateSize();
    }
    var obs = window.ResizeObserver ? new ResizeObserver(placer) : null;
    if (obs) obs.observe(racine); else window.addEventListener('resize', placer);

    // Toutes les 30 s : on met à jour les horaires affichés, sans recentrer la carte ni déplacer le focus
    minuteur = setInterval(function () {
      if (document.hidden || !visibleEcran) return;
      if (!fiche.hidden && etat.sel && etat.sel.type === 'arret') { var ul = fiche.querySelector('.cu-passages'); if (ul) ul.innerHTML = passages(arret(etat.sel.id)); }
      if (etat.vue === 'liste') remplirListe();
    }, 30000);

    placer(); filtrer();

    var api = {
      carte: carte,
      ouvrirArret: function (id) { var s = arret(id); if (s) ouvrirArret(s); },
      ouvrirRosalie: function (id) { var r = PAR_ID[id]; if (r && r.etapes) ouvrirRosalie(r); },
      ouvrirItineraire: ouvrirTrajet,
      fermer: fermer,
      detruire: function () {
        clearInterval(minuteur); clearInterval(busMinuteur); clearTimeout(msgMinuteur); if (vigie) vigie.disconnect();
        if (obs) obs.disconnect(); else window.removeEventListener('resize', placer);
        carte.remove(); racine.innerHTML = ''; racine.classList.remove('cu-carte--large', 'cu-carte--fiche'); delete racine._cuCarte;
      }
    };
    racine._cuCarte = api;
    return api;
  }

  window.CuCarte = { init: init };
  // Chargement différé : chaque carte se construit quand elle arrive à 300 px de l'écran
  // (tuiles et tracés ne sont pas téléchargés si le visiteur ne descend pas jusqu'à elle).
  // data-cu-carte="immediat" force la construction tout de suite.
  function auto() {
    document.querySelectorAll('[data-cu-carte]').forEach(function (r) {
      if (r.getAttribute('data-cu-carte') === 'immediat' || !window.IntersectionObserver) { init(r); return; }
      var io = new IntersectionObserver(function (e) { if (e[0].isIntersecting) { io.disconnect(); init(r); } }, { rootMargin:'300px' });
      io.observe(r);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();
})();
