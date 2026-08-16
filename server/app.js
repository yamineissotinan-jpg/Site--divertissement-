import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const MODEL = 'lightweight-narrative-engine-v3';

function normalize(text = '') {
  return String(text).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function clean(text = '') {
  return String(text).trim().replace(/[.!?]+$/, '');
}

function classify(prompt = '') {
  const s = normalize(prompt);
  if (/\bet si\b|\bimagine\b|\bsupposons\b|\bdans une autre realite\b|\bque se passerait il\b|\bque se passerait-il\b/.test(s)) return 'REALITE_ALTERNATIVE';
  if (/\braconte\b|\bhistoire\b|\broman\b|\bfiction\b|\bconte\b|\bchronologie\b/.test(s)) return 'RECIT';
  if (/^(pourquoi|comment|qu est ce|qu'est-ce|quelle|quel|qui\b|combien|quand|ou\b)/.test(s)) return 'INFORMATION';
  return 'CONVERSATION';
}

function scenario(prompt = '') {
  const s = normalize(prompt);
  if (/(humain|humanite)/.test(s) && /(dispar|plus aucun|plus personne)/.test(s)) return 'HUMANS_GONE';
  if (/\bbeyonce\b/.test(s)) return 'BEYONCE';
  if (/\btitanic\b/.test(s)) return 'TITANIC';
  if (/\bnapoleon\b|\bwaterloo\b/.test(s)) return 'NAPOLEON';
  if (/\bterre\b/.test(s) && /(rotation|tourne|tournait)/.test(s)) return 'EARTH';
  return 'GENERAL';
}

async function research(query = '') {
  const q = clean(query).replace(/^et si\s+/i, '');
  if (!q) return [];
  try {
    const url = 'https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=' + encodeURIComponent(q) + '&format=json&origin=*';
    const response = await fetch(url, { headers: { 'User-Agent': 'EtSiAI/1.0' } });
    if (!response.ok) return [];
    const data = await response.json();
    const rows = Array.isArray(data?.query?.search) ? data.query.search : [];
    return rows.slice(0, 5).map((row) => ({
      title: row.title,
      snippet: String(row.snippet || '').replace(/<[^>]+>/g, '')
    }));
  } catch {
    return [];
  }
}

function chapter(title, paragraphs) {
  return `CHAPITRE — ${title}\n\n${paragraphs.join('\n\n')}`;
}

function humansGone() {
  return [
    chapter('Le dernier matin', [
      'À 7 h 42, les villes fonctionnent encore comme si rien n’avait changé. Les feux de circulation changent de couleur, les ascenseurs terminent leurs trajets et des téléphones continuent de vibrer dans des appartements désormais silencieux.',
      'Puis la réalité apparaît : les humains ont disparu. Pas une ville. Pas un pays. Tous les humains, partout sur Terre, au même instant.',
      'Les premières minutes ne ressemblent pourtant pas à la fin du monde. Les bâtiments sont debout, les voitures sont garées, les serveurs fonctionnent et certains avions poursuivent leur trajectoire avant que l’absence de leurs équipages ne provoque les premiers accidents.',
      'Dans une maison de Cotonou, un réfrigérateur continue de ronronner. Personne ne sait qu’il vient d’entrer dans les dernières heures de son fonctionnement normal.'
    ]),
    chapter('Les sept premiers jours', [
      'Les systèmes automatisés continuent pendant un temps, mais ils ne savent pas remplacer les millions de personnes qui surveillaient, réparaient et approvisionnaient la civilisation.',
      'Les réseaux électriques deviennent instables. Certaines installations se mettent automatiquement en sécurité. D’autres continuent de produire jusqu’à ce qu’une panne locale provoque une nouvelle panne ailleurs.',
      'Les animaux domestiques deviennent rapidement vulnérables. Certains chiens et chats trouvent des sorties et apprennent à chercher de la nourriture. D’autres restent enfermés derrière des portes que personne ne viendra ouvrir.',
      'L’eau courante disparaît progressivement dans les régions où les stations de pompage dépendent d’une alimentation et d’une maintenance continues.'
    ]),
    chapter('Les premières années', [
      'Les villes commencent à changer. Les mauvaises herbes envahissent les trottoirs, les racines soulèvent l’asphalte et l’eau s’infiltre dans des bâtiments qui étaient autrefois inspectés chaque année.',
      'Les satellites ne disparaissent pas instantanément. Certains continuent à transmettre pendant des années, mais personne ne remplace les équipements défaillants et personne ne lance les engins qui auraient dû prendre leur relève.',
      'Les animaux capables de s’adapter aux villes abandonnées profitent de cet immense territoire nouveau. Certaines espèces domestiques disparaissent tandis que d’autres retournent progressivement à l’état sauvage.',
      'Le monde ne devient donc pas immédiatement une jungle. Il devient une civilisation abandonnée, encore reconnaissable, mais incapable de se réparer.'
    ]),
    chapter('Un siècle plus tard', [
      'Cent ans passent. Les métaux rouillent, les vitres éclatent, les toits s’effondrent et les arbres traversent les anciens bâtiments.',
      'Certaines infrastructures massives résistent beaucoup plus longtemps que les objets ordinaires. D’autres disparaissent presque entièrement.',
      'Les traces de l’humanité deviennent de plus en plus rares. Une route disparaît sous la végétation. Une bibliothèque reste debout mais ne contient plus personne capable de lire ses livres.',
      'La Terre n’efface pas l’humanité en une journée. Elle l’efface lentement, morceau par morceau, jusqu’à ce que la planète ressemble davantage à un monde qui a hérité des ruines d’une civilisation qu’à un monde qui l’a simplement perdue.'
    ])
  ].join('\n\n');
}

function beyonceScenario() {
  return [
    chapter('La naissance d’une différence', [
      'Dans cette réalité alternative, Beyoncé naît dans la même époque et dans la même famille que dans notre histoire, mais elle est blanche.',
      'Ce changement ne transforme pas magiquement son talent. Sa famille, son environnement musical et son ambition restent les points de départ. Ce qui change, c’est la manière dont les autres la perçoivent et les réactions que cette différence provoque.',
      'Dès l’enfance, certaines personnes la remarquent pour des raisons qui n’ont rien à voir avec sa voix. Sa famille doit parfois répondre à des questions qui n’existeraient pas dans notre réalité.'
    ]),
    chapter('L’adolescence et le groupe', [
      'Lorsque sa carrière de groupe commence à prendre de l’ampleur, son apparence devient une question supplémentaire pour les responsables du marketing.',
      'Le groupe conserve son identité musicale, mais les journalistes et le public interprètent différemment la présence d’une jeune femme blanche au milieu de cette formation.',
      'Certaines personnes y voient un avantage commercial. D’autres craignent que cela brouille le récit culturel du groupe. Ces réactions influencent les interviews, les photographies et certaines décisions professionnelles.'
    ]),
    chapter('La carrière solo', [
      'Lorsqu’elle devient une artiste solo, la question devient encore plus visible. Son apparence fait partie des sujets dont les médias parlent, parfois davantage que sa musique.',
      'Mais une carrière dépend aussi des chansons, des producteurs, des collaborations, du management, du public et des décisions prises année après année.',
      'Dans cette réalité, sa trajectoire pourrait donc être très différente sans que l’on puisse prétendre connaître chaque événement avec certitude. Une différence initiale crée des possibilités différentes ; elle ne détermine pas mécaniquement chaque résultat.'
    ]),
    chapter('Le nouveau symbole', [
      'À mesure que sa célébrité augmente, certaines personnes commencent à projeter sur elle des significations qu’elle n’a jamais demandées.',
      'Elle peut devenir simultanément une artiste, une curiosité médiatique, un symbole pour certains et une cible pour d’autres.',
      'Le changement le plus important ne vient alors plus seulement de son apparence, mais des millions de réactions humaines que cette apparence déclenche au fil de sa carrière.'
    ])
  ].join('\n\n');
}

function generalAlternative(prompt, facts) {
  const factText = facts.length ? '\n\nRepères trouvés pendant la recherche :\n' + facts.map((f) => `• ${f.title} — ${f.snippet}`).join('\n') : '';
  return [
    chapter('Le point de divergence', [
      `La question posée est : « ${clean(prompt)} »`,
      'La réalité de départ est conservée autant que possible. Une seule condition demandée par l’utilisateur change, puis les conséquences sont reconstruites progressivement.',
      'Les événements qui suivent sont une fiction alternative. Ils ne prétendent pas être des prédictions certaines.'
    ]),
    chapter('Les premières conséquences', [
      'Au début, la plupart des personnes continuent leur vie normalement. La divergence est encore trop récente pour modifier immédiatement toutes les institutions.',
      'Puis une première conséquence concrète apparaît. Une personne doit prendre une décision différente de celle qu’elle aurait prise dans notre réalité.',
      'Cette décision crée une nouvelle branche. D’autres personnes réagissent à leur tour et la trajectoire commence à s’éloigner de notre histoire.'
    ]),
    chapter('La nouvelle trajectoire', [
      'Les années suivantes ne consistent pas à répéter notre histoire avec un détail différent. Les personnes adaptent leurs comportements aux nouvelles circonstances.',
      'Certaines opportunités apparaissent, d’autres disparaissent. Des rencontres changent. Des conflits deviennent possibles alors qu’ils ne l’étaient pas auparavant.',
      'À mesure que les décisions s’accumulent, la nouvelle réalité devient autonome.'
    ]),
    chapter('Une histoire qui échappe à son origine', [
      'Plus le temps passe, moins la cause initiale suffit à expliquer ce qui se produit.',
      'Une décision familiale peut modifier une carrière. Une carrière peut provoquer une rencontre. Une rencontre peut influencer une institution.',
      'La conséquence finale peut alors devenir beaucoup plus importante que la différence qui avait déclenché toute l’histoire.'
    ])
  ].join('\n\n') + factText;
}

async function generate(prompt, mode = 'Long') {
  const type = classify(prompt);
  const facts = (type === 'REALITE_ALTERNATIVE' || type === 'INFORMATION') ? await research(prompt) : [];

  if (type === 'REALITE_ALTERNATIVE') {
    const kind = scenario(prompt);
    let text;
    if (kind === 'HUMANS_GONE') text = humansGone();
    else if (kind === 'BEYONCE') text = beyonceScenario();
    else text = generalAlternative(prompt, facts);
    return { type, mode, text, research: facts };
  }

  if (type === 'INFORMATION') {
    const sourceText = facts.length ? facts.map((f) => `• ${f.title} : ${f.snippet}`).join('\n') : 'Aucune source Wikipédia pertinente n’a été trouvée automatiquement.';
    return {
      type,
      mode,
      text: `Voici les repères trouvés pour « ${clean(prompt)} ».\n\n${sourceText}\n\nCes résultats servent de points de départ et doivent être vérifiés avec des sources spécialisées pour une information importante.`,
      research: facts
    };
  }

  if (type === 'RECIT') {
    return {
      type,
      mode,
      text: chapter('Le commencement', [
        `${clean(prompt)}.`,
        'La scène commence au moment où quelque chose vient de changer. Les personnages ne possèdent pas tous les mêmes objectifs et chacun croit encore contrôler la situation.',
        'Puis un événement inattendu oblige l’un d’eux à choisir. Le choix crée un conflit et le conflit entraîne une nouvelle décision.',
        'À partir de là, les conséquences commencent à s’enchaîner.'
      ]),
      research: []
    };
  }

  return {
    type,
    mode,
    text: `J’ai compris ta demande : ${clean(prompt)}.\n\nJe vais rester centré sur cette demande au lieu de lui appliquer automatiquement un scénario prédéfini.`,
    research: []
  };
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, model: MODEL, engine: 'context-aware lightweight narrative engine' });
});

app.get('/test', async (_req, res) => {
  try {
    const result = await generate('Et si les humains disparaissaient demain ?', 'Test');
    res.json({ ok: true, model: MODEL, ...result });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'test_failed', detail: String(error?.message || error) });
  }
});

app.post('/generate', async (req, res) => {
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt : '';
  const mode = typeof req.body?.mode === 'string' ? req.body.mode : 'Long';
  if (!prompt.trim()) return res.status(400).json({ ok: false, error: 'prompt_required' });
  try {
    const result = await generate(prompt, mode);
    res.json({ ok: true, model: MODEL, ...result });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'generation_failed', detail: String(error?.message || error) });
  }
});

const port = Number(process.env.PORT || 10000);
app.listen(port, '0.0.0.0', () => console.log(`Et Si? AI server listening on ${port}`));
