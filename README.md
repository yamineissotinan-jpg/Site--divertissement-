# Et si ?

Application de réalités alternatives et de récits interactifs.

## Activer le moteur IA

Le frontend est hébergé sur GitHub Pages et le moteur IA est séparé dans `server/`. GitHub Pages est statique ; le serveur est donc nécessaire pour la génération. citeturn0search0

Le dépôt contient déjà `render.yaml`. Render permet actuellement de déployer gratuitement un Web Service, avec mise en veille après 15 minutes d'inactivité et 750 heures gratuites mensuelles. citeturn3search0

### Déploiement en un clic

https://render.com/deploy?repo=https://github.com/yamineissotinan-jpg/Site--divertissement-

Après le déploiement, le service `etsi-ai` aura une URL `onrender.com`. Le site possède un champ « serveur IA » permettant de la renseigner si nécessaire.

Le serveur utilise Transformers.js côté Node.js, ce qui permet d'exécuter l'inférence côté serveur plutôt que de télécharger le modèle dans le navigateur. citeturn4search12
