"""Optional GitHub fallback. Primary link collection is hosted Supabase Cron."""
from .api import API

def main():
    result=API().request('link-api',{'action':'collect'})
    print({'count':result.get('count',0),'skipped':result.get('skipped',False),'errors':len(result.get('errors',[]))})
    if result.get('errors'): raise SystemExit(1)

if __name__=='__main__': main()
