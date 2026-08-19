import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLlama, LlamaChatSession } from 'node-llama-cpp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MODEL_PATH = process.env.LOCAL_MODEL_PATH || path.join(__dirname, 'models', 'qwen2.5-0.5b-instruct-q4_0.gguf');
const MODEL_NAME = process.env.LOCAL_MODEL_NAME || 'Qwen2.5-0.5B-Instruct-Q4_0-GGUF';
const CONTEXT_SIZE = Number(process.env.LOCAL_CONTEXT_SIZE || 2048);
const THREADS = Number(process.env.LOCAL_THREADS || Math.max(1, Math.min(4, Number(process.env.npm_config_jobs || 2))));

let llama;
let model;
let context;
let session;
let loading;

export const localModelName = MODEL_NAME;

async function ensureModel() {
  try {
    await fs.access(MODEL_PATH);
  } catch {
    throw new Error(`Local model file missing: ${MODEL_PATH}`);
  }
}

export async function getLocalSession() {
  if (session) return session;
  if (loading) return loading;
  loading = (async () => {
    await ensureModel();
    llama = await getLlama();
    model = await llama.loadModel({ modelPath: MODEL_PATH });
    context = await model.createContext({ contextSize: CONTEXT_SIZE, threads: THREADS });
    session = new LlamaChatSession({ contextSequence: context.getSequence() });
    return session;
  })();
  try {
    return await loading;
  } finally {
    loading = null;
  }
}

export async function generateLocal(messages, maxTokens = 900) {
  const session = await getLocalSession();
  const prompt = messages.map(m => `${m.role.toUpperCase()}:\n${m.content}`).join('\n\n');
  return (await session.prompt(prompt, { maxTokens, temperature: 0.65, topP: 0.9 })).trim();
}

export async function localModelStatus() {
  let exists = true;
  try { await fs.access(MODEL_PATH); } catch { exists = false; }
  return { model: MODEL_NAME, path: MODEL_PATH, downloaded: exists, loaded: Boolean(session), contextSize: CONTEXT_SIZE };
}
