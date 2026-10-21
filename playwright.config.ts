import {defineConfig,devices} from '@playwright/test'
import {existsSync} from 'node:fs'
const localChrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
export default defineConfig({testDir:'./tests/e2e',fullyParallel:true,retries:0,workers:2,reporter:[['list'],['html',{open:'never'}]],use:{baseURL:'http://127.0.0.1:5173',trace:'retain-on-failure',launchOptions:existsSync(localChrome)?{executablePath:localChrome}:{}},projects:[{name:'iphone',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}},{name:'android',use:{...devices['Pixel 7'],viewport:{width:360,height:740}}},{name:'desktop-phone-canvas',use:{viewport:{width:1440,height:900}}}],webServer:{command:'npm run dev',url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI}})
