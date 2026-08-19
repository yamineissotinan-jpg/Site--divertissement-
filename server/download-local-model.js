import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const dir = process.env.LOCAL_MODEL_DIR || '/var/data/etsi-ai';
const file = process.env.LOCAL_MODEL_PATH || path.join(dir, 'mixtral-8x7b-instruct-v0.1.Q3_K_M.gguf');
const url = process.env.LOCAL_MODEL_URL || 'https://huggingface.co/TheBloke/Mixtral-8x7B-Instruct-v0.1-GGUF/resolve/main/mixtral-8x7b-instruct-v0.1.Q3_K_M.gguf?download=true';
const MIN_BYTES = Number(process.env.MODEL_MIN_BYTES || 19_000_000_000);
async function statSize(target) { try { return (await fsp.stat(target)).size; } catch { return 0; } }
async function download() {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const existing = await statSize(file);
  if (existing >= MIN_BYTES) { console.log(`Model already present: ${file} (${(existing / 1e9).toFixed(2)} GB)`); return; }
  const temp = `${file}.part`;
  const partial = await statSize(temp);
  const headers = partial > 0 ? { Range: `bytes=${partial}-` } : {};
  console.log(`47B-class model target: ${file}`);
  console.log(`Existing partial data: ${(partial / 1e9).toFixed(2)} GB`);
  const response = await fetch(url, { redirect: 'follow', headers });
  if (!response.ok || !response.body) throw new Error(`Model download failed: HTTP ${response.status}`);
  const totalHeader = Number(response.headers.get('content-length') || 0);
  const total = response.status === 206 && totalHeader ? partial + totalHeader : totalHeader;
  if (partial > 0 && response.status !== 206) { console.log('Server did not resume the partial download; restarting from zero.'); await fsp.rm(temp, { force: true }); }
  const append = partial > 0 && response.status === 206;
  const out = fs.createWriteStream(temp, { flags: append ? 'a' : 'w' });
  let received = append ? partial : 0;
  let lastLog = Date.now();
  try {
    for await (const chunk of response.body) {
      if (!out.write(chunk)) await new Promise(resolve => out.once('drain', resolve));
      received += chunk.length;
      if (Date.now() - lastLog > 5000) { const pct = total ? ` ${(received / total * 100).toFixed(1)}%` : ''; console.log(`Model download: ${(received / 1e9).toFixed(2)} GB${total ? ` / ${(total / 1e9).toFixed(2)} GB` : ''}${pct}`); lastLog = Date.now(); }
    }
  } finally { await new Promise(resolve => out.end(resolve)); }
  const finalSize = await statSize(temp);
  if (finalSize < MIN_BYTES) throw new Error(`Downloaded model is unexpectedly small: ${finalSize} bytes`);
  await fsp.rename(temp, file);
  console.log(`Model download complete: ${(finalSize / 1e9).toFixed(2)} GB`);
}
download().catch(error => { console.error(error); process.exit(1); });
