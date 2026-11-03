"""Versioned, non-random candy scoring. No image generation or mint authority."""
import copy
import math
import re
import unicodedata
from bifrost_setup import VERDICT_SCHEMA, validate_verdict

MODEL = 'black-forest-labs/FLUX.1-schnell'
RULE_VERSION = 'candy-quality-novelty-v1'
SCORE_FIELDS = ('creativity','coherence','specificity')
CANDY_VERDICT_SCHEMA = copy.deepcopy(VERDICT_SCHEMA)
CANDY_VERDICT_SCHEMA['properties']['candy_scores'] = {'type':'object','additionalProperties':False,
    'properties':{key:{'type':'integer','minimum':0,'maximum':20} for key in SCORE_FIELDS},'required':list(SCORE_FIELDS)}
CANDY_VERDICT_SCHEMA['required'].append('candy_scores')


def validate_scores(scores):
    if not isinstance(scores,dict) or set(scores)!=set(SCORE_FIELDS) or any(type(scores[k]) is not int or not 0<=scores[k]<=20 for k in SCORE_FIELDS):
        raise ValueError('Invalid candy quality scores.')
    return scores


def validate_candy_verdict(value):
    if not isinstance(value,dict) or set(value)!=set(CANDY_VERDICT_SCHEMA['required']):
        raise ValueError('Invalid candy verdict fields.')
    validate_verdict({key:item for key,item in value.items() if key!='candy_scores'})
    validate_scores(value['candy_scores'])


def normalized(prompt):
    return ' '.join(re.findall(r'[^\W_]+',unicodedata.normalize('NFKC',prompt).casefold(),re.UNICODE))


def similarity(a,b):
    if a==b: return 1.0
    def grams(value): return {value[i:i+5] for i in range(max(1,len(value)-4))}
    left,right=grams(a),grams(b)
    return len(left & right)/len(left | right) if left | right else 1.0


def score_prompt(prompt,scores,previous):
    scores=validate_scores(scores)
    value=normalized(prompt)
    closest=max((similarity(value,item) for item in previous),default=0.0)
    novelty=max(0,min(40,int(math.floor((1-closest)*40+.5))))
    total=sum(scores.values())+novelty
    grade=4 if total>=90 else 3 if total>=75 else 2 if total>=60 else 1
    return {'score':total,'grade':grade,'grade_label':('C','B','A','S')[grade-1],
            'components':{**scores,'novelty':novelty},'closest_similarity':round(closest,4),
            'comparison_count':len(previous),'rule_version':RULE_VERSION}
