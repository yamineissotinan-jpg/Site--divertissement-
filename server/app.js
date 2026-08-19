import express from 'express';
import cors from 'cors';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aiConfigured, aiModel, generateWithAI } from './ai-provider.js';

const app = express();
const PORT = Number(process.env.PORT || 10000);
const MODEL = aiConfigured ? aiModel : 'lightweight-narrative-engine-v7-local-fallback';
const ENGINE = aiConfigured ? 'hybrid-ai-memory-orchestrator' : 'hybrid-orchestrator-local-fallback';
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

const text = (v = '') => String(v ?? '').trim();
const clean = (v = '') => text(v).replace(/[.!?]+$/g, '');
const normalize = (v = '') => clean(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const cap = (v, n) => text(v).slice(0, n);

function classify(prompt) {
  const s = normalize(prompt);
  if (/\bet si\b|imagine|supposons|autre realite|que se passerait/.test(s)) return 'REALITE_ALTERNATIVE';
  if (/raconte|histoire|roman|conte/.test(s)) return 'RECIT';
  if (/^(pourquoi|comment|qu est ce|quelle|quel|qui|combien|quand|ou)\b/.test(s)) return 'INFORMATION';
  return 'CONVERSATION';
}

function scenario(prompt) {
  const s = normalize(prompt);
  if (/(humain|humanite)/.test(s) && /(dispar|plus aucun|plus personne)/.test(s)) return 'HUMANS_GONE';
  return 'GENERAL';
}

function chapter(title, paragraphs) {
  return `CHAPITRE — ${title}\n\n${paragraphs.join('\n\n')}`;
}

function humansGone() {
  return [
    chapter('Le dernier matin', ['À 7 h 42, les villes fonctionnent encore comme si rien n’avait changé. Les systèmes automatiques poursuivent leurs tâches et les bâtiments restent debout.','Puis la réalité apparaît : tous les humains ont disparu, partout sur Terre, au même instant. Il n’y a pas de survivants cachés.']),
    chapter('Les premières heures', ['Les avions, les routes et les réseaux électriques commencent à diverger selon leur degré d’automatisation, leur énergie disponible et les conditions locales.','Les protections automatiques peuvent isoler certaines pannes, mais elles ne remplacent pas les équipes humaines chargées de surveiller et réparer les infrastructures.']),
    chapter('La première semaine', ['Les stations de pompage et les réseaux d’eau dépendent progressivement de systèmes qui nécessitent énergie, pièces et maintenance.','Les aliments réfrigérés se dégradent lorsque l’électricité devient instable. Les animaux domestiques connaissent des destins différents selon leur capacité à trouver eau, nourriture et abri.']),
    chapter('Les premières années', ['Les villes restent reconnaissables mais l’entretien cesse. L’eau, les plantes, le gel et la corrosion accélèrent la dégradation des bâtiments et des routes.','Les systèmes spatiaux continuent parfois pendant un temps, puis perdent progressivement leurs capacités faute d’intervention terrestre.']),
    chapter('Un siècle plus tard', ['Les métaux ont rouillé, les vitres ont disparu de nombreux bâtiments et la végétation a repris des espaces artificiels.','Certaines infrastructures massives restent reconnaissables, tandis que la plupart des objets ordinaires deviennent des traces d’une civilisation disparue.'])
  ].join('\n\n');
}

function parseMemory(value) {
  if (!value) return null;
  try {
    const m = typeof value === 'string' ? JSON.parse(value) : value;
    if (!m || typeof m !== 'object') return null;
    return {
      version: 2,
      scenario: cap(m.scenario, 600),
      divergence: cap(m.divergence, 400),
      time: cap(m.time, 180),
      places: cap(m.places, 260),
      characters: cap(m.characters, 320),
      events: Array.isArray(m.events) ? m.events.slice(-5).map(x => cap(x, 180)) : [],
      current: cap(m.current, 500)
    };
  } catch { return null; }
}

function memoryText(memory) {
  const m = parseMemory(memory);
  if (!m) return '';
  return [
    `SCENARIO: ${m.scenario}`,
    `DIVERGENCE: ${m.divergence}`,
    `TEMPS: ${m.time}`,
    m.places && `LIEUX: ${m.places}`,
    m.characters && `PERSONNAGES: ${m.characters}`,
    m.events.length && `EVENEMENTS: ${m.events.join(' | ')}`,
    `SITUATION ACTUELLE: ${m.current}`
  ].filter(Boolean).join('\n');
}

function fitMemory(memory) {
  let m = parseMemory(memory);
  if (!m) return null;
  const size = () => JSON.stringify(m).length;
  while (size() > MAX_MEMORY && m.events.length > 1) m.events.shift();
  if (size() > MAX_MEMORY) m.current = cap(m.current, 300);
  if (size() > MAX_MEMORY) m.characters = cap(m.characters, 180);
  if (size() > MAX_MEMORY) m.places = cap(m.places, 140);
  if (size() > MAX_MEMORY) m.divergence = cap(m.divergence, 260);
  if (size() > MAX_MEMORY) m.scenario = cap(m.scenario, 420);
  if (size() > MAX_MEMORY) m.current = cap(m.current, 160);
  if (size() > MAX_MEMORY) m.events = m.events.slice(-2).map(x => cap(x, 100));
  return m;
}

function compactMemory(prompt, type, previous, output) {
  const old = parseMemory(previous);
  const p = clean(prompt);
  const follow = /\b(dix|vingt|trente|cent|quelques|plus tard|annee|ans|siecle|ensuite|apres|puis|maintenant)\b/i.test(p);
  const events = [...(old?.events || [])];
  if (old?.current) events.push(old.current);
  return fitMemory({
    version: 2,
    scenario: cap(old?.scenario || p, 600),
    divergence: cap(old?.divergence || (type === 'REALITE_ALTERNATIVE' ? p : ''), 400),
    time: cap(follow ? (old?.time || 'suite du scénario') : (old?.time || 'début du scénario'), 180),
    places: cap(old?.places || '', 260),
    characters: cap(old?.characters || '', 320),
    events: events.slice(-5),
    current: cap(output.replace(/CHAPITRE\s*[—-]\s*/gi, '').replace(/\s+/g, ' ').trim(), 500)
  });
}

function isFollowUp(prompt, memory) {
  if (!memory) return false;
  return /\b(plus tard|ensuite|apres|après|puis|maintenant|dix ans|vingt ans|trente ans|cent ans|annee suivante|année suivante)\b/i.test(prompt);
}

function localGenerate(prompt, context, memory) {
  const type = classify(prompt);
  if (scenario(prompt) === 'HUMANS_GONE' && !memory) return { type: 'REALITE_ALTERNATIVE', text: humansGone() };
  if (type === 'INFORMATION' && !memory) {
    return { type, text: `QUESTION — ${clean(prompt)}\n\nLe moteur local n’a pas accès aux informations récentes. Avec le fournisseur IA activé, le système peut produire une réponse générale en utilisant la mémoire compacte sans envoyer tout l’historique.` };
  }
  const follow = isFollowUp(prompt, memory);
  const m = memoryText(memory);
  const lead = follow
    ? `Cette question continue le même scénario. L’état précédent est conservé et la nouvelle réponse part de cette situation, sans recommencer le monde depuis zéro.`
    : `La question de départ est : « ${clean(prompt)} ».`;
  return {
    type,
    text: [
      chapter('Point de départ', [lead, m ? `État compact mémorisé : ${m}` : 'Aucun état précédent.']),
      chapter(follow ? 'Évolution' : 'Premières conséquences', ['Les conséquences apparaissent progressivement. Les individus, les institutions et les systèmes réagissent au changement initial.','Chaque conséquence modifie les possibilités de la suite.']),
      chapter('Propagation', ['Les décisions prises dans cette nouvelle réalité produisent à leur tour des effets secondaires.','Avec le temps, la divergence devient une trajectoire autonome.']),
      chapter('Une génération plus tard', ['Les nouvelles générations considèrent progressivement cette réalité comme normale.','Le changement initial finit par influencer durablement les sociétés, les comportements et les infrastructures.'])
    ].join('\n\n')
  };
}

async function generateHybrid(prompt, mode, context, memory) {
  const local = localGenerate(prompt, context, memory);
  try {
    const aiText = await generateWithAI({ prompt, memoryText: memoryText(memory), context: cap(context, 1200), mode });
    if (aiText) return { type: local.type, text: aiText, provider: 'model' };
  } catch (error) {
    console.error('AI provider fallback:', error?.message || error);
  }
  return { ...local, provider: 'local-fallback' };
}

function runMemorySelfTest() {
  const p1 = 'Et si tous les humains disparaissaient demain ?';
  const r1 = localGenerate(p1, '', null);
  const m1 = compactMemory(p1, r1.type, null, r1.text);
  const p2 = 'Et dix ans plus tard ?';
  const r2 = localGenerate(p2, '', m1);
  const m2 = compactMemory(p2, r2.type, m1, r2.text);
  const p3 = 'Et vingt ans plus tard ?';
  const r3 = localGenerate(p3, '', m2);
  const m3 = compactMemory(p3, r3.type, m2, r3.text);
  const fresh = localGenerate('Et si les océans montaient de 20 mètres ?', '', null);
  const checks = {
    memoryCreated: !!m1,
    memoryBounded: [m1, m2, m3].every(m => m && JSON.stringify(m).length <= MAX_MEMORY),
    followup1: isFollowUp(p2, m1),
    followup2: isFollowUp(p3, m2),
    freshScenario: !isFollowUp('Et si les océans montaient de 20 mètres ?', null),
    outputsNonEmpty: [r1, r2, r3, fresh].every(r => text(r.text).length > 100)
  };
  return { ok: Object.values(checks).every(Boolean), checks, sizes: [m1, m2, m3].map(m => JSON.stringify(m || {}).length) };
}

const MEMORY_BRIDGE = `<script>(function(){const K='etsi_narrative_memory_v2';const oldFetch=window.fetch.bind(window);window.fetch=async function(input,init){let gen=false;try{const u=typeof input==='string'?input:input.url||'';gen=u.endsWith('/generate');if(gen&&init&&init.body){const b=JSON.parse(init.body);const m=localStorage.getItem(K);if(m)b.memory=m;init={...init,body:JSON.stringify(b)}}}catch(e){}const r=await oldFetch(input,init);if(gen){try{const j=await r.clone().json();if(j?.memory)localStorage.setItem(K,JSON.stringify(j.memory))}catch(e){}}return r};document.addEventListener('click',e=>{if(e.target?.id==='new')localStorage.removeItem(K)});})();</script>`;

app.get('/health', (_req,res) => res.json({ ok:true, model:MODEL, engine:ENGINE, status:'healthy', aiConfigured }));
app.get('/test', async (_req,res) => { const r=await generateHybrid('Et si tous les humains disparaissaient demain ?','Test','',null); res.json({ok:true,model:MODEL,engine:ENGINE,type:r.type,mode:'Test',text:cap(r.text,MAX_OUTPUT),research:[],memory:compactMemory('Et si tous les humains disparaissaient demain ?',r.type,null,r.text),provider:r.provider}); });
app.get('/test/memory', (_req,res) => res.json(runMemorySelfTest()));
app.get('/test/ai', async (_req,res) => { if(!aiConfigured)return res.json({ok:true,configured:false,message:'AI_API_KEY and AI_MODEL are not configured; local fallback is active.'}); try { const r=await generateWithAI({prompt:'Réponds en une phrase: quel est le principe d’une réalité alternative ?',memoryText:'',context:'',mode:'Short'}); res.json({ok:Boolean(r),configured:true,model:aiModel,preview:cap(r||'',500)}); } catch(e) { res.status(502).json({ok:false,configured:true,error:'ai_provider_failed',detail:cap(e?.message||e,500)}); } });

app.get('/', async (_req,res) => { try { const html=await fs.readFile(path.join(ROOT,'index.html'),'utf8'); res.type('html').send(html.replace('</body>',`${MEMORY_BRIDGE}</body>`)); } catch { res.status(500).send('Frontend unavailable'); } });
app.use(express.static(ROOT,{index:false}));

app.post('/generate', async (req,res) => {
  try {
    const body=req.body&&typeof req.body==='object'?req.body:{};
    const prompt=cap(body.prompt??body.question??body.message??body.input??'',MAX_INPUT);
    const mode=cap(body.mode??body.length??'Long',80);
    const context=cap(body.context??body.history??'',MAX_CONTEXT);
    const memory=parseMemory(body.memory);
    if(!prompt)return res.status(400).json({ok:false,error:'prompt_required'});
    const r=await generateHybrid(prompt,mode,context,memory);
    const output=cap(r.text,MAX_OUTPUT);
    const nextMemory=compactMemory(prompt,r.type,memory,output);
    res.json({ok:true,model:MODEL,engine:ENGINE,type:r.type,mode,text:output,research:[],memory:nextMemory,provider:r.provider});
  } catch(error) {
    console.error('Generation error:',error);
    res.status(500).json({ok:false,error:'generation_failed',detail:cap(error?.message||error,500)});
  }
});

app.use((_req,res)=>res.status(404).json({ok:false,error:'not_found'}));
app.listen(PORT,'0.0.0.0',()=>console.log(`Et Si? AI server listening on ${PORT}`));
