import fs from 'node:fs'
const files=fs.readdirSync('dist/assets').filter(f=>f.endsWith('.js'))
const js=files.map(f=>fs.readFileSync('dist/assets/'+f,'utf8')).join('\n')
for(const privateText of ['当 AI 开始理解物理世界','概念编辑部','SUPABASE_SERVICE_ROLE_KEY','NEWS_AUTOMATION_TOKEN','AI_API_KEY','GITHUB_DISPATCH_TOKEN'])if(js.includes(privateText))throw Error('Forbidden content in production build: '+privateText)
console.log('Production static bundle: no demo stories or server environment names.')
