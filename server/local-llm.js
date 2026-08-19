import fs from 'node:fs/promises';
import { getLlama, LlamaChatSession } from 'node-llama-cpp';

const MODEL_PATH = process.env.LOCAL_MODEL_PATH || '/var/data/etsi-ai/mixtral-8x7b-instruct-v0.1.Q3_K_M.gguf';
const MODEL_NAME = process.env.LOCAL_MODEL_NAME || 'Mixtral-8x7B-Instruct-v0.1-Q3_K_M-GGUF-47B';
const CONTEXT_SIZE = Number(process.env.LOCAL_CONTEXT_SIZE || 2048);
const THREADS = Number(process.env.LOCAL_THREADS || 8);
const MIN_MODEL_BYTES = Number(process.env.MODEL_MIN_BYTES || 19_000_000_000);

let llama;
let model;
let loading;

export const localModelName = MODEL_NAME;

async function getFileSize() {
  try { return (await fs.stat(MODEL_PATH)).size; } catch { return 0; }
}

async function ensureModel() {
  const size = await getFileSize();
  if (size < MIN_MODEL_BYTES) {
    throw new Error(`Local 47B model is missing or incomplete: ${MODEL_PATH} (${size} bytes). Run npm run download-model first.`);
  }
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
  const loaded = await getLocalModel();
  const context = await loaded.createContext({ contextSize: CONTEXT_SIZE, threads: THREADS });
  try {
    const session = new LlamaChatSession({ contextSequence: context.getSequence() });
    const prompt = messages.map(m => `${String(m.role || 'user').toUpperCase()}:\n${m.content}`).join('\n\n');
    return (await session.prompt(prompt, { maxTokens, temperature: 0.65, topP: 0.9 })).trim();
  } finally {
    try { await context.dispose(); } catch {}
  }
}

export async function localModelStatus() {
  const size = await getFileSize();
  return {
    model: MODEL_NAME,
    path: MODEL_PATH,
    downloaded: size >= MIN_MODEL_BYTES,
    loaded: Boolean(model),
    bytes: size,
    sizeGB: Number((size / 1e9).toFixed(2)),
    minBytes: MIN_MODEL_BYTES,
    contextSize: CONTEXT_SIZE,
    threads: THREADS
  };
}
