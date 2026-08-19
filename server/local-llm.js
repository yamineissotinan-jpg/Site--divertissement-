import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLlama, LlamaChatSession } from 'node-llama-cpp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MODEL_PATH = process.env.LOCAL_MODEL_PATH || path.join(__dirname, 'models', 'qwen2.5-0.5b-instruct-q4_0.gguf');
const MODEL_NAME = process.env.LOCAL_MODEL_NAME || 'Qwen2.5-0.5B-Instruct-Q4_0-GGUF';
const CONTEXT_SIZE = Number(process.env.LOCAL_CONTEXT_SIZE || 2048);
const THREADS = Number(process.env.LOCAL_THREADS || 2);

let llama;
let model;
let loading;

export const localModelName = MODEL_NAME;

async function ensureModel() {
  try { await fs.access(MODEL_PATH); }
  catch { throw new Error(`Local model file missing: ${MODEL_PATH}`); }
}

async function getLocalModel() {
  if (model) return model;
  if (loading) return loading;
  loading = (async () => {
    await ensureModel();
    llama = await getLlama();
    return llama.loadModel({ modelPath: MODEL_PATH });
  })();
  try { model = await loading; return model; }
  finally { loading = null; }
}

export async function generateLocal(messages, maxTokens = 700) {
  const model = await getLocalModel();
  const context = await model.createContext({ contextSize: CONTEXT_SIZE, threads: THREADS });
  try {
    const session = new LlamaChatSession({ contextSequence: context.getSequence() });
    const prompt = messages.map(m => `${String(m.role || 'user').toUpperCase()}:\n${m.content}`).join('\n\n');
    return (await session.prompt(prompt, { maxTokens, temperature: 0.65, topP: 0.9 })).trim();
  } finally {
    try { await context.dispose(); } catch {}
  }
}

export async function localModelStatus() {
  let downloaded = true;
  try { await fs.access(MODEL_PATH); } catch { downloaded = false; }
  return { model: MODEL_NAME, path: MODEL_PATH, downloaded, loaded: Boolean(model), contextSize: CONTEXT_SIZE };
}
