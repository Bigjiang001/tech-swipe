import {chromium} from '@playwright/test'
import {existsSync} from 'node:fs'
const url=process.env.PAGES_PREVIEW_URL||'http://127.0.0.1:4173/tech-swipe/'
const local='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser=await chromium.launch(existsSync(local)?{executablePath:local}: {})
try{
 const page=await browser.newPage({viewport:{width:390,height:844}})
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)})
 await page.goto(url);await page.getByRole('button',{name:'进入私人空间'}).waitFor()
 if(await page.getByRole('button',{name:'先体验演示版'}).count())throw Error('Demo entry leaked into production')
 await page.goto(url+'#/post/not-a-private-post');await page.reload();await page.getByRole('button',{name:'进入私人空间'}).waitFor()
 if(errors.length)throw Error(errors.join('\n'))
 console.log('Production Pages subpath: assets load, demo disabled, direct detail + refresh redirects to owner login, no 404/JS errors.')
}finally{await browser.close()}
