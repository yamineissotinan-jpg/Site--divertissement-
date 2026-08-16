# Et si ? — backend IA

Ce dossier contient le backend FastAPI de l'application. GitHub Pages reste uniquement le frontend statique ; le modèle n'est plus téléchargé dans le navigateur.

## Déploiement

Le backend est prévu pour un hébergement Python/Docker compatible (par exemple un Space Hugging Face). Une fois le backend déployé, renseigner son URL dans `API_BASE` dans `index.html`.

Le backend expose :

- `GET /health`
- `POST /generate`
- `POST /research`

Le modèle est téléchargé côté serveur, pas côté navigateur.
