import {spawnSync} from 'node:child_process'
import {readdirSync} from 'node:fs'
const mode=process.argv[2]
const common=['--no-config','--no-lock','--node-modules-dir=none']
const files=mode==='check'?readdirSync('supabase/functions',{withFileTypes:true}).filter(x=>x.isDirectory()&&!x.name.startsWith('_')).map(x=>`supabase/functions/${x.name}/index.ts`):readdirSync('supabase/tests').filter(f=>f.endsWith('_test.ts')).map(f=>'supabase/tests/'+f)
const result=spawnSync('deno',[mode,...common,...(mode==='test'?['--allow-env']:[]),...files],{stdio:'inherit',env:{...process.env,NPM_CONFIG_REGISTRY:'https://registry.npmjs.org'}})
if(result.error)throw result.error
process.exit(result.status??1)
