# Antenne — Programme TV Europe

App web qui affiche le programme TV de 5 pays (🇫🇷 🇬🇧 🇪🇸 🇮🇹 🇩🇪) avec filtrage **par type de programme**, par chaîne, et « à l'antenne » (en direct maintenant).

## Comment ça marche

- **Front** (`public/index.html`) : interface, filtres par type/chaîne/horaire. Aucune dépendance.
- **Function** (`netlify/functions/epg/index.mts`) : récupère le guide XMLTV du pays (source epgshare01, MAJ quotidienne), le décompresse, le parse, et classe chaque programme en grandes catégories (sport, film, série, info, doc, jeunesse…). Réponse mise en cache 6h via Netlify Blobs.

Le passage par une Function est nécessaire : un navigateur ne peut pas télécharger directement ces fichiers `.gz` (CORS), et ça protège aussi tes appels.

## Déploiement

Comme pour ton dashboard CDM 2026 :

1. Crée un repo GitHub avec ces fichiers (ou glisse le dossier dans Netlify > Deploys).
2. Netlify détecte `netlify.toml` tout seul : publish = `public`, functions = `netlify/functions`.
3. Au build, Netlify installe `fast-xml-parser` (déclaré dans `package.json`). Rien d'autre à configurer.
4. L'API est dispo sur `/api/epg?country=FR` (ou UK/ES/IT/DE). Ajoute `&refresh=1` pour forcer le rafraîchissement du cache.

## Test en local

```bash
npm install
npx netlify dev
```

## Ajouter un pays

Dans `netlify/functions/epg/index.mts`, ajoute une entrée à `SOURCES` (code pays + URL epgshare01, ex. `PT1`, `NL1`, `BE1`), puis une `<option>` dans `public/index.html`.

## Notes

- Les types sont déduits des balises `<category>` du XMLTV. Si une chaîne ne fournit pas de genre, le programme tombe dans « Autre ». Tu peux enrichir les mots-clés dans `TYPE_RULES`.
- Source de données : epgshare01.online (gratuit, communautaire). Pour un usage plus robuste/commercial, on pourra basculer vers une API payante (EPG.best) en gardant la même Function.
