/* ============================================================
   Cycle'Up · Carte interactive — DONNÉES D'EXEMPLE
   Seul fichier à modifier pour changer le contenu de la carte.
   Positions en GPS : [latitude, longitude].
   Positions vérifiées : gare de Tarbes, place Marcadieu.
   Les autres sont approchées : à vérifier sur openstreetmap.org (clic droit > « Afficher l'adresse »).
   Lignes, horaires et Rosalies : fictifs (scénario de concertation).
   ============================================================ */
window.CU_CARTE_DONNEES = {

  /* Fonds de carte : gratuits, SANS clé API. Mention des sources obligatoire (affichée en bas à droite).
     Un sélecteur sur la carte permet de passer de l'un à l'autre.
     Page ouverte en double-clic (file://) : on commence par un fond qui l'accepte (marcheFichier: true).
     Si un fond ne répond pas, la carte passe automatiquement au suivant. */
  fonds: [
    { nom: 'Plan OpenStreetMap France',
      url: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', sousDomaines: 'abc', zoomMax: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · fond <a href="https://www.openstreetmap.fr">OSM France</a>' },
    { nom: 'Plan Esri', marcheFichier: true,
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', zoomMax: 19,
      attribution: 'Fond © Esri · sources : Esri, HERE, Garmin, USGS, © OpenStreetMap' },
    { nom: 'Cyclable (CyclOSM)',
      url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', sousDomaines: 'abc', zoomMax: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://www.cyclosm.org">CyclOSM</a>' }
  ],

  /* Calcul des tracés qui suivent les routes (service gratuit OpenStreetMap).
     Mettre null pour des tracés en ligne droite (aucune requête externe). */
  routage: 'https://routing.openstreetmap.de',

  /* Zones proposées en raccourci */
  zones: [
    { nom: 'Tarbes',        centre: [43.2330, 0.0840], zoom: 13 },
    { nom: 'Bagnères',      centre: [43.0450, 0.1620], zoom: 12 },
    { nom: 'Boltaña (ES)',  centre: [42.4320, 0.1040], zoom: 13 }
  ],

  /* Lignes de bus : la ligne relie ses arrêts dans l'ordre. */
  lignes: {
    T8:   { nom: 'T8',  couleur: '#AA4D37', freq: 60, direct: false, libelle: 'Séméac ↔ Tarbes Marcadieu', arrets: ['s2','s1','s3','s4'] },
    T2:   { nom: 'T2',  couleur: '#173F46', freq: 15, direct: true,  libelle: 'Tarbes Gare ↔ IUT',         arrets: ['s5','s4','s6','s7'] },
    L960: { nom: '960', couleur: '#5B7F3A', freq: 90, direct: false, libelle: 'liO · Tarbes ↔ Bagnères-de-Bigorre', arrets: ['s5','s8','s9'] }
  },

  arrets: [
    { id:'s1', nom:'Séméac — Place de la Mairie', pos:[43.2291, 0.1058], lignes:['T8'],        pmr:true,  vers:{T8:'vers Tarbes — Marcadieu'} },
    { id:'s2', nom:'Séméac — Les Coteaux',        pos:[43.2226, 0.1140], lignes:['T8'],        pmr:false, vers:{T8:'vers Tarbes — Marcadieu'} },
    { id:'s3', nom:'Aureilhan — Centre',          pos:[43.2436, 0.0958], lignes:['T8'],        pmr:true,  vers:{T8:'vers Tarbes — Marcadieu'} },
    { id:'s4', nom:'Tarbes — Marcadieu',          pos:[43.2316, 0.0841], lignes:['T8','T2'],   pmr:true,  important:true, vers:{T8:'vers Séméac', T2:'vers IUT de Tarbes'} },
    { id:'s5', nom:'Tarbes — Gare SNCF',          pos:[43.2403, 0.0694], lignes:['T2','L960'], pmr:true,  important:true, vers:{T2:'vers IUT de Tarbes', L960:'vers Bagnères-de-Bigorre'} },
    { id:'s6', nom:'Tarbes — Verdun',             pos:[43.2327, 0.0758], lignes:['T2'],        pmr:true,  vers:{T2:'vers IUT de Tarbes'} },
    { id:'s7', nom:'IUT de Tarbes',               pos:[43.2250, 0.0540], lignes:['T2'],        pmr:true,  vers:{T2:'vers Tarbes — Gare SNCF'} },
    { id:'s8', nom:'Montgaillard — Centre',       pos:[43.1240, 0.1110], lignes:['L960'],      pmr:false, vers:{L960:'vers Bagnères-de-Bigorre'} },
    { id:'s9', nom:'Bagnères-de-Bigorre — Gare routière', pos:[43.0672, 0.1495], lignes:['L960'], pmr:true, important:true, vers:{L960:'vers Tarbes — Gare SNCF'} }
  ],

  /* Autres points : velo | covoit */
  autres: [
    { id:'v1', type:'velo',   nom:'Station vélos — Marcadieu', pos:[43.2310, 0.0830], velos:6, places:12 },
    { id:'v2', type:'velo',   nom:'Station vélos — Gare',      pos:[43.2397, 0.0706], velos:3, places:10 },
    { id:'v3', type:'velo',   nom:'Station vélos — IUT',       pos:[43.2257, 0.0553], velos:0, places:8  },
    { id:'c1', type:'covoit', nom:'Aire de covoiturage — Séméac', pos:[43.2268, 0.1185] }
  ],

  /* Rosalies : véhicule à pédales partagé (scénario prospectif). Chaque Rosalie suit son itinéraire, étape par étape. */
  rosalies: [
    { id:'r1', numero:1, nom:'Séméac → IUT de Tarbes', usage:'Quotidien', disponibles:2, places:4,
      horaires:'Départs 7 h 30, 8 h 00, 8 h 30 · retours de 17 h à 19 h',
      etapes:[ { nom:'Relais Séméac — Mairie', pos:[43.2302, 0.1082] }, { nom:'Tarbes — Marcadieu', pos:[43.2316, 0.0841] },
               { nom:'Tarbes — Verdun', pos:[43.2327, 0.0758] }, { nom:'IUT de Tarbes', pos:[43.2250, 0.0540] } ] },
    { id:'r2', numero:2, nom:'Aureilhan → Gare de Tarbes', usage:'Quotidien', disponibles:1, places:4,
      horaires:'Calée sur les trains : toutes les 30 min de 6 h 30 à 20 h',
      etapes:[ { nom:'Relais Aureilhan — Centre', pos:[43.2448, 0.0978] }, { nom:'Tarbes — Gare SNCF', pos:[43.2403, 0.0694] } ] },
    { id:'r3', numero:3, nom:'Boucle du centre de Tarbes', usage:'Loisir', disponibles:3, places:4,
      horaires:'Week-end et vacances, de 10 h à 18 h',
      etapes:[ { nom:'Relais Gare SNCF', pos:[43.2413, 0.0676] }, { nom:'Jardin Massey', pos:[43.2366, 0.0713] },
               { nom:'Place de Verdun', pos:[43.2327, 0.0758] }, { nom:'Place Marcadieu', pos:[43.2316, 0.0841] }, { nom:'Retour gare', pos:[43.2413, 0.0676] } ] },
    { id:'r4', numero:4, nom:'Bagnères : gare routière → Thermes', usage:'Dernier kilomètre', disponibles:2, places:4,
      horaires:'À l’arrivée de chaque car liO 960',
      etapes:[ { nom:'Relais Gare routière', pos:[43.0682, 0.1512] }, { nom:'Centre-ville', pos:[43.0655, 0.1493] }, { nom:'Thermes', pos:[43.0628, 0.1466] } ] },
    { id:'r5', numero:5, nom:'Bagnères → Campan', usage:'Loisir', disponibles:1, places:4,
      horaires:'Réservation la veille, de 9 h à 17 h',
      etapes:[ { nom:'Relais Bagnères — Centre', pos:[43.0655, 0.1493] }, { nom:'Baudéan', pos:[43.0480, 0.1620] }, { nom:'Campan — Village', pos:[43.0167, 0.1781] } ] },
    { id:'r6', numero:6, nom:'Boltaña → Aínsa (Espagne)', usage:'Transfrontalier', disponibles:2, places:4,
      horaires:'Toutes les heures de 9 h à 19 h (juin à septembre)',
      etapes:[ { nom:'Relais Boltaña — Plaza Mayor', pos:[42.4453, 0.0683] }, { nom:'Aínsa — Casco antiguo', pos:[42.4180, 0.1395] } ] }
  ],

  depart:  { nom:'Séméac — départ (exemple)', pos:[43.2318, 0.1105] },
  arrivee: { nom:'IUT de Tarbes',     pos:[43.2250, 0.0540] },

  /* Trajet de démonstration (persona Léa). points = identifiants d'arrêts, 'depart', 'arrivee' ou [lat, lng]. */
  trajet: {
    prix: 'Formule Bus, 5 € par mois (fictif)',
    planB: 'Le suivant passe une heure plus tard. Plan B : Rosalie 1 depuis Séméac.',
    etapes: [
      { type:'marche', titre:'Marcher jusqu’à Séméac — Place de la Mairie', detail:'6 min · 450 m', minutes:6, points:['depart','s1'] },
      { type:'ligne', ligne:'T8', arret:'s1', vers:'vers Tarbes — Marcadieu', detail:'2 arrêts · 16 min', minutes:16, direct:false, points:['s1','s3','s4'] },
      { type:'correspondance', titre:'Correspondance à Tarbes — Marcadieu', detail:'4 min d’attente', minutes:4 },
      { type:'ligne', ligne:'T2', vers:'vers IUT de Tarbes', detail:'2 arrêts · 19 min', minutes:19, direct:true, points:['s4','s6','s7'] },
      { type:'arrivee', titre:'Arrivée IUT de Tarbes', detail:'3 min à pied', minutes:3 }
    ]
  }
};
