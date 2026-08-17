import express from 'express';
import cors from 'cors';
import path from 'node:path';

const app = express();
const MODEL = 'lightweight-narrative-engine-v5';
const PORT = Number(process.env.PORT || 10000);
// The frontend sends generation instructions, context and chapter memory together.
// Keep a generous limit so normal Long/Epique/Film generations do not get rejected.
const MAX_PROMPT = 30000;
const RESEARCH_TIMEOUT_MS = 3500;
const FRONTEND = path.resolve(process.cwd(), '../index.html');

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '256kb' }));

const normalize = (v = '') => String(v).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const clean = (v = '') => String(v).trim().replace(/[.!?]+$/, '');

function classify(prompt = '') {
  const s = normalize(prompt);
  if (/\bet si\b|\bimagine\b|\bsupposons\b|\bdans une autre realite\b|\bque se passerait il\b|\bque se passerait-il\b/.test(s)) return 'REALITE_ALTERNATIVE';
  if (/\braconte\b|\bhistoire\b|\broman\b|\bfiction\b|\bconte\b/.test(s)) return 'RECIT';
  if (/^(pourquoi|comment|qu est ce|qu'est-ce|quelle|quel|qui\b|combien|quand|ou\b)/.test(s)) return 'INFORMATION';
  return 'CONVERSATION';
}

function scenario(prompt = '') {
  const s = normalize(prompt);
  if (/(humain|humanite)/.test(s) && /(dispar|plus aucun|plus personne)/.test(s)) return 'HUMANS_GONE';
  if (/\bbeyonce\b/.test(s)) return 'BEYONCE';
  if (/\btitanic\b/.test(s)) return 'TITANIC';
  if (/\bnapoleon\b|\bwaterloo\b/.test(s)) return 'NAPOLEON';
  if (/\binternet\b/.test(s)) return 'INTERNET_GONE';
  if (/\bterre\b/.test(s) && /\bdeux lunes?\b/.test(s)) return 'TWO_MOONS';
  return 'GENERAL';
}

async function research(query = '') {
  const q = clean(query).replace(/^et si\s+/i, '').slice(0, 700);
  if (!q) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RESEARCH_TIMEOUT_MS);

  try {
    const url = 'https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=' + encodeURIComponent(q) + '&srlimit=4&format=json&origin=*';
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'EtSiAI/3.0' }
    });
    if (!response.ok) return [];
    const data = await response.json();
    const rows = Array.isArray(data?.query?.search) ? data.query.search : [];
    return rows.slice(0, 4).map((row) => ({
      title: String(row.title || ''),
      snippet: String(row.snippet || '').replace(/<[^>]+>/g, '')
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function chapter(title, paragraphs) {
  return `CHAPITRE — ${title}\n\n${paragraphs.join('\n\n')}`;
}

function humansGone() {
  return [
    chapter('Le dernier matin', [
      'À 7 h 42, les villes fonctionnent encore comme si rien n’avait changé. Les feux de circulation changent de couleur, les ascenseurs terminent leurs trajets et des téléphones continuent de vibrer dans des appartements désormais silencieux.',
      'Puis la réalité apparaît : tous les humains ont disparu, partout sur Terre, au même instant. Il n’y a pas de survivants cachés dans une capitale, un bunker ou un village isolé.',
      'Les premières minutes sont étrangement ordinaires. Les bâtiments restent debout, les voitures restent garées et les ordinateurs continuent d’exécuter les tâches qu’ils avaient reçues avant la disparition.',
      'Dans une maison de Cotonou, un réfrigérateur ronronne encore. À l’hôpital, certains appareils poursuivent leurs cycles automatiques. Dans les aéroports, des systèmes de contrôle continuent de fonctionner avant que l’absence des opérateurs ne devienne impossible à compenser.'
    ]),
    chapter('Les premières heures', [
      'Les avions deviennent l’un des premiers problèmes visibles. Un appareil qui peut voler sans intervention humaine pendant quelques minutes ne peut pas pour autant terminer indéfiniment son trajet sans équipage.',
      'Les accidents ne surviennent pas tous au même moment. Ils dépendent de l’altitude, du carburant, de l’automatisation et des conditions météorologiques.',
      'Sur les routes, certaines voitures s’arrêtent simplement après avoir épuisé leur carburant. D’autres provoquent des collisions. Les feux continuent de changer, mais personne ne vient réparer les installations endommagées.',
      'Les réseaux électriques connaissent une situation différente selon les pays. Les protections automatiques peuvent isoler certaines pannes, mais elles ne peuvent pas remplacer les équipes qui surveillent, entretiennent et réparent les infrastructures.'
    ]),
    chapter('La première semaine', [
      'L’eau potable devient progressivement un problème majeur. Les stations de pompage peuvent fonctionner un certain temps, mais elles dépendent de l’électricité, de systèmes mécaniques et d’une maintenance régulière.',
      'Les supermarchés deviennent des bâtiments silencieux remplis de nourriture dont une partie se dégrade rapidement. Les aliments réfrigérés cessent d’être conservés lorsque les réseaux électriques tombent.',
      'Les chiens et les chats connaissent des destins différents. Un animal enfermé derrière une porte peut mourir rapidement, tandis qu’un autre parvient à sortir et découvre un environnement où les humains ne contrôlent plus les ressources.',
      'Dans les campagnes, certaines espèces domestiques ont davantage de chances de survivre. Les animaux capables de trouver de l’eau et de la nourriture sans assistance humaine commencent progressivement à occuper les espaces abandonnés.'
    ]),
    chapter('Les premiers mois', [
      'Les villes ne deviennent pas immédiatement des forêts. Les bâtiments sont encore là, les routes sont encore visibles et de nombreux objets témoignent de la présence récente de l’humanité.',
      'Mais l’entretien s’arrête partout en même temps. Une petite fissure qui aurait normalement été réparée devient une entrée pour l’eau. L’eau accélère ensuite la dégradation des matériaux.',
      'Les égouts et les stations de traitement cessent progressivement de fonctionner. Certaines régions sont inondées, d’autres connaissent des problèmes sanitaires et certaines infrastructures deviennent dangereuses.',
      'Les satellites continuent leur trajectoire pendant un certain temps, mais les systèmes qui dépendent d’une maintenance terrestre finissent par perdre des capacités. La disparition humaine devient alors visible même depuis l’espace.'
    ]),
    chapter('Dix ans plus tard', [
      'Une décennie suffit pour transformer profondément les espaces urbains. Les plantes occupent les fissures, les toits se dégradent et les bâtiments exposés à l’humidité commencent à perdre leurs parties les plus fragiles.',
      'Certaines espèces animales profitent de l’absence des humains. D’autres disparaissent parce qu’elles dépendaient entièrement de l’élevage ou de la protection humaine.',
      'Les infrastructures les plus solides restent visibles, mais leur fonction d’origine devient de moins en moins évidente. Une autoroute peut encore traverser une région tout en étant devenue impraticable.',
      'La Terre n’est pas devenue soudainement sauvage. Elle est devenue une planète où les ruines d’une civilisation industrielle coexistent avec des écosystèmes qui reprennent progressivement leur place.'
    ]),
    chapter('Un siècle plus tard', [
      'Cent ans passent. Les métaux ont rouillé, les vitres ont disparu de nombreux bâtiments et les racines ont pénétré des structures qui semblaient autrefois permanentes.',
      'Les grandes constructions ne disparaissent pas toutes au même rythme. Le climat, les matériaux, l’exposition à l’eau et la végétation déterminent leur durée de survie.',
      'Une bibliothèque peut encore contenir des milliers de livres, mais l’information qu’elle contient n’est plus organisée autour d’une société capable de l’utiliser.',
      'Une route disparaît sous la végétation. Un barrage peut encore être reconnaissable. Une ancienne ville devient progressivement un paysage où les humains sont devenus une trace archéologique récente.'
    ]),
    chapter('Mille ans plus tard', [
      'Mille ans après la disparition, une grande partie de la civilisation visible depuis la surface a été transformée. Certaines structures massives restent identifiables, mais beaucoup d’objets ordinaires ont disparu.',
      'Les espèces animales et végétales ont eu des siècles pour se réorganiser sans la pression quotidienne de milliards d’humains.',
      'Les anciennes frontières politiques n’ont plus aucune importance. Les anciennes capitales ne sont plus des capitales ; ce sont des lieux géographiques parmi d’autres.',
      'La planète n’a pas oublié qu’une civilisation a existé. Elle en conserve encore les traces, mais elle ne fonctionne plus selon les besoins de cette civilisation.'
    ])
  ].join('\n\n');
}

function beyonceScenario(facts = []) {
  const note = facts.length
    ? 'Des repères biographiques ont été récupérés. Ils servent uniquement de cadre réel avant la divergence fictive.'
    : 'Aucun repère externe n’a été récupéré ; les éléments biographiques non vérifiés doivent être considérés comme provisoires.';
  return [
    chapter('Avant la divergence', [
      `Dans notre réalité, Beyoncé est née en 1981 à Houston, au Texas, et a grandi dans une famille qui l’a accompagnée dans son parcours artistique. ${note}`,
      'Dans cette réalité alternative, une seule différence est imposée : Beyoncé est blanche. Tout le reste ne change pas automatiquement. Sa famille existe toujours, son environnement existe toujours et son talent musical doit toujours se développer par des années de travail.'
    ]),
    chapter('L’enfance', [
      'La différence apparaît d’abord dans le regard des autres. Les voisins, les camarades et les adultes interprètent son apparence à travers leurs propres habitudes sociales.',
      'Elle commence malgré tout à chanter, à travailler sa voix et à participer aux activités artistiques qui structurent son enfance. Rien ne permet de conclure qu’elle deviendrait automatiquement plus ou moins talentueuse simplement parce que son apparence est différente.',
      'Le premier effet important est social : les personnes qui la rencontrent construisent des attentes différentes autour d’elle, et ces attentes influencent certaines opportunités.'
    ]),
    chapter('Destiny’s Child', [
      'Lorsque le projet musical qui deviendra Destiny’s Child prend forme, la différence devient beaucoup plus visible. Une jeune femme blanche au sein d’un groupe fortement associé à la culture afro-américaine attire des réactions médiatiques différentes.',
      'Les producteurs doivent décider comment présenter le groupe. Certains pensent que cette particularité peut attirer l’attention ; d’autres craignent qu’elle détourne les discussions de la musique.',
      'Cette situation crée une première bifurcation : une décision marketing prise très tôt peut modifier les personnes rencontrées, les collaborations obtenues et même les chansons choisies plus tard.'
    ]),
    chapter('La carrière solo', [
      'Lorsque Beyoncé se lance en solo, elle dispose toujours d’un immense potentiel artistique, mais le public de cette réalité alternative n’est pas exactement celui de notre monde.',
      'Certaines chansons rencontrent le même succès, d’autres non. Un producteur qu’elle aurait rencontré dans notre réalité peut ne jamais la rencontrer dans cette trajectoire, tandis qu’une autre collaboration peut devenir décisive.',
      'Elle cherche progressivement à imposer une règle simple : être jugée d’abord comme une artiste. Cette résistance influence son image publique et ses choix professionnels.'
    ]),
    chapter('La nouvelle icône', [
      'À mesure que sa célébrité augmente, le monde commence à lui attribuer des significations contradictoires. Mais derrière le symbole reste une personne qui doit enregistrer, répéter, voyager, négocier et prendre des décisions.',
      'Au fil des années, les conséquences de la différence initiale deviennent impossibles à isoler. Une rencontre modifiée entraîne une collaboration différente ; une collaboration différente modifie une chanson ; une chanson modifie l’image publique ; cette image influence ensuite les décisions suivantes.',
      'Il n’existe plus une simple « Beyoncé blanche » placée dans notre histoire. Il existe une artiste dont la trajectoire entière a progressivement été reconstruite autour d’un premier changement.'
    ])
  ].join('\n\n');
}

function genericAlternative(prompt, facts = []) {
  const evidence = facts.length
    ? facts.map((f) => `${f.title}: ${f.snippet}`).join('\n')
    : 'Aucun repère externe n’a été récupéré.';
  return [
    chapter('Le point de divergence', [
      `La question est : « ${clean(prompt)} ».`,
      'La réalité de départ est conservée autant que possible. La condition modifiée est isolée avant de reconstruire les conséquences.',
      'Les faits réels servent de cadre. Les événements inventés à partir du point de divergence sont clairement une fiction et non des faits historiques.'
    ]),
    chapter('Les premières conséquences', [
      'Pendant les premières heures ou les premiers jours, la plupart des personnes ne comprennent pas encore l’importance du changement.',
      'Une première décision devient différente parce que la situation n’est plus exactement celle que les gens connaissaient.',
      'Cette décision crée une conséquence concrète, puis quelqu’un doit réagir à cette conséquence.',
      'Le monde commence alors à prendre une direction légèrement différente.'
    ]),
    chapter('La chaîne des décisions', [
      'Une conséquence entraîne une autre décision. Une nouvelle décision modifie une relation, une institution ou une opportunité.',
      'Certaines conséquences sont positives, d’autres sont dangereuses et certaines ne deviennent visibles que des années plus tard.',
      'La nouvelle réalité n’est donc pas une copie de notre monde : elle devient progressivement un système autonome.'
    ]),
    chapter('Une génération plus tard', [
      'Lorsque de nouvelles générations arrivent, elles grandissent dans un monde qui considère désormais la divergence comme normale.',
      'Les personnes nées après le changement ne comparent pas leur réalité à la nôtre. Elles construisent leurs propres habitudes, leurs propres conflits et leurs propres ambitions.',
      'C’est à ce moment que la petite différence initiale commence à produire des conséquences historiques majeures.'
    ]),
    chapter('Repères utilisés', [evidence])
  ].join('\n\n');
}

async function generate(prompt, mode = 'Long', allowResearch = true) {
  const type = classify(prompt);
  const facts = allowResearch && (type === 'REALITE_ALTERNATIVE' || type === 'INFORMATION') ? await research(prompt) : [];

  if (type === 'REALITE_ALTERNATIVE') {
    const kind = scenario(prompt);
    const text = kind === 'HUMANS_GONE'
      ? humansGone()
      : kind === 'BEYONCE'
        ? beyonceScenario(facts)
        : genericAlternative(prompt, facts);
    return { type, mode, text, research: facts };
  }

  if (type === 'INFORMATION') {
    return {
      type,
      mode,
      text: `Recherche initiale pour « ${clean(prompt)} » :\n\n${facts.length ? facts.map((f) => `• ${f.title} — ${f.snippet}`).join('\n') : 'Aucun résultat automatique n’a été trouvé.'}\n\nLes résultats sont des repères et ne remplacent pas la vérification auprès de sources spécialisées.`,
      research: facts
    };
  }

  if (type === 'RECIT') {
    return {
      type,
      mode,
      text: chapter('Le commencement', [
        `${clean(prompt)}.`,
        'La scène commence sans narration automatique sur une « réalité alternative ». Les personnages ont des objectifs différents et la situation évolue à partir de leurs décisions.',
        'Un événement inattendu crée un conflit. Quelqu’un choisit d’agir, quelqu’un d’autre refuse, et cette opposition entraîne la scène suivante.',
        'L’histoire peut ensuite évoluer selon les actions de l’utilisateur.'
      ]),
      research: []
    };
  }

  return {
    type,
    mode,
    text: `J’ai compris : ${clean(prompt)}. Donne-moi une situation précise si tu veux une simulation, une histoire ou une explication.`,
    research: []
  };
}

// Render runs this server from /server while index.html lives at the repository root.
app.get('/', (_req, res) => res.sendFile(FRONTEND));

app.get('/health', (_req, res) => res.status(200).json({
  ok: true,
  model: MODEL,
  engine: 'context-aware lightweight narrative engine',
  status: 'healthy'
}));

app.get('/test', async (_req, res) => {
  try {
    const result = await generate('Et si les humains disparaissaient demain ?', 'Test', false);
    res.status(200).json({ ok: true, model: MODEL, ...result });
  } catch (error) {
    console.error('TEST_ERROR', error);
    res.status(500).json({ ok: false, error: 'test_failed', detail: String(error?.message || error) });
  }
});

app.post('/generate', async (req, res) => {
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  const mode = typeof req.body?.mode === 'string' ? req.body.mode.slice(0, 30) : 'Long';

  if (!prompt) return res.status(400).json({ ok: false, error: 'prompt_required' });
  if (prompt.length > MAX_PROMPT) return res.status(413).json({ ok: false, error: 'prompt_too_long', max: MAX_PROMPT });

  try {
    const result = await generate(prompt, mode, true);
    res.status(200).json({ ok: true, model: MODEL, ...result });
  } catch (error) {
    console.error('GENERATION_ERROR', error);
    res.status(500).json({ ok: false, error: 'generation_failed', detail: String(error?.message || error) });
  }
});

app.use((_req, res) => res.status(404).json({ ok: false, error: 'not_found' }));
app.use((error, _req, res, _next) => {
  console.error('HTTP_ERROR', error);
  if (res.headersSent) return;
  res.status(500).json({ ok: false, error: 'server_error' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Et Si? AI server listening on ${PORT}`);
});
server.requestTimeout = 30000;
server.headersTimeout = 35000;
server.keepAliveTimeout = 5000;

process.on('unhandledRejection', (reason) => console.error('UNHANDLED_REJECTION', reason));
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT_EXCEPTION', error);
  server.close(() => process.exit(1));
});
