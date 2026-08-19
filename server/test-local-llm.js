import { generateLocal, localModelStatus } from './local-llm.js';

const status = await localModelStatus();
console.log('LOCAL MODEL STATUS', JSON.stringify(status));
if (!status.downloaded) throw new Error('Model is not downloaded');

const prompts = [
  [{ role: 'system', content: 'Tu es Et Si?, une IA conversationnelle. Réponds précisément en français.' }, { role: 'user', content: 'Explique en deux phrases ce qu’est une réalité alternative.' }],
  [{ role: 'system', content: 'Tu es Et Si?, une IA conversationnelle. Réponds précisément en français.' }, { role: 'user', content: 'Change complètement de sujet : pourquoi le ciel paraît-il bleu ?' }]
];

for (const messages of prompts) {
  const text = await generateLocal(messages, 180);
  if (!text || text.length < 20) throw new Error('Local model returned an empty/too-short response');
  console.log('LOCAL MODEL RESPONSE:', text.slice(0, 1000));
}
console.log('LOCAL MODEL TEST PASSED');
