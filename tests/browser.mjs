import { chromium } from '/root/portfolio-gsap/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { roadRoute, dist, headingTo, angleDelta, clamp } from '../game/src/math.js';
await mkdir('.qa',{recursive:true});
const port=process.env.PORT||'8095';
const server=spawn(process.execPath,['serve.mjs',process.env.GAME_ROOT||'game'],{env:{...process.env,PORT:port},stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>{if(code)reject(Error('Server exit '+code));});});
const browser=await chromium.launch({executablePath:'/root/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1']});
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,...(process.env.RESUME?{storageState:'.qa/browser-save.json'}:{})});
const errors=[],external=[],steps=[];const page=await context.newPage();
process.on('beforeExit',()=>{if(errors.length||external.length)process.exitCode=1;});
await context.route('**/*',r=>{if(new URL(r.request().url()).hostname==='127.0.0.1')r.continue();else{external.push(r.request().url());r.abort();}});
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('crash',()=>console.error('BROWSER PAGE CRASHED'));browser.on('disconnected',()=>console.log('Browser connection closed'));
const snap=()=>page.evaluate(()=>window.cairn.snapshot());
let held=new Set();
let driveObserver=null;
export function observeDrive(fn){driveObserver=fn;}
async function keys(list=[]){const next=new Set(list);for(const k of held)if(!next.has(k))await page.keyboard.up(k);for(const k of next)if(!held.has(k))await page.keyboard.down(k);held=next;}
async function mark(label){const s=await snap();steps.push({label,snapshot:s});console.log(label,JSON.stringify({time:s.time,p:s.player,mission:s.mission.objective,heat:s.police.level,menu:s.menu}));}
async function tap(code){await keys();await page.keyboard.press(code);await page.waitForTimeout(250);}
async function walkTo(target,tolerance=1.6,timeout=120000){
  const start=Date.now();let previous=null,stuck=0;
  while(Date.now()-start<timeout){const s=await snap(),p=s.player;if(s.menu)throw Error('Menu during walk '+s.menu);if(p.car)throw Error('Walk requested while driving');const d=dist(p,target);if(d<tolerance){await keys();return;}
    const dx=target.x-p.x,dz=target.z-p.z,yaw=s.camera.yaw,f=dx*Math.sin(yaw)-dz*Math.cos(yaw),r=dx*Math.cos(yaw)+dz*Math.sin(yaw),k=[];
    const dead=Math.min(.45,tolerance*.45);if(Math.abs(f)>dead)k.push(f>0?'KeyW':'KeyS');if(Math.abs(r)>dead)k.push(r>0?'KeyD':'KeyA');if(d>5)k.push('ShiftLeft');
    await keys(k);await page.waitForTimeout(160);
    if(previous&&dist(previous,p)<.03)stuck++;else stuck=0;previous=p;if(stuck>35)throw Error('Foot path blocked at '+JSON.stringify(p)+' toward '+JSON.stringify(target));
  }throw Error('Walk timeout toward '+JSON.stringify(target));
}
async function stop(){await keys(['Space']);await page.waitForTimeout(1200);await keys();}
async function threePoint(goal){
  await stop();const initial=await snap(),start=initial.cars.find(c=>c.id===initial.player.car).a,sign=Math.sign(angleDelta(start,headingTo(initial.player,goal)))||1;
  for(const [direction,aim]of [[1,start+sign*Math.PI/2],[-1,start+sign*Math.PI]]){
    const began=Date.now();while(Date.now()-began<9000){const s=await snap(),car=s.cars.find(c=>c.id===s.player.car);if(!car)throw Error('Vehicle lost during turn');if(Math.abs(angleDelta(car.a,aim))<.12)break;
      const speed=car.speed*direction,k=[sign*direction>0?'KeyD':'KeyA'];if(speed<4.5)k.push(direction>0?'KeyW':'KeyS');else if(speed>5.2)k.push(direction>0?'KeyS':'KeyW');await keys(k);await page.waitForTimeout(90);
    }await stop();
  }
}
async function driveTo(target,{max=13,timeout=120000,stopAtEnd=true,via=[],direct=false,cornerRadius=9}={}){
  let s=await snap();assert(s.player.car);let from=s.player;const raw=[];
  for(const destination of [...via,target]){raw.push(...(direct?[destination]:roadRoute(from,destination)));from=destination;}
  const unique=raw.filter((p,i)=>!i||dist(p,raw[i-1])>1);
  const path=unique.filter((p,i,a)=>{if(i===a.length-1)return true;if(dist(p,s.player)<9&&i===0)return false;const before=a[i-1],after=a[i+1];return !before||Math.abs((p.x-before.x)*(after.z-p.z)-(p.z-before.z)*(after.x-p.x))>.1;});console.log('driving route',path);
  const start=Date.now();
  let reportAt=start;
  for(let i=0;i<path.length;i++){
    const point=path[i],last=i===path.length-1,origin=i?path[i-1]:s.player,segmentX=point.x-origin.x,segmentZ=point.z-origin.z;let mode=null,previous=null,stuck=0;
    while(Date.now()-start<timeout){s=await snap();if(s.menu)throw Error('Menu while driving '+s.menu);if(driveObserver){await driveObserver(s);s=await snap();}const p=s.player,car=s.cars.find(c=>c.id===p.car);if(!car)throw Error('Vehicle lost');const d=dist(p,point),next=path[i+1],passedCorner=next&&((Math.abs(next.x-point.x)>1&&Math.abs(next.z-point.z)<1&&(p.x-point.x)*Math.sign(next.x-point.x)>4&&Math.abs(p.z-point.z)<14)||(Math.abs(next.z-point.z)>1&&Math.abs(next.x-point.x)<1&&(p.z-point.z)*Math.sign(next.z-point.z)>4&&Math.abs(p.x-point.x)<14)),passedEnd=last&&!stopAtEnd&&((p.x-point.x)*segmentX+(p.z-point.z)*segmentZ>0)&&d<22;if(d<(last?(stopAtEnd?4:11):cornerRadius)||passedCorner||passedEnd)break;
      if(Date.now()-reportAt>6000){reportAt=Date.now();console.log('drive status',JSON.stringify({time:s.time,p,condition:car.health,heading:car.a,heat:s.police.level,seen:s.police.seen,search:s.police.search}));}
      const look=Math.max(14,Math.abs(car.speed)*.8),aim=d>26&&Math.abs(segmentX)>Math.abs(segmentZ)*3?{x:clamp(p.x+Math.sign(segmentX)*look,Math.min(origin.x,point.x),Math.max(origin.x,point.x)),z:point.z}:d>26&&Math.abs(segmentZ)>Math.abs(segmentX)*3?{x:point.x,z:clamp(p.z+Math.sign(segmentZ)*look,Math.min(origin.z,point.z),Math.max(origin.z,point.z))}:point;
      const heading=headingTo(p,aim);if(mode===null&&d>25&&Math.abs(angleDelta(car.a,headingTo(p,point)))>2.4){await threePoint(point);continue;}if(mode===null)mode=d<22&&Math.abs(angleDelta(car.a,heading))>1.85?-1:1;
      const error=angleDelta(car.a,heading+(mode<0?Math.PI:0)),magnitude=Math.abs(error),speed=car.speed*mode,k=[];
      let desired=Math.min(max,Math.max(last?3.8:5,d*.7))*(1-Math.min(magnitude,1)*.58),hazard=false;
      for(const person of s.people.filter(v=>v.hp>0&&v.role==='civilian')){const dx=person.x-car.x,dz=person.z-car.z,ahead=(dx*Math.sin(car.a)-dz*Math.cos(car.a))*mode,side=Math.abs(dx*Math.cos(car.a)+dz*Math.sin(car.a));if(ahead>0&&ahead<Math.max(22,Math.abs(car.speed)*.9)&&side<3.5){desired=Math.min(desired,Math.max(0,(ahead-4)*1.1));hazard=true;}}
      if(error*mode>.07)k.push('KeyD');else if(error*mode<-.07)k.push('KeyA');
      if(speed<desired)k.push(mode>0?'KeyW':'KeyS');else if(speed>desired+1.5)k.push(mode>0?'KeyS':'KeyW');
      if(speed>8&&(magnitude>.8||d<24&&speed>desired+4)||hazard&&speed>desired+2)k.push('Space');
      await keys(k);await page.waitForTimeout(170);
      if(previous&&dist(previous,p)<.08)stuck++;else stuck=0;previous=p;
      if(stuck>35)throw Error('Driving stuck at '+JSON.stringify(p)+' toward '+JSON.stringify(point));
    }
    if(Date.now()-start>=timeout)throw Error('Drive timeout '+JSON.stringify(point));
  }
  if(stopAtEnd)await stop();
}
async function capture(name){await keys();await page.screenshot({path:'.qa/'+name+'.jpg',type:'jpeg',quality:88});}
export {server,browser,context,page,errors,external,steps,snap,keys,mark,tap,walkTo,stop,driveTo,capture,port};
if(!process.env.DRIVER_ONLY)try{
  await page.goto('http://127.0.0.1:'+port,{waitUntil:'networkidle'});
  if(!process.env.RESUME){
  await page.getByRole('button',{name:'Begin Low Water',exact:true}).click();await page.waitForFunction(()=>!document.getElementById('hud').hidden);await page.waitForTimeout(1300);await mark('new story');
  await walkTo({x:286,z:-27});await tap('KeyF');assert.equal((await snap()).mission.stage,1);await mark('envelope collected on foot');
  await walkTo({x:291,z:18});await tap('KeyE');assert((await snap()).player.car);await mark('entered owned Kestrel');
  await driveTo({x:185,z:72});await tap('KeyF');assert.equal((await snap()).progress.chapter,1);await mark('first story job paid');await capture('first-job-delivered');
  await tap('KeyF');await page.waitForFunction(()=>window.cairn.snapshot().menu==='garage');await page.getByRole('button',{name:/Road tires/}).click();assert((await snap()).progress.upgrades.grip);await page.getByRole('button',{name:'Back to the street',exact:true}).click();await mark('garage upgrade purchased');
  await tap('F5');const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('cairn-coast-low-water-v1')));assert.equal(saved.chapter,1);assert(saved.upgrades.grip);await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'Continue saved game',exact:true}).click();assert.equal((await snap()).progress.chapter,1);assert((await snap()).progress.upgrades.grip);await mark('save and reload preserved progression');
  }else {await page.getByRole('button',{name:'Continue saved game',exact:true}).click();await mark('continued earned chapter one save');}
  if(!process.env.FIRST_JOB_ONLY){
  await tap('KeyM');await page.getByRole('button',{name:'Call SORA',exact:true}).click();await page.getByRole('button',{name:'Take the job',exact:true}).click();assert.equal((await snap()).mission.index,1);
  await walkTo({x:203,z:72});await walkTo({x:203,z:-167});await walkTo({x:116,z:-167});await tap('KeyE');assert((await snap()).player.car);assert((await snap()).police.level>=2);await mark('auditor van stolen; tracker escalated heat');
  await driveTo({x:300,z:-180},{max:29,stopAtEnd:false});await mark('police response on the waterfront');await capture('van-chase-waterfront');
  await driveTo({x:300,z:300},{max:29,stopAtEnd:false});await capture('van-chase-strand');
  for(const point of [{x:-300,z:300},{x:-300,z:-300}]){if(!(await snap()).police.level)break;await driveTo(point,{max:29,stopAtEnd:false});}
  const escapeStart=Date.now();let turn=0;const evade=[{x:-300,z:180},{x:-300,z:-60},{x:-200,z:-60},{x:-200,z:-180},{x:-100,z:-180},{x:-100,z:-300}];while(Date.now()-escapeStart<90000&&(await snap()).police.level){await page.waitForTimeout(300);if((await snap()).police.seen)await driveTo(evade[turn++%evade.length],{max:29,stopAtEnd:false});}await stop();
  await mark('escape attempt complete');assert.equal((await snap()).police.level,0);
  await driveTo({x:185,z:72},{max:27});await tap('KeyF');assert.equal((await snap()).progress.chapter,2);await mark('second story job paid');await tap('F5');
  }
  assert.equal(errors.length,0);assert.equal(external.length,0);
  await writeFile('.qa/browser-save.json',JSON.stringify(await context.storageState(),null,2));
}catch(e){errors.push(String(e));console.error(String(e));await capture('failure-state').catch(()=>{});}
finally{
  await keys();const final=await snap().catch(()=>null);await writeFile('.qa/browser-save.json',JSON.stringify(await context.storageState(),null,2));await writeFile('.qa/'+(process.env.REPORT||'browser-playthrough.json'),JSON.stringify({errors,external,steps,final},null,2));console.log('RESULT',JSON.stringify({errors,external,steps:steps.map(s=>s.label),final:final?{player:final.player,mission:final.mission,progress:final.progress,frames:final.frames}:null}));await browser.close();server.kill();
}
