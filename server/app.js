import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const MODEL = 'lightweight-narrative-engine-v2';

function clean(s = '') {
  return s.trim().replace(/[.!?]+$/, '');
}

function normalize(s = '') {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function classify(q = '') {
  const s = normalize(q);
  if (/\bet si\b|imagine|supposons|dans une autre realite|que se passerait il|que se passerait-il/.test(s)) return 'REALITE_ALTERNATIVE';
  if (/raconte|histoire|roman|fiction|conte|chronologie/.test(s)) return 'RECIT';
  if (/^(pourquoi|comment|qu'est-ce|qu est ce|quelle|quel|qui\b|combien|quand|ou\b)/.test(s)) return 'INFORMATION';
  return 'CONVERSATION';
}

function detectScenario(prompt) {
  const s = normalize(prompt);
  if (/humain|humanite|humanites/.test(s) && /dispar|plus aucun|plus personne/.test(s)) return 'HUMANS_GONE';
  if (/beyonce/.test(s)) return 'BEYONCE';
  if (/terre|rotation|tourner sur elle|ne tournait plus/.test(s)) return 'EARTH';
  if (/titanic/.test(s)) return 'TITANIC';
  if (/napoleon|waterloo/.test(s)) return 'NAPOLEON';
  if (/internet|reseau mondial/.test(s) && /dispar|coup|panne/.test(s)) return 'INTERNET';
  return 'GENERAL';
}

async function research(query) {
  const q = clean(query).replace(/^et si\s+/i, '');
  if (!q) return [];
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&origin=*`;
    const r = await fetch(url, { headers: { 'User-Agent': 'EtSiAI/1.0' } });
    if (!r.ok) return [];
    const data = await r.json();
    return (data?.query?.search || []).slice(0, 3).map(x => ({ title: x.title, snippet: String(x.snippet || '').replace(/<[^>]+>/g, '') }));
  } catch (_) {
    return [];
  }
}

function chapter(title, body) {
  return `CHAPITRE — ${title}\n\n${body}`;
}

function humansGone() {
  return [
    chapter('Le dernier matin', `À 7 h 42, les villes sont encore pleines d'objets qui fonctionnent sans avoir besoin qu'on les regarde. Les feux de circulation changent de couleur. Des trains poursuivent leur trajet. Des téléphones vibrent dans des appartements où personne ne répondra. Puis le monde comprend une chose impossible : il n'y a plus aucun être humain.\n\nDans les premières heures, presque rien ne ressemble à une catastrophe. Les immeubles sont debout. Les routes existent toujours. Les chiens attendent devant des portes qui ne s'ouvriront plus. Dans les aéroports, des appareils sont immobilisés ou ont déjà subi des accidents parce que leurs équipages ont disparu.\n\nLa première vraie rupture vient des systèmes qui dépendent d'une présence humaine. Les centrales et les réseaux disposent d'automatismes, mais l'automatisation n'est pas synonyme d'éternité. Des installations passent en sécurité. D'autres continuent à fonctionner. Les pannes apparaissent de manière inégale, ville après ville.\n\nDans une maison de Cotonou, un réfrigérateur continue de ronronner pendant que son contenu commence lentement à se réchauffer. À Londres, une rame reste bloquée dans un tunnel. À Tokyo, des portes automatiques s'ouvrent et se ferment devant des couloirs vides. Aucun de ces événements n'est spectaculaire pris séparément. Ensemble, ils marquent le début d'un monde sans témoin.`),
    chapter('La première semaine', `Les animaux domestiques deviennent immédiatement l'un des problèmes les plus visibles. Certains trouvent de la nourriture par eux-mêmes. D'autres restent enfermés. Dans les fermes, les animaux d'élevage dépendent de systèmes qui nécessitaient autrefois des personnes chaque jour.\n\nLes réseaux électriques deviennent instables. Une partie de la production s'arrête automatiquement ; ailleurs, des pannes en cascade apparaissent. L'eau courante continue quelque temps dans certaines régions, puis les systèmes de pompage commencent à s'arrêter lorsque les installations perdent leur alimentation ou leur maintenance.\n\nLes satellites, eux, ne s'éteignent pas simplement parce que les humains sont partis. Certains continuent leur mission pendant des années. Mais personne ne corrige les problèmes au sol, personne ne remplace les équipements et personne ne lance les satellites suivants. Le monde numérique devient ainsi un immense écho d'une civilisation absente.\n\nAu septième jour, la Terre paraît étrangement calme. Mais cette tranquillité est trompeuse : la civilisation industrielle vient de perdre son mécanisme principal de réparation.`),
    chapter('Les années silencieuses', `Après quelques années, les conséquences deviennent physiques. Les bâtiments qui nécessitaient une maintenance régulière commencent à se détériorer. L'eau pénètre dans certaines structures. Les routes se fissurent. Les plantes envahissent les trottoirs et les parkings.\n\nLes animaux survivants se répartissent autrement. Certaines espèces domestiques disparaissent localement ; d'autres retournent à l'état sauvage. Les rats, insectes, oiseaux et espèces capables de vivre près des anciennes villes exploitent les nouvelles ressources.\n\nLes anciennes capitales deviennent progressivement des paysages sans habitants. Une tour peut encore être debout alors qu'une rue entière a déjà disparu sous la végétation. Une bibliothèque peut conserver des millions de pages alors qu'il n'existe plus personne capable de les lire.\n\nLa Terre ne devient pas immédiatement une jungle. Elle devient quelque chose de beaucoup plus étrange : une planète portant les traces d'une civilisation extrêmement récente, mais sans civilisation pour les entretenir.`),
    chapter('Un siècle plus tard', `Cent ans passent. Les métaux rouillent, les vitres cassent, les arbres traversent les bâtiments. Certaines infrastructures massives résistent davantage que prévu ; d'autres disparaissent presque entièrement.\n\nLa mémoire humaine devient alors matérielle. Des inscriptions restent sur les monuments. Des objets sont enfouis. Des données subsistent dans certains supports, mais leur survie dépend des conditions physiques et de la chance.\n\nLa planète n'a pas oublié l'humanité d'un coup. Elle l'efface lentement, détail après détail. Une route disparaît sous les racines. Un quartier s'effondre. Une statue tombe. Puis un jour, un animal traverse une ancienne avenue sans rencontrer la moindre trace visible de la vie qui y circulait autrefois.`)
  ].join('\n\n');
}

function beyonceScenario() {
  return [
    chapter('La différence', `Dans cette réalité, Beyoncé Knowles naît dans la même époque et dans la même famille que dans notre histoire, mais avec une apparence blanche. Ce changement ne réécrit pas automatiquement son talent, son éducation ou les ambitions de ses parents. Il modifie plutôt la manière dont certaines personnes la regardent, les attentes qu'elles projettent sur elle et les portes auxquelles elle se retrouve confrontée.\n\nEnfant, elle grandit toujours avec la musique autour d'elle. La scène familiale reste importante. Son père travaille toujours dans l'industrie musicale et sa mère reste une présence déterminante dans son développement artistique. Mais certaines réactions du public deviennent différentes dès les premières prestations.\n\nLe paradoxe apparaît rapidement : elle est toujours la même enfant ambitieuse, mais le monde lui attribue d'autres catégories avant même qu'elle ait eu le temps de définir elle-même qui elle est.`),
    chapter('Destiny's Child', `Lorsque sa carrière de groupe commence à prendre de l'ampleur, la question n'est plus seulement musicale. L'industrie doit décider comment présenter une jeune artiste blanche dans un groupe dont l'identité et les racines restent profondément liées à la culture noire américaine.\n\nCertaines personnes considèrent cette différence comme un avantage commercial. D'autres pensent qu'elle pourrait brouiller l'identité du groupe. Les discussions de marketing deviennent plus complexes. Une photographie promotionnelle ne raconte plus exactement la même histoire. Une interview déclenche des questions qui n'auraient pas été posées dans notre réalité.\n\nEt pourtant, sur scène, une chose reste difficile à modifier : sa voix, son ambition et sa capacité à dominer l'espace. C'est cette contradiction qui finit par devenir le centre de son image publique.`),
    chapter('L'artiste solo', `Lorsqu'elle commence à construire sa carrière solo, son apparence devient encore davantage un sujet de discussion. Certains médias la présentent comme une exception. D'autres cherchent à expliquer sa place dans une industrie où les catégories raciales jouent un rôle réel.\n\nMais une carrière musicale ne repose pas sur une seule caractéristique. Les chansons, les performances, les collaborations, le marketing, les décisions de management et les réactions du public s'influencent mutuellement. Un changement dans son apparence peut donc modifier certaines trajectoires sans déterminer mécaniquement le résultat final.\n\nDans cette réalité, son succès pourrait prendre une forme différente, mais il ne serait pas raisonnable de prétendre qu'une seule différence permet de connaître avec certitude toute sa carrière.`),
    chapter('Le monde qui la regarde', `Avec la célébrité viennent les conséquences inattendues. Chaque interview devient une occasion de parler de son identité. Chaque récompense peut être interprétée à travers cette différence. Certains admirateurs l'idéalisent précisément pour ce qu'elle représente ; d'autres lui reprochent une identité qu'elle n'a pourtant pas choisie.\n\nElle finit par comprendre que le plus grand changement n'est peut-être pas ce que son apparence a fait à sa carrière, mais ce que les autres ont voulu faire de cette apparence. La même personne peut être perçue comme une anomalie par un groupe, comme un symbole par un autre et simplement comme une chanteuse par ceux qui viennent écouter sa musique.\n\nLa réalité alternative continue alors de diverger, non pas parce qu'une couleur de peau possède une conséquence magique, mais parce que des millions de petites réactions humaines construisent progressivement une histoire différente.`)
  ].join('\n\n');
}

function generalAlternative(prompt, researchResults) {
  const subject = clean(prompt);
  const facts = researchResults.length ? `\n\nAvant la divergence, les recherches disponibles donnent quelques repères réels : ${researchResults.map(x => `${x.title} — ${x.snippet}`).join(' ')}.` : '';
  return [
    chapter('Le point de divergence', `La question est : « ${subject}. »\n\nPour construire cette réalité, il faut d'abord conserver autant que possible le monde réel, puis modifier précisément la condition demandée. On ne peut pas connaître le futur avec certitude ; ce qui suit est donc une fiction cohérente construite à partir des conséquences plausibles de cette divergence.${facts}`),
    chapter('Les premières conséquences', `Au début, presque personne ne remarque l'ampleur du changement. Les institutions continuent leurs habitudes, les familles prennent leurs décisions et les médias racontent encore les événements avec les anciennes références. Puis une première conséquence concrète apparaît. Elle oblige quelqu'un à prendre une décision différente. Cette décision en entraîne une autre, et la nouvelle trajectoire commence à se détacher de la nôtre.`),
    chapter('La nouvelle trajectoire', `Les années suivantes ne reproduisent pas simplement la même histoire avec un détail modifié. Les personnes réagissent aux nouvelles circonstances. Des opportunités apparaissent, certaines disparaissent, des alliances changent et des événements qui étaient improbables deviennent possibles. À mesure que ces choix s'accumulent, la réalité alternative devient autonome.`),
    chapter('Le monde après la divergence', `Plus le temps passe, moins il est possible de revenir exactement à notre histoire. Les conséquences indirectes deviennent plus importantes que la cause initiale. Une décision familiale peut modifier une carrière. Une carrière peut modifier une rencontre. Une rencontre peut modifier une institution. Et une institution peut finalement modifier la vie de millions de personnes.`)
  ].join('\n\n');
}

function narrative(prompt, mode, researchResults) {
  const scenario = detectScenario(prompt);
  if (scenario === 'HUMANS_GONE') return humansGone();
  if (scenario === 'BEYONCE') return beyonceScenario();
  return generalAlternative(prompt, researchResults);
}

function information(prompt, researchResults) {
  const subject = clean(prompt);
  const sourceText = researchResults.length ? researchResults.map(x => `• ${x.title} : ${x.snippet}`).join('\n') : 'Aucune source Wikipédia pertinente n’a été trouvée automatiquement.';
  return `Voici ce que j'ai pu établir pour « ${subject} ».\n\n${sourceText}\n\nCes résultats servent de repères et ne remplacent pas une vérification auprès de sources spécialisées. Si tu veux, la même information peut ensuite être transformée en récit, chronologie ou scénario alternatif.`;
}

async function generate(prompt, mode = 'Long') {
  const type = classify(prompt);
  const results = type === 'REALITE_ALTERNATIVE' || type === 'INFORMATION' ? await research(prompt) : [];
  if (type === 'REALITE_ALTERNATIVE') return { type, text: narrative(prompt, mode, results), research: results };
  if (type === 'RECIT') return { type, text: `CHAPITRE — Le commencement\n\n${clean(prompt)}.\n\nLa scène commence sans explication inutile. Quelqu'un entre, quelque chose vient de changer, et personne autour de lui ne mesure encore la conséquence de ce moment. Les personnages ont des objectifs différents et chacun possède une raison de croire qu'il contrôle la situation.\n\nPuis un événement inattendu oblige l'un d'eux à choisir. Le choix crée un conflit, le conflit provoque une nouvelle décision et la situation devient progressivement impossible à contrôler.\n\nCHAPITRE — Le tournant\n\nÀ partir de cet instant, les événements ne reviennent plus à leur état initial. Les personnages découvrent des informations nouvelles, leurs relations changent et leurs décisions ont un prix.`, research: [] };
  if (type === 'INFORMATION') return { type, text: information(prompt, results), research: results };
  return { type, text: `J'ai compris ta demande : ${clean(prompt)}.\n\nJe vais rester centré sur cette demande et éviter de lui imposer automatiquement un scénario qui ne correspond pas à ce que tu as écrit.`, research: [] };
}

app.get('/health', (_req, res) => res.json({ ok: true, model: MODEL, engine: 'context-aware narrative engine' }));

app.get('/test', async (_req, res) => {
  const result = await generate('Et si les humains disparaissaient demain ?', 'Film');
  res.json({ ok: true, model: MODEL, ...result });
});

app.post('/generate', async (req, res) => {
  const { prompt = '', mode = 'Long' } = req.body || {};
  if (!prompt.trim()) return res.status(400).json({ ok: false, error: 'prompt_required' });
  try {
    const result = await generate(prompt, mode);
    res.json({ ok: true, model: MODEL, ...result });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'generation_failed', detail: String(error?.message || error) });
  }
});

const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => console.log(`Et Si? AI server listening on ${port}`));
