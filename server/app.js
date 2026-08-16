import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const MODEL = 'lightweight-narrative-engine';

function classify(q = '') {
  const s = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/\bet si\b|imagine|supposons|dans une autre realite/.test(s)) return 'REALITE_ALTERNATIVE';
  if (/raconte|histoire|roman|chronologie/.test(s)) return 'RECIT';
  if (/^(pourquoi|comment|qu'est-ce|quelle|quel|qui\b)/.test(s)) return 'INFORMATION';
  return 'CONVERSATION';
}

function generateLightweight({ prompt, mode = 'Long' }) {
  const kind = classify(prompt);
  const subject = prompt.trim().replace(/[.!?]+$/, '');

  if (kind === 'REALITE_ALTERNATIVE') {
    return `Tout commence avec une seule différence : ${subject}.\n\nDans cette réalité, personne ne comprend immédiatement que ce détail va changer la suite. Au début, la vie ressemble encore à celle que nous connaissons. Les mêmes rues sont là, les mêmes conversations ont lieu, et les gens poursuivent leurs journées sans imaginer que l'histoire vient de prendre une autre direction.\n\nPuis les premières conséquences apparaissent. Une décision qui aurait été insignifiante dans notre monde devient soudain importante. Une rencontre arrive plus tôt que prévu. Une personne fait un choix différent parce que les circonstances ont changé. Ce choix en entraîne un autre, puis un autre encore.\n\nQuelques années passent. Les conséquences deviennent visibles dans les relations, les carrières, les familles et les événements publics. Ce qui semblait être une simple différence au départ a créé une chaîne de décisions que personne n'avait planifiée.\n\nLa nouvelle réalité ne copie donc pas notre monde avec un détail modifié : elle construit progressivement sa propre histoire. Et plus les années passent, plus il devient difficile de revenir au chemin que nous connaissons.\n\n${mode === 'Film' || mode === 'Épique' ? 'La scène suivante commence alors que tout le monde croit avoir compris ce qui se passe. C’est précisément à ce moment qu’un nouvel événement vient bouleverser la trajectoire.' : ''}`;
  }

  if (kind === 'RECIT') {
    return `L'histoire commence au moment où ${subject}.\n\nAu début, personne ne sait encore quelle importance cette scène prendra. Les personnages avancent avec leurs propres objectifs, leurs peurs et leurs contradictions. Une décision en apparence banale crée pourtant une première tension.\n\nPuis les événements s'accélèrent. Une information change la perception de la situation, une rencontre modifie les plans et un choix difficile oblige chacun à prendre position.\n\nÀ partir de là, chaque action produit une conséquence nouvelle. L'histoire avance, les relations évoluent et ce qui semblait simple devient progressivement beaucoup plus compliqué.`;
  }

  if (kind === 'INFORMATION') {
    return `Ta question porte sur : ${subject}.\n\nPour y répondre correctement, il faut d'abord identifier précisément ce que tu demandes, puis distinguer les faits établis des interprétations et des exemples. Je peux ensuite développer la réponse étape par étape sans changer de sujet.`;
  }

  return `J'ai compris ta demande : ${subject}.\n\nJe vais rester centré sur ce que tu demandes plutôt que d'appliquer automatiquement un scénario prédéfini. Le résultat dépendra du contexte, du type de demande et des informations fournies.`;
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, model: MODEL, engine: 'lightweight server engine' });
});

app.get('/test', (_req, res) => {
  const text = generateLightweight({ prompt: 'Et si les humains disparaissaient demain ?', mode: 'Test' });
  res.json({ ok: true, model: MODEL, text });
});

app.post('/generate', (req, res) => {
  const { prompt = '', mode = 'Long' } = req.body || {};
  if (!prompt.trim()) return res.status(400).json({ ok: false, error: 'prompt_required' });
  res.json({ ok: true, model: MODEL, text: generateLightweight({ prompt, mode }), type: classify(prompt) });
});

const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => console.log(`Et Si? AI server listening on ${port}`));
