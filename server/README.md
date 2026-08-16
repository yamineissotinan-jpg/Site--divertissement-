# Et si ? — serveur IA

Le frontend GitHub Pages n'embarque plus de modèle. Il appelle ce serveur Node/Transformers.js.

Modèle : `onnx-community/SmolLM2-135M-Instruct-ONNX`, avec quantification `q4f16`. Le poids q4f16 est d'environ 117 Mo. Le serveur télécharge et met en cache le modèle côté serveur au premier appel.

## Déploiement gratuit

Le dépôt contient `render.yaml`. Render propose actuellement des Web Services gratuits avec des limites, notamment mise en veille après 15 minutes d'inactivité et 750 heures gratuites mensuelles. Ce montage est destiné à un prototype gratuit, pas à 100 000 utilisateurs simultanés.

Après déploiement, l'URL attendue est de la forme `https://etsi-ai.onrender.com`. Le site permet aussi de saisir une autre URL dans le champ « serveur IA ».

## Test

- `GET /health` doit renvoyer `ok: true`.
- `POST /generate` accepte `prompt`, `mode`, `memory` et `context`.
