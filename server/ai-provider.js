const API_KEY = process.env.AI_API_KEY || '';
const API_URL = process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.AI_MODEL || '';
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 45000);

export const aiConfigured = Boolean(API_KEY && MODEL);
export const aiModel = MODEL || 'local-fallback';

function extractText(data) {
  const choice = data?.choices?.[0];
  if (typeof choice?.message?.content === 'string') return choice.message.content.trim();
  if (Array.isArray(choice?.message?.content)) {
    return choice.message.content.map(x => typeof x === 'string' ? x : x?.text || '').join('').trim();
  }
  if (typeof data?.output_text === 'string') return data.output_text.trim();
  if (Array.isArray(data?.output)) {
    return data.output.flatMap(x => x?.content || []).map(x => x?.text || '').join('').trim();
  }
  return '';
}

async function callModel(messages, maxTokens = 2200) {
  if (!aiConfigured) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.7,
        max_tokens: maxTokens
      })
    });
    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); } catch { data = { error: { message: raw.slice(0, 500) } }; }
    if (!response.ok) throw new Error(`AI provider ${response.status}: ${data?.error?.message || 'request failed'}`);
    const result = extractText(data);
    if (!result) throw new Error('AI provider returned an empty response');
    return result;
  } finally {
    clearTimeout(timer);
  }
}

export async function generateWithAI({ prompt, memoryText, context, mode }) {
  if (!aiConfigured) return null;
  const system = [
    'Tu es le moteur d’intelligence d’Et Si? AI.',
    'Ton rôle est de raisonner avant de répondre, puis de produire une réponse cohérente, précise et naturelle.',
    'Pour une réalité alternative, respecte strictement les hypothèses données et fais évoluer le monde par chaînes de conséquences.',
    'Pour une question de suivi, utilise la mémoire compacte comme état du monde : ne recommence jamais le scénario depuis zéro.',
    'Ne prétends pas avoir vérifié un fait récent sans source. Si aucune recherche n’est fournie, distingue les faits établis des hypothèses.',
    'Ne recopie pas la mémoire dans la réponse.',
    'Réponds directement en français, sauf demande contraire.',
    `Mode demandé : ${mode || 'Long'}.`
  ].join('\n');

  const user = [
    `QUESTION UTILISATEUR:\n${prompt}`,
    memoryText ? `MEMOIRE COMPACTE:\n${memoryText}` : 'MEMOIRE COMPACTE: aucune — nouveau scénario.',
    context ? `CONTEXTE FACTUEL DISPONIBLE:\n${context}` : 'CONTEXTE FACTUEL: aucun contexte supplémentaire.',
    'Produis maintenant la meilleure réponse possible. Pour une simulation longue, structure-la clairement avec des étapes temporelles lorsque cela améliore la compréhension.'
  ].join('\n\n');

  return callModel([
    { role: 'system', content: system },
    { role: 'user', content: user }
  ], mode === 'Long' ? 3600 : 2200);
}
