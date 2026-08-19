import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dir = path.join(__dirname, 'models');
const file = process.env.LOCAL_MODEL_PATH || path.join(dir, 'mixtral-8x7b-instruct-v0.1.Q2_K.gguf');
const url = process.env.LOCAL_MODEL_URL || 'https://huggingface.co/TheBloke/Mixtral-8x7B-Instruct-v0.1-GGUF/resolve/main/mixtral-8x7b-instruct-v0.1.Q2_K.gguf?download=true';

async function main() {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  try {
    const stat = await fsp.stat(file);
    if (stat.size > 15_000_000_000) {
      console.log(`Model already present: ${file} (${stat.size} bytes)`);
      return;
    }
  } catch {}

  console.log(`Downloading 47B-class local model to ${file}`);
  console.log(`Source: ${url}`);
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok || !response.body) throw new Error(`Model download failed: HTTP ${response.status}`);
  const total = Number(response.headers.get('content-length') || 0);
  const temp = `${file}.part`;
  const out = fs.createWriteStream(temp);
  let received = 0;
  let lastLog = Date.now();
  try {
    for await (const chunk of response.body) {
      out.write(chunk);
      received += chunk.length;
      if (Date.now() - lastLog > 5000) {
        const pct = total ? ` ${(received / total * 100).toFixed(1)}%` : '';
        console.log(`Model download: ${(received / 1e9).toFixed(2)} GB${total ? ` / ${(total / 1e9).toFixed(2)} GB` : ''}${pct}`);
        lastLog = Date.now();
      }
    }
  } finally {
    await new Promise(resolve => out.end(resolve));
  }
  await fsp.rename(temp, file);
  const stat = await fsp.stat(file);
  if (stat.size < 15_000_000_000) throw new Error(`Downloaded model is unexpectedly small: ${stat.size} bytes`);
  console.log(`Model download complete: ${(stat.size / 1e9).toFixed(2)} GB`);
}

main().catch(error => { console.error(error); process.exit(1); });
