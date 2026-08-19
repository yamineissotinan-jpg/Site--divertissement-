import express from 'express';
import cors from 'cors';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aiModel, generateWithAI, providerStatus } from './ai-provider.js';

const app = express();
const PORT = Number(process.env.PORT || 10000);
const MODEL = aiModel;
const ENGINE = 'local-47b-hybrid-memory-orchestrator';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const MAX_INPUT = 12000;
const MAX_CONTEXT = 5000;
const MAX_OUTPUT = 18000;
const MAX_MEMORY = 2200;

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '512kb' }));

const text = (v='') => String(v ?? '').trim();
const clean = (v='') => text(v).replace(/[.!?]+$/g,'');
const normalize = (v='') => clean(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const cap = (v,n) => text(v).slice(0,n);

function classify(prompt){
  const s=normalize(prompt);
  if(/\bet si\b|imagine|supposons|autre realite|que se passerait/.test(s)) return 'REALITE_ALTERNATIVE';
  if(/raconte|histoire|roman|conte/.test(s)) return 'RECIT';
  if(/^(pourquoi|comment|qu est ce|quelle|quel|qui|combien|quand|ou)\b/.test(s)) return 'INFORMATION';
  return 'CONVERSATION';
}
function parseMemory(value){
  if(!value)return null;
  try{const m=typeof value==='string'?JSON.parse(value):value;if(!m||typeof m!=='object')return null;return{version:2,scenario:cap(m.scenario,600),divergence:cap(m.divergence,400),time:cap(m.time,180),places:cap(m.places,260),characters:cap(m.characters,320),events:Array.isArray(m.events)?m.events.slice(-5).map(x=>cap(x,180)):[],current:cap(m.current,500)}}catch{return null}
}
function memoryText(memory){const m=parseMemory(memory);if(!m)return '';return[`SCENARIO: ${m.scenario}`,`DIVERGENCE: ${m.divergence}`,`TEMPS: ${m.time}`,m.places&&`LIEUX: ${m.places}`,m.characters&&`PERSONNAGES: ${m.characters}`,m.events.length&&`EVENEMENTS: ${m.events.join(' | ')}`,`SITUATION ACTUELLE: ${m.current}`].filter(Boolean).join('\n')}
function fitMemory(memory){let m=parseMemory(memory);if(!m)return null;const size=()=>JSON.stringify(m).length;while(size()>MAX_MEMORY&&m.events.length>1)m.events.shift();if(size()>MAX_MEMORY)m.current=cap(m.current,300);if(size()>MAX_MEMORY)m.characters=cap(m.characters,180);if(size()>MAX_MEMORY)m.places=cap(m.places,140);if(size()>MAX_MEMORY)m.divergence=cap(m.divergence,260);if(size()>MAX_MEMORY)m.scenario=cap(m.scenario,420);if(size()>MAX_MEMORY)m.current=cap(m.current,160);if(size()>MAX_MEMORY)m.events=m.events.slice(-2).map(x=>cap(x,100));return m}
function compactMemory(prompt,type,previous,output){const old=parseMemory(previous);const p=clean(prompt);const events=[...(old?.events||[])];if(old?.current)events.push(old.current);return fitMemory({version:2,scenario:cap(old?.scenario||p,600),divergence:cap(old?.divergence||(type==='REALITE_ALTERNATIVE'?p:''),400),time:cap(old?.time||'début du scénario',180),places:cap(old?.places||'',260),characters:cap(old?.characters||'',320),events:events.slice(-5),current:cap(output.replace(/\s+/g,' ').trim(),500)})}
function isFollowUp(prompt,memory){if(!memory)return false;return /\b(plus tard|ensuite|apres|après|puis|maintenant|dix ans|vingt ans|trente ans|cent ans|annee suivante|année suivante)\b/i.test(prompt)}

const MEMORY_BRIDGE=`<script>(function(){const K='etsi_narrative_memory_v2';const oldFetch=window.fetch.bind(window);window.fetch=async function(input,init){let gen=false;try{const u=typeof input==='string'?input:input.url||'';gen=u.endsWith('/generate');if(gen&&init&&init.body){const b=JSON.parse(init.body);const m=localStorage.getItem(K);if(m)b.memory=m;init={...init,body:JSON.stringify(b)}}}catch(e){}const r=await oldFetch(input,init);if(gen){try{const j=await r.clone().json();if(j?.memory)localStorage.setItem(K,JSON.stringify(j.memory))}catch(e){}}return r};document.addEventListener('click',e=>{if(e.target?.id==='new')localStorage.removeItem(K)});})();</script>`;

app.get('/health',async(_req,res)=>{try{const status=await providerStatus();res.json({ok:true,model:MODEL,engine:ENGINE,status:'healthy',local:status.local,remoteConfigured:status.remoteConfigured})}catch(error){res.status(503).json({ok:false,model:MODEL,engine:ENGINE,status:'degraded',error:cap(error?.message||error,500)})}});
app.get('/test/memory',(_req,res)=>{const m=compactMemory('Et si tous les humains disparaissaient demain ?','REALITE_ALTERNATIVE',null,'scenario test');const m2=compactMemory('Et dix ans plus tard ?','REALITE_ALTERNATIVE',m,'suite test');res.json({ok:Boolean(m&&m2&&JSON.stringify(m2).length<=MAX_MEMORY),checks:{memoryCreated:Boolean(m),memoryBounded:Boolean(m2&&JSON.stringify(m2).length<=MAX_MEMORY),followup:isFollowUp('Et dix ans plus tard ?',m)}})});
app.get('/test',async(_req,res)=>{try{const r=await generateWithAI({prompt:'Et si tous les humains disparaissaient demain ?',memoryText:'',context:'',mode:'Test'});const textOut=cap(r||'',MAX_OUTPUT);res.json({ok:Boolean(r),model:MODEL,engine:ENGINE,type:'REALITE_ALTERNATIVE',mode:'Test',text:textOut,research:[],provider:'local-model',memory:compactMemory('Et si tous les humains disparaissaient demain ?','REALITE_ALTERNATIVE',null,textOut)})}catch(error){res.status(503).json({ok:false,error:'model_unavailable',detail:cap(error?.message||error,500)})}});
app.get('/test/ai',async(_req,res)=>{try{const r=await generateWithAI({prompt:'Réponds en une phrase: quel est le principe d’une réalité alternative ?',memoryText:'',context:'',mode:'Short'});res.json({ok:Boolean(r),model:MODEL,provider:'local-model',preview:cap(r||'',500)})}catch(e){res.status(503).json({ok:false,error:'model_unavailable',detail:cap(e?.message||e,500)})}});
app.get('/',async(_req,res)=>{try{const html=await fs.readFile(path.join(ROOT,'index.html'),'utf8');res.type('html').send(html.replace('</body>',`${MEMORY_BRIDGE}</body>`))}catch{res.status(500).send('Frontend unavailable')}});
app.use(express.static(ROOT,{index:false}));

app.post('/generate',async(req,res)=>{try{const body=req.body&&typeof req.body==='object'?req.body:{};const prompt=cap(body.prompt??body.question??body.message??body.input??'',MAX_INPUT);const mode=cap(body.mode??body.length??'Long',80);const context=cap(body.context??body.history??'',MAX_CONTEXT);const memory=parseMemory(body.memory);if(!prompt)return res.status(400).json({ok:false,error:'prompt_required'});const result=await generateWithAI({prompt,memoryText:memoryText(memory),context:cap(context,1200),mode});const output=cap(result,MAX_OUTPUT);const nextMemory=compactMemory(prompt,classify(prompt),memory,output);res.json({ok:true,model:MODEL,engine:ENGINE,type:classify(prompt),mode,text:output,research:[],memory:nextMemory,provider:'local-model'})}catch(error){console.error('Generation error:',error);res.status(500).json({ok:false,error:'generation_failed',detail:cap(error?.message||error,500)})}});
app.use((_req,res)=>res.status(404).json({ok:false,error:'not_found'}));
app.listen(PORT,'0.0.0.0',()=>console.log(`Et Si? AI server listening on ${PORT}`));
