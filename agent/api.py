"""Scoped HMAC API client. Never log headers, credentials, or full request bodies."""
import hashlib
import hmac
import json
import os
import time
import uuid
import urllib.error
import urllib.request
from urllib.parse import urlparse

class API:
    def __init__(self, base=None, token=None):
        self.base=(base or os.environ['NEWS_API_URL']).rstrip('/')
        self.token=token or os.environ['NEWS_AUTOMATION_TOKEN']
        parts=self.token.split('.')
        if len(parts)!=3 or parts[0]!='tsw':
            raise ValueError('Invalid automation credential format')
        self.secret=parts[2]
        if not self.base.startswith('https://') and not self.base.startswith('http://127.0.0.1:'):
            raise ValueError('HTTPS API URL required')

    def headers(self, method, url, raw, timestamp=None, nonce=None):
        timestamp=str(timestamp or int(time.time()))
        nonce=nonce or str(uuid.uuid4())
        u=urlparse(url)
        target=u.path+('?' + u.query if u.query else '')
        message='\n'.join([method,target,timestamp,nonce,hashlib.sha256(raw).hexdigest()])
        return {'Authorization':f'Bearer {self.token}','Content-Type':'application/json','X-TS-Timestamp':timestamp,'X-TS-Nonce':nonce,'X-TS-Signature':hmac.new(self.secret.encode(),message.encode(),hashlib.sha256).hexdigest()}

    def request(self, path, payload=None, method='POST', retries=3):
        url=f'{self.base}/{path}'
        raw=b'' if method=='GET' else json.dumps(payload or {},ensure_ascii=False,separators=(',',':')).encode()
        for attempt in range(retries):
            req=urllib.request.Request(url,data=None if method=='GET' else raw,headers=self.headers(method,url,raw),method=method)
            try:
                with urllib.request.urlopen(req,timeout=110) as response:
                    return json.load(response)
            except urllib.error.HTTPError as e:
                try: code=json.loads(e.read(4096)).get('error','request_rejected')
                except (ValueError,AttributeError): code='request_rejected'
                if e.code not in (429,500,502,503,504) or attempt==retries-1:
                    raise RuntimeError(f'API {e.code}: {code}') from None
            except (urllib.error.URLError,TimeoutError):
                if attempt==retries-1: raise RuntimeError('API network failure') from None
            time.sleep(min(2**attempt,8))
        raise RuntimeError('Retry exhausted')
