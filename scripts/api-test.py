"""Live integration smoke test against YOUR configured Supabase instance.
Creates only pending submissions, never publishes. Use a dedicated revocable ingest credential.
"""
import argparse
import json
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from agent.api import API
p=argparse.ArgumentParser();p.add_argument('file',help='JSON batch: idempotency_key + posts');p.add_argument('--repeat',action='store_true',help='Check idempotent repeat');args=p.parse_args()
body=json.loads(Path(args.file).read_text());api=API();one=api.request('news-ingest',body);print(json.dumps(one,ensure_ascii=False))
if args.repeat:
 two=api.request('news-ingest',body)
 assert two['job_id']==one['job_id'] and two['duplicate'] is True
 print('Idempotency verified')
print(json.dumps(api.request('news-job-status?job_id='+one['job_id'],method='GET'),ensure_ascii=False))
