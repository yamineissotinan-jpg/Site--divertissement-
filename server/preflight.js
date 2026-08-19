import fs from 'node:fs/promises';
import os from 'node:os';
const minRamGB=Number(process.env.MIN_RUNTIME_RAM_GB||28);
const minDiskGB=Number(process.env.MIN_RUNTIME_DISK_GB||22);
const modelPath=process.env.LOCAL_MODEL_PATH||'/var/data/etsi-ai/mixtral-8x7b-instruct-v0.1.Q3_K_M.gguf';
async function main(){const ramGB=os.totalmem()/1e9; let diskGB=null; try{const s=await fs.statfs(modelPath.substring(0,modelPath.lastIndexOf('/'))||'/'); diskGB=Number(s.bavail)*Number(s.bsize)/1e9;}catch{} console.log(`Runtime RAM: ${ramGB.toFixed(2)} GB`); if(diskGB!==null)console.log(`Runtime free disk at model path: ${diskGB.toFixed(2)} GB`); if(ramGB<minRamGB)throw new Error(`Insufficient RAM for local 47B runtime: ${ramGB.toFixed(2)} GB available; need at least ${minRamGB} GB.`); if(diskGB!==null&&diskGB<minDiskGB)throw new Error(`Insufficient disk for local 47B model: ${diskGB.toFixed(2)} GB free; need at least ${minDiskGB} GB.`)}
main().catch(error=>{console.error(`PREFLIGHT FAILED: ${error.message}`);process.exit(1)});
