import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const PORT = Number(process.env.PORT || 10000);
const MODEL = 'lightweight-narrative-engine-v6';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// The browser can send a long history. Never pass the whole history to the
// narrative engine: this prevents the previous "prompt too long" failures.
const MAX_INPUT = 12000;
const MAX_CONTEXT = 5000;
const MAX_OUTPUT = 18000;

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '512kb' }));
app.use(express.static(ROOT, { index: 'index.html' }));

const text = (value = '') => String(value ?? '').trim();
const clean = (value = '') => text(value).replace(/[.!?]+$/g, '');
const normalize = (value = '') => clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const cap = (value, size) => text(value).slice(0, size);

function classify(prompt) {
  const s = normalize(prompt);
  if (/\bet si\b|imagine|supposons|autre realite|que se passerait/.test(s)) return 'REALITE_ALTERNATIVE';
  if (/raconte|histoire|roman|fiction|conte/.test(s)) return 'RECIT';
  if (/^(pourquoi|comment|qu est ce|quelle|quel|qui|combien|quand|ou)\b/.test(s)) return 'INFORMATION';
  return 'CONVERSATION';
}

function scenario(prompt) {
  const s = normalize(prompt);
  if (/(humain|humanite)/.test(s) && /(dispar|plus aucun|plus personne)/.test(s)) return 'HUMANS_GONE';
  return 'GENERAL';
}

function chapter(title, paragraphs) {
  return `CHAPITRE — ${title}\n\n${paragraphs.join('\n\n')}`;
}

function humansGone() {
  return [
    chapter('Le dernier matin', [
      'À 7 h 42, les villes fonctionnent encore comme si rien n’avait changé. Les feux de circulation changent de couleur, les ascenseurs terminent leurs trajets et des téléphones continuent de vibrer dans des appartements désormais silencieux.',
      'Puis la réalité apparaît : tous les humains ont disparu, partout sur Terre, au même instant. Il n’y a pas de survivants cachés dans une capitale, un bunker ou un village isolé.',
      'Les premières minutes restent étrangement ordinaires. Les bâtiments sont debout, les ordinateurs exécutent les tâches déjà lancées et certaines machines continuent leur cycle automatique.',
      'À Cotonou comme ailleurs, les appareils domestiques fonctionnent encore. Mais chaque système qui dépendait d’un humain vient de commencer un compte à rebours invisible.'
    ]),
    chapter('Les premières heures', [
      'Les avions deviennent l’un des premiers problèmes visibles. Leur automatisation peut maintenir un appareil pendant un certain temps, mais elle ne remplace pas indéfiniment un équipage.',
      'Sur les routes, certaines voitures s’arrêtent, d’autres provoquent des accidents. Les feux continuent de fonctionner jusqu’à ce qu’une panne ou l’absence de maintenance les immobilise.',
      'Les réseaux électriques connaissent des trajectoires différentes. Les protections automatiques isolent certaines pannes, mais aucune machine ne peut remplacer partout les équipes qui surveillaient et réparaient les installations.'
    ]),
    chapter('La première semaine', [
      'L’eau potable devient progressivement un problème majeur. Les stations de pompage peuvent continuer quelque temps, mais elles dépendent de l’électricité, de composants mécaniques et d’une maintenance régulière.',
      'Les aliments réfrigérés commencent à se dégrader lorsque les réseaux électriques deviennent instables. Les magasins restent pleins, mais leur contenu perd rapidement sa valeur.',
      'Les animaux domestiques connaissent des destins différents. Certains trouvent une sortie et apprennent à chercher de l’eau et de la nourriture ; d’autres restent enfermés et ne survivent pas.'
    ]),
    chapter('Les premières années', [
      'Les villes ne deviennent pas immédiatement des forêts. Les routes, les bâtiments et les infrastructures restent visibles, mais l’entretien s’est arrêté partout.',
      'L’eau pénètre les fissures, les plantes colonisent les espaces abandonnés et les matériaux se dégradent lentement. Les égouts et les systèmes de traitement cessent progressivement de fonctionner.',
      'Les satellites restent parfois actifs pendant un certain temps, mais les équipements qui nécessitent une intervention au sol finissent eux aussi par perdre leurs capacités.'
    ]),
    chapter('Un siècle plus tard', [
      'Cent ans passent. Les métaux ont rouillé, de nombreuses vitres ont disparu et les racines ont pénétré des structures qui semblaient autrefois permanentes.',
      'Certaines constructions massives restent reconnaissables tandis que des objets ordinaires ont disparu. Une ancienne autoroute peut encore être visible sous la végétation sans être praticable.',
      'La Terre n’a pas effacé l’humanité en une journée. Elle a lentement transformé une civilisation abandonnée en paysage.'
    ])
  ].join('\n\n');
}

function genericAlternative(prompt, context) {
  const p = clean(prompt) || 'une différence apparaît dans notre réalité';
  const ctx = context ? `Le contexte utile est conservé sans recopier tout l’historique : ${cap(context, 900)}` : 'Aucun historique supplémentaire n’est nécessaire pour commencer.';
  return [
    chapter('Le point de divergence', [
      `La question de départ est : « ${p} ».`,
      'Pour construire cette réalité alternative, un seul changement est isolé au départ. Le reste du monde conserve autant que possible ses conditions réelles.',
      ctx
    ]),
    chapter('Les premières conséquences', [
      'Au début, la différence semble limitée. La majorité des personnes poursuivent leur quotidien sans comprendre qu’une nouvelle trajectoire vient de commencer.',
      'Une décision, une rencontre ou un événement devient légèrement différent. Cette première différence produit une conséquence concrète.',
      'Une seconde décision doit alors être prise, et le monde commence à s’éloigner progressivement de notre histoire.'
    ]),
    chapter('La chaîne des décisions', [
      'Chaque conséquence modifie les possibilités suivantes. Une opportunité apparaît alors qu’elle n’existait pas auparavant, tandis qu’une autre disparaît.',
      'Les individus réagissent à ces changements selon leurs intérêts, leurs connaissances et leurs contraintes. Les institutions s’adaptent à leur tour.',
      'Après plusieurs années, il devient impossible de revenir exactement au monde initial : la nouvelle réalité possède désormais sa propre histoire.'
    ]),
    chapter('Une génération plus tard', [
      'Les personnes nées après la divergence considèrent cette nouvelle réalité comme normale. Elles ne cherchent plus à reproduire notre monde ; elles construisent le leur.',
      'Les conséquences deviennent alors plus profondes : culture, économie, relations, technologies et décisions politiques suivent des chemins différents.',
      'La petite différence du départ est devenue un changement historique majeur.'
    ])
  ].join('\n\n');
}

function information(prompt) {
  return `QUESTION — ${clean(prompt)}\n\nLe moteur local peut répondre aux demandes générales et aux simulations. Pour une réponse factuelle nécessitant des données récentes, une recherche externe doit être activée.\n\nPour une simulation « Et si ? », formule la question comme une réalité alternative afin que le moteur construise les conséquences étape par étape.`;
}

function generate(prompt, mode, context) {
  const type = classify(prompt);
  if (scenario(prompt) === 'HUMANS_GONE') return { type: 'REALITE_ALTERNATIVE', text: humansGone() };
  if (type === 'INFORMATION') return { type, text: information(prompt) };
  return { type, text: genericAlternative(prompt, context) };
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, model: MODEL, engine: 'context-aware lightweight narrative engine', status: 'healthy' });
});

app.get('/test', (_req, res) => {
  const result = generate('Et si tous les humains disparaissaient demain ?', 'Test', '');
  res.json({ ok: true, model: MODEL, ...result, mode: 'Test', research: [] });
});

app.post('/generate', (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const prompt = cap(body.prompt ?? body.question ?? body.message ?? body.input ?? '', MAX_INPUT);
    const mode = cap(body.mode ?? body.length ?? 'Long', 80);
    const context = cap(body.context ?? body.history ?? body.memory ?? body.previous ?? '', MAX_CONTEXT);

    if (!prompt) return res.status(400).json({ ok: false, error: 'prompt_required' });

    // Critical fix: only the capped prompt/context reach the generator.
    const result = generate(prompt, mode, context);
    const output = cap(result.text, MAX_OUTPUT);
    res.json({ ok: true, model: MODEL, engine: 'context-aware lightweight narrative engine', type: result.type, mode, text: output, research: [] });
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ ok: false, error: 'generation_failed', detail: text(error?.message || error).slice(0, 500) });
  }
});

// Express 5 does not need a wildcard route here. Static middleware serves the
// real frontend at / and all known API routes are handled above.
app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'not_found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Et Si? AI server listening on ${PORT}`);
});
