# SAE-203 — Cycle’Up Pyrénées

Site de présentation de Cycle’Up Pyrénées : trois Rosalies en 3D avec vue éclatée,
profils de mobilité, galerie, carte de démonstration, vote et commentaires.

## Hébergement

Le site est préparé pour GitHub Pages sous `/SAE-203/`. Le workflow
`.github/workflows/pages.yml` compile les modules, les publie et les remet à jour
à chaque modification de `main`. Le workflow attend que le dépôt soit public
pour publier ; aucune souscription payante n’est nécessaire dans cette configuration.
Activer **Settings → Pages → Source → GitHub Actions**, puis lancer le workflow.

Les votes et les commentaires utilisent le serveur existant du projet. GitHub
Pages sert les fichiers du site ; la base D1 reste sur le serveur. Les données
existantes sont conservées. Le navigateur conserve un identifiant aléatoire pour
retrouver et modifier son vote, sans cookie tiers. Le serveur autorise les appels
depuis `https://pafou17-dev.github.io`. Les identifiants internes ne sont jamais
renvoyés dans les résultats publics.

## Compilation et aperçu

Node.js 22.13 minimum et npm :

```sh
npm ci
npm run build:pages
npm run preview:pages
```

Ouvrir `http://127.0.0.1:8874/SAE-203/`. Le dossier généré `pages-dist/`
contient le site prêt pour GitHub Pages. `PAGES_BASE_PATH` permet de changer le
chemin de publication ; `CYCLEUP_API_URL` permet de choisir un autre serveur de
consultation. La commande d’aperçu propose aussi un relais vers un serveur local
de consultation sur le port 8873 pour les tests.

## Optimisations

- Le modèle sélectionné est chargé à la demande. Les aperçus latéraux utilisent
  les rendus existants, sans télécharger deux autres modèles 3D.
- Deux modèles décodés au maximum sont conservés en mémoire. Les états de
  décomposition et les directions de caméra sont gardés lors du changement.
- Le rendu 3D s’arrête hors écran et dans un onglet masqué. Les survols du modèle
  assemblé ne déclenchent plus de recherche parmi tous les triangles.
- Résolution limitée à 1,5 pixel par pixel CSS sur ordinateur et 1,25 sur mobile,
  sans imposer de suréchantillonnage aux écrans ordinaires. Le mobile conserve les
  matériaux, l’éclairage et les ombres de contact avec moins de passes graphiques.
- Treize images WebP : 1 177 124 octets au lieu de 4 443 308, soit 74 % de moins.
  Les proportions et la transparence sont conservées ; les originaux restent
  dans les sources. Les trois modèles GLB ne sont pas modifiés.
- Modules regroupés et minifiés, fichiers nommés avec leur empreinte pour le
  cache. Les anciennes variantes GLB et les copies d’images inutilisées ne sont
  pas incluses dans la publication Pages.
- La galerie et la carte restent chargées près de leur section, avec leurs
  interactions, animations et réglages de réduction des mouvements.

## Vérifications

Compilation Pages et serveur, contrôle TypeScript, tests locaux de consultation,
préflight CORS et origine autorisée, vote modifiable sans cookie tiers, identités
distinctes et rejet d’une origine étrangère. Aucun vote de test n’est envoyé en
production. Les photographies et les personnages ont été fournis pour le projet.
Les licences de Three.js, de Leaflet et des typographies accompagnent les fichiers.
