import express from 'express';
import cors from 'cors';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const PORT = Number(process.env.PORT || 10000);
const MODEL = 'lightweight-narrative-engine-v6';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const MAX_INPUT = 12000;
const MAX_CONTEXT = 5000;
const MAX_OUTPUT = 18000;
const MAX_MEMORY = 2200;

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '512kb' }));

const text = (value = '') => String(value ?? '').trim();
const clean = (value = '') => text(value).replace(/[.!?]+$/g, '');
const normalize = (value = '') => clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const cap = (value, size) => text(value).slice(0, size);

function classify(prompt) {
  const s = normalize(prompt);
  if (/\bet si\b|imagine|supposons|autre realite|que se passerait/.test(s)) return 'REALITE_ALTERNATIVE';
  if (/raconte|histoire|roman|conte/.test(s)) return 'RECIT';
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
    chapter('Le dernier matin', ['À 7 h 42, les villes fonctionnent encore comme si rien n’avait changé. Les feux de circulation changent de couleur, les ascenseurs terminent leurs trajets et des téléphones continuent de vibrer dans des appartements désormais silencieux.','Puis la réalité apparaît : tous les humains ont disparu, partout sur Terre, au même instant. Il n’y a pas de survivants cachés dans une capitale, un bunker ou un village isolé.','Les premières minutes restent étrangement ordinaires. Les bâtiments sont debout, les ordinateurs exécutent les tâches déjà lancées et certaines machines continuent leur cycle automatique.']),
    chapter('Les premières heures', ['Les avions deviennent l’un des premiers problèmes visibles. Leur automatisation peut maintenir un appareil pendant un certain temps, mais elle ne remplace pas indéfiniment un équipage.','Sur les routes, certaines voitures s’arrêtent, d’autres provoquent des accidents. Les feux continuent de fonctionner jusqu’à ce qu’une panne ou l’absence de maintenance les immobilise.','Les réseaux électriques connaissent des trajectoires différentes. Les protections automatiques isolent certaines pannes, mais aucune machine ne peut remplacer partout les équipes qui surveillaient et réparaient les installations.']),
    chapter('La première semaine', ['Les stations de pompage peuvent continuer quelque temps, mais elles dépendent de l’électricité, de composants mécaniques et d’une maintenance régulière.','Les aliments réfrigérés commencent à se dégrader lorsque les réseaux électriques deviennent instables. Les magasins restent pleins, mais leur contenu perd rapidement sa valeur.','Les animaux domestiques connaissent des destins différents. Certains trouvent une sortie et apprennent à chercher de l’eau et de la nourriture ; d’autres restent enfermés.']),
    chapter('Les premières années', ['Les villes ne deviennent pas immédiatement des forêts. Les routes, les bâtiments et les infrastructures restent visibles, mais l’entretien s’est arrêté partout.','L’eau pénètre les fissures, les plantes colonisent les espaces abandonnés et les matériaux se dégradent lentement.','Les satellites restent parfois actifs pendant un certain temps, mais les équipements qui nécessitent une intervention au sol finissent eux aussi par perdre leurs capacités.']),
    chapter('Un siècle plus tard', ['Cent ans passent. Les métaux ont rouillé, de nombreuses vitres ont disparu et les racines ont pénétré des structures qui semblaient autrefois permanentes.','Certaines constructions massives restent reconnaissables tandis que des objets ordinaires ont disparu.','La Terre n’a pas effacé l’humanité en une journée. Elle a lentement transformé une civilisation abandonnée en paysage.'])
  ].join('\n\n');
}

function parseMemory(value) {
  if (!value) return null;
  try {
    const m = typeof value === 'string' ? JSON.parse(value) : value;
    if (!m || typeof m !== 'object') return null;
    return {
      version: 1,
      scenario: cap(m.scenario, 600),
      divergence: cap(m.divergence, 400),
      time: cap(m.time, 180),
      places: cap(m.places, 260),
      characters: cap(m.characters, 320),
      events: Array.isArray(m.events) ? m.events.slice(-5).map(x => cap(x, 180)) : [],
      current: cap(m.current, 500)
    };
  } catch { return null; }
}

function memoryText(memory) {
  const m = parseMemory(memory);
  if (!m) return '';
  return [
    `SCENARIO: ${m.scenario}`,
    `DIVERGENCE: ${m.divergence}`,
    `TEMPS: ${m.time}`,
    m.places && `LIEUX: ${m.places}`,
    m.characters && `PERSONNAGES: ${m.characters}`,
    m.events.length && `EVENEMENTS: ${m.events.join(' | ')}`,
    `SITUATION ACTUELLE: ${m.current}`
  ].filter(Boolean).join('\n');
}

function fitMemory(memory) {
  let m = parseMemory(memory);
  if (!m) return null;
  const size = () => JSON.stringify(m).length;
  while (size() > MAX_MEMORY && m.events.length > 1) m.events.shift();
  if (size() > MAX_MEMORY) m.current = cap(m.current, 300);
  if (size() > MAX_MEMORY) m.characters = cap(m.characters, 180);
  if (size() > MAX_MEMORY) m.places = cap(m.places, 140);
  if (size() > MAX_MEMORY) m.divergence = cap(m.divergence, 260);
  if (size() > MAX_MEMORY) m.scenario = cap(m.scenario, 420);
  if (size() > MAX_MEMORY) m.current = cap(m.current, 160);
  if (size() > MAX_MEMORY) m.events = m.events.slice(-2).map(x => cap(x, 100));
  return m;
}

function compactMemory(prompt, type, previous, output) {
  const old = parseMemory(previous);
  const p = clean(prompt);
  const follow = /\b(dix|vingt|trente|cent|quelques|plus tard|annee|ans|siecle|ensuite|apres|puis|maintenant)\b/i.test(p);
  const scenarioText = old?.scenario || p;
  const divergence = old?.divergence || (type === 'REALITE_ALTERNATIVE' ? p : '');
  const time = follow ? (old?.time || 'après la génération précédente') : (old?.time || 'début du scénario');
  const events = [...(old?.events || [])];
  if (old?.current) events.push(old.current);
  const current = cap(output.replace(/CHAPITRE\s*[—-]\s*/gi, '').replace(/\s+/g, ' ').trim(), 500);
  return fitMemory({
    version: 1,
    scenario: cap(scenarioText, 600),
    divergence: cap(divergence, 400),
    time: cap(time, 180),
    places: old?.places || '',
    characters: old?.characters || '',
    events: events.slice(-5),
    current
  });
}

function genericAlternative(prompt, context, memory) {
  const p = clean(prompt) || 'une différence apparaît dans notre réalité';
  const mtxt = memoryText(memory);
  const isFollow = !!parseMemory(memory) && /\b(plus tard|ans|annee|ensuite|apres|puis|maintenant|et dix|et vingt|et cent)\b/i.test(p);
  const continuity = mtxt ? `MEMOIRE COMPACTE DU SCENARIO:\n${cap(mtxt, MAX_MEMORY)}\n\n` : '';
  const ctx = context ? `Contexte factuel de départ : ${cap(context, 700)}` : 'Aucun contexte factuel supplémentaire.';
  const opening = isFollow
    ? `La question « ${p} » est une continuation du même scénario. La réalité ne recommence pas : elle part exactement de la situation mémorisée et fait avancer le temps.`
    : `La question de départ est : « ${p} ».`;
  return [
    chapter('Le point de divergence', [opening, continuity + ctx, 'Un changement précis est isolé au départ. Le reste du monde conserve autant que possible ses conditions connues.']),
    chapter(isFollow ? 'La suite du monde' : 'Les premières conséquences', ['La nouvelle trajectoire produit des conséquences concrètes. Les individus et les institutions réagissent à ce qui vient de changer.','Une décision entraîne une autre décision et modifie progressivement les possibilités suivantes.','La réalité alternative avance sans effacer les événements déjà établis.']),
    chapter('La chaîne des décisions', ['Chaque conséquence modifie les possibilités suivantes. Une opportunité apparaît alors qu’elle n’existait pas auparavant, tandis qu’une autre disparaît.','Les personnes réagissent selon leurs intérêts, leurs connaissances et leurs contraintes. Les institutions s’adaptent à leur tour.','Après plusieurs années, la divergence initiale possède désormais sa propre histoire.']),
    chapter('Une génération plus tard', ['Les personnes nées après la divergence considèrent cette réalité comme normale.','Les conséquences deviennent plus profondes : culture, économie, relations, technologies et décisions politiques suivent des chemins différents.','La petite différence du départ est devenue un changement historique majeur.'])
  ].join('\n\n');
}

function information(prompt) {
  return `QUESTION — ${clean(prompt)}\n\nLe moteur local peut répondre aux demandes générales et aux simulations. Pour une réponse factuelle nécessitant des données récentes, une recherche externe doit être activée.\n\nPour une simulation « Et si ? », formule la question comme une réalité alternative afin que le moteur construise les conséquences étape par étape.`;
}

function generate(prompt, mode, context, memory) {
  const type = classify(prompt);
  if (scenario(prompt) === 'HUMANS_GONE' && !parseMemory(memory)) return { type: 'REALITE_ALTERNATIVE', text: humansGone() };
  if (type === 'INFORMATION' && !parseMemory(memory)) return { type, text: information(prompt) };
  return { type, text: genericAlternative(prompt, context, memory) };
}

function runMemorySelfTest() {
  const firstPrompt = 'Et si tous les humains disparaissaient demain ?';
  const first = generate(firstPrompt, 'Long', '', null);
  const memory1 = compactMemory(firstPrompt, first.type, null, first.text);
  const secondPrompt = 'Et dix ans plus tard ?';
  const second = generate(secondPrompt, 'Long', '', memory1);
  const memory2 = compactMemory(secondPrompt, second.type, memory1, second.text);
  const thirdPrompt = 'Et vingt ans plus tard ?';
  const third = generate(thirdPrompt, 'Long', '', memory2);
  const memory3 = compactMemory(thirdPrompt, third.type, memory2, third.text);
  const fresh = generate('Et si les océans montaient de 20 mètres ?', 'Long', '', null);
  const checks = {
    memoryCreated: !!memory1,
    memory1Bounded: !!memory1 && JSON.stringify(memory1).length <= MAX_MEMORY,
    memory2Bounded: !!memory2 && JSON.stringify(memory2).length <= MAX_MEMORY,
    memory3Bounded: !!memory3 && JSON.stringify(memory3).length <= MAX_MEMORY,
    followupUsesMemory: second.text.includes('continuation du même scénario'),
    thirdUsesMemory: third.text.includes('continuation du même scénario'),
    freshStartsWithoutMemory: !fresh.text.includes('continuation du même scénario')
  };
  return { ok: Object.values(checks).every(Boolean), checks, sizes: [memory1, memory2, memory3].map(m => JSON.stringify(m || {}).length) };
}

const MEMORY_BRIDGE = `<script>(function(){const K='etsi_narrative_memory_v1';const oldFetch=window.fetch.bind(window);window.fetch=async function(input,init){let isGen=false;try{const u=typeof input==='string'?input:input.url||'';isGen=u.endsWith('/generate');if(isGen&&init&&init.body){const b=JSON.parse(init.body);const m=localStorage.getItem(K);if(m)b.memory=m;init={...init,body:JSON.stringify(b)}}}catch(e){}const r=await oldFetch(input,init);if(isGen){try{const c=r.clone();const j=await c.json();if(j&&j.memory)localStorage.setItem(K,JSON.stringify(j.memory))}catch(e){}}return r};document.addEventListener('click',e=>{if(e.target&&e.target.id==='new')localStorage.removeItem(K)});})();</script>`;

app.get('/health', (_req, res) => res.json({ ok: true, model: MODEL, engine: 'context-aware lightweight narrative engine', status: 'healthy' }));
app.get('/test', (_req, res) => { const result = generate('Et si tous les humains disparaissaient demain ?', 'Test', '', null); res.json({ ok: true, model: MODEL, ...result, mode: 'Test', research: [], memory: compactMemory('Et si tous les humains disparaissaient demain ?', result.type, null, result.text) }); });
app.get('/test/memory', (_req, res) => res.json(runMemorySelfTest()));

app.get('/', async (_req, res) => {
  try {
    const html = await fs.readFile(path.join(ROOT, 'index.html'), 'utf8');
    res.type('html').send(html.replace('</body>', `${MEMORY_BRIDGE}</body>`));
  } catch (error) { res.status(500).send('Frontend unavailable'); }
});
app.use(express.static(ROOT, { index: false }));

app.post('/generate', (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const prompt = cap(body.prompt ?? body.question ?? body.message ?? body.input ?? '', MAX_INPUT);
    const mode = cap(body.mode ?? body.length ?? 'Long', 80);
    const context = cap(body.context ?? body.history ?? '', MAX_CONTEXT);
    const memory = parseMemory(body.memory);
    if (!prompt) return res.status(400).json({ ok: false, error: 'prompt_required' });
    const result = generate(prompt, mode, context, memory);
    const output = cap(result.text, MAX_OUTPUT);
    const nextMemory = compactMemory(prompt, result.type, memory, output);
    res.json({ ok: true, model: MODEL, engine: 'context-aware lightweight narrative engine', type: result.type, mode, text: output, research: [], memory: nextMemory });
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ ok: false, error: 'generation_failed', detail: text(error?.message || error).slice(0, 500) });
  }
});

app.use((_req, res) => res.status(404).json({ ok: false, error: 'not_found' }));
app.listen(PORT, '0.0.0.0', () => console.log(`Et Si? AI server listening on ${PORT}`));
