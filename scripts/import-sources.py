"""Owner-only setup helper. Obtain a short-lived owner access token locally;
never commit it or put it into chat prompts. Adds DISABLED sources via admin API.
"""
import json
import os
from pathlib import Path
import urllib.request
base=os.environ['NEWS_API_URL'].rstrip('/')
if not base.startswith('https://'):raise SystemExit('HTTPS required')
token=os.environ['OWNER_ACCESS_TOKEN']
for source in json.loads(Path('agent/sources.example.json').read_text()):
 req=urllib.request.Request(base+'/admin-control',data=json.dumps({'action':'add-source',**source},ensure_ascii=False).encode(),headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'},method='POST')
 try:
  with urllib.request.urlopen(req,timeout=25) as r:json.load(r)
  print('Added disabled source:',source['name'])
 except Exception:
  print('Source not added (may already exist):',source['name'])
