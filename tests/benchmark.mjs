import {chromium} from '/root/portfolio-gsap/node_modules/playwright/index.mjs';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const server=spawn(process.execPath,['serve.mjs',process.env.GAME_ROOT||'game'],{env:{...process.env,PORT:'8091'},stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
let browser;const results=[],errors=[],external=[];
try{
  browser=await chromium.launch({executablePath:'/root/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1']});
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});await context.route('**/*',r=>{if(new URL(r.request().url()).hostname==='127.0.0.1')r.continue();else{external.push(r.request().url());r.abort();}});const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:8091',{waitUntil:'networkidle'});await page.getByRole('button',{name:'Begin Low Water',exact:true}).click();await page.waitForTimeout(4000);
  for(const quality of ['eco','high']){
    await page.keyboard.press('Escape');await page.locator('#quality').selectOption(quality);await page.getByRole('button',{name:'Return to the city',exact:true}).click();await page.waitForTimeout(2000);
    const sample=await page.evaluate(()=>new Promise(resolve=>{const values=[];let last=performance.now();const frame=now=>{values.push(now-last);last=now;if(values.length<120)requestAnimationFrame(frame);else{values.sort((a,b)=>a-b);const s=window.cairn.snapshot(),gl=document.getElementById('view').getContext('webgl2');resolve({frames:values.length,median:values[60],p95:values[114],drawCalls:s.drawCalls,triangles:s.triangles,renderer:gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL)});}};requestAnimationFrame(frame);}));
    results.push({quality,scene:'idle ferry market, on foot, 1280x720',...sample});console.log(JSON.stringify(results.at(-1)));
  }
  await mkdir('.qa',{recursive:true});await writeFile('.qa/performance.json',JSON.stringify({results,errors,external},null,2));
}finally{if(browser)await browser.close();server.kill();if(errors.length||external.length)process.exitCode=1;}
