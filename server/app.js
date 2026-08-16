import express from 'express';
import cors from 'cors';
import { pipeline, env } from '@huggingface/transformers';

env.cacheDir = './.cache';
env.allowLocalModels = false;
env.allowRemoteModels = true;

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

let generatorPromise = null;
const MODEL = 'onnx-community/SmolLM2-135M-Instruct-ONNX';

function getGenerator() {
  if (!generatorPromise) {
    generatorPromise = pipeline('text-generation', MODEL, { dtype: 'q4f16' });
  }
  return generatorPromise;
}

function classify(q) {
  const s = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/\bet si\b|imagine|supposons|dans une autre realite/.test(s)) return 'REALITE_ALTERNATIVE';
  if (/^(pourquoi|comment|qu'est-ce|quelle|quel|qui\b)/.test(s)) return 'INFORMATION';
  if (/raconte|histoire|roman|chronologie/.test(s)) return 'RECIT';
  return 'CONVERSATION';
}

function instruction({ prompt, memory = '', context = '', mode = 'Long' }) {
  const kind = classify(prompt);
  return `Tu es Et Si ?, une petite IA narrative en français.\nType: ${kind}\nMode: ${mode}\n\nDemande utilisateur:\n${prompt}\n\nContexte réel vérifié fourni par le système:\n${context || 'Aucun contexte externe.'}\n\nMémoire précédente:\n${memory || 'Aucune.'}\n\nConsignes:\n- Comprends exactement la demande et reste sur le sujet.\n- Pour une réalité alternative, pars d'un point de divergence précis puis fais évoluer les conséquences.\n- Ne transforme pas une personne, un événement ou une expression en faux nom de personnage.\n- Utilise des personnages nommés quand ils existent et crée des personnages seulement quand l'histoire en a besoin.\n- Chaque scène doit apporter un événement, une décision, une émotion, un conflit ou une conséquence nouvelle.\n- Ne répète pas les mêmes phrases ni les mêmes scènes.\n- N'affirme pas comme réel ce qui est inventé.\n- Écris naturellement, avec narration et dialogues lorsque cela sert l'histoire.\n- Continue à partir de la mémoire sans recommencer.\n\nRéponse:`;
}

app.get('/health', async (_req, res) => {
  res.json({ ok: true, model: MODEL, engine: 'Transformers.js server' });
});

app.post('/generate', async (req, res) => {
  try {
    const { prompt = '', memory = '', context = '', mode = 'Long' } = req.body || {};
    if (!prompt.trim()) return res.status(400).json({ ok: false, error: 'prompt_required' });
    const generator = await getGenerator();
    const max = mode === 'Film' ? 700 : mode === 'Épique' ? 650 : 550;
    const output = await generator(instruction({ prompt, memory, context, mode }), {
      max_new_tokens: max,
      do_sample: true,
      temperature: 0.82,
      top_p: 0.92,
      repetition_penalty: 1.15,
      return_full_text: false
    });
    res.json({ ok: true, text: output?.[0]?.generated_text || '', model: MODEL });
  } catch (error) {
    console.error(error);
    generatorPromise = null;
    res.status(503).json({ ok: false, error: 'model_unavailable', detail: String(error?.message || error) });
  }
});

const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => console.log(`Et Si? AI server listening on ${port}`));
