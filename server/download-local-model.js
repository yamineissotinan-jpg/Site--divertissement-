import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const modelsDir = path.join(__dirname, 'models');
const modelPath = path.join(modelsDir, 'qwen2.5-0.5b-instruct-q4_0.gguf');
const url = process.env.LOCAL_MODEL_URL || 'https://huggingface.co/second-state/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/Qwen2.5-0.5B-Instruct-Q4_0.gguf?download=true';

await fsp.mkdir(modelsDir, { recursive: true });
try {
  const stat = await fsp.stat(modelPath);
  if (stat.size > 300_000_000) {
    console.log(`Local model already present (${Math.round(stat.size / 1e6)} MB)`);
    process.exit(0);
  }
} catch {}

console.log('Downloading local Qwen model...');
const response = await fetch(url, { redirect: 'follow' });
if (!response.ok || !response.body) throw new Error(`Model download failed: HTTP ${response.status}`);
const tmp = `${modelPath}.part`;
await pipeline(response.body, fs.createWriteStream(tmp));
const stat = await fsp.stat(tmp);
if (stat.size < 300_000_000) {
  await fsp.rm(tmp, { force: true });
  throw new Error(`Downloaded model is unexpectedly small: ${stat.size} bytes`);
}
await fsp.rename(tmp, modelPath);
console.log(`Local model ready: ${Math.round(stat.size / 1e6)} MB`);
