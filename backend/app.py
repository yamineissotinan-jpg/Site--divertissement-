import os, re
from typing import Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

MODEL_ID = os.getenv('MODEL_ID', 'HuggingFaceTB/SmolLM2-360M-Instruct')
app = FastAPI(title='Et si ? AI')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])

_generator = None

class GenerateRequest(BaseModel):
    prompt: str
    mode: str = 'Long'
    memory: str = ''
    context: str = ''
    kind: str = 'REALITE_ALTERNATIVE'


def get_generator():
    global _generator
    if _generator is not None:
        return _generator
    from transformers import pipeline
    _generator = pipeline('text-generation', model=MODEL_ID, device=-1)
    return _generator


def clean(text: str) -> str:
    text = re.sub(r'\n{3,}', '\n\n', text or '')
    return text.strip()


def make_instruction(r: GenerateRequest) -> str:
    return f'''Tu es le moteur narratif de Et si ?. Comprends exactement la demande de l'utilisateur avant d'écrire.
TYPE: {r.kind}
DEMANDE: {r.prompt}
CONTEXTE REEL DISPONIBLE: {r.context or 'aucun'}
MEMOIRE DE L'HISTOIRE: {r.memory or 'aucune'}

Règles impératives:
- Ne change jamais de sujet.
- Une réalité alternative doit partir d'un point de divergence clair et suivre des conséquences causales.
- N'invente pas de prétendus faits réels. Signale implicitement ou explicitement ce qui relève de la fiction.
- Utilise des personnages nommés quand c'est pertinent, avec objectifs, relations et réactions cohérentes.
- Chaque scène doit apporter une information, une décision, un conflit, une relation ou une conséquence nouvelle.
- Ne répète jamais une scène ou une phrase.
- Ne remplis pas artificiellement la longueur.
- Écris en français naturel, vivant et narratif.
- Termine sur une situation cohérente avec la suite demandée.

Réponse:'''

@app.get('/health')
def health():
    return {'ok': True, 'model': MODEL_ID, 'engine': 'transformers-cpu'}

@app.post('/generate')
def generate(r: GenerateRequest):
    generator = get_generator()
    max_new = 1400 if r.mode == 'Film' else 1200 if r.mode == 'Épique' else 1000
    result = generator(make_instruction(r), max_new_tokens=max_new, do_sample=True, temperature=0.82, top_p=0.92, repetition_penalty=1.15, return_full_text=False)
    text = result[0].get('generated_text', '') if result else ''
    return {'ok': True, 'text': clean(text), 'model': MODEL_ID}

@app.post('/research')
def research(body: dict):
    # Intentionally conservative: the server does not fabricate web facts.
    # The frontend can supply verified excerpts from public sources.
    return {'ok': True, 'query': body.get('query', ''), 'context': ''}
