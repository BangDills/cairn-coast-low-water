import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {dist} from '../game/src/math.js';
process.env.DRIVER_ONLY='1';process.env.PORT='8097';delete process.env.RESUME;
const {server,browser,page,errors,external,steps,snap,keys,mark,tap,walkTo,stop,capture,port}=await import('./browser.mjs');
try{
  await page.goto('http://127.0.0.1:'+port,{waitUntil:'networkidle'});await page.getByRole('button',{name:'Begin Low Water',exact:true}).click();await walkTo({x:300,z:60});
  const start=Date.now();let target;
  while(Date.now()-start<45000){const s=await snap();target=s.cars.find(c=>c.role==='traffic'&&!c.destroyed&&dist(c,s.player)<5.2&&Math.abs(c.speed)<10.6);if(target)break;await page.waitForTimeout(100);}
  assert(target,'a slowing occupied traffic car reaches the junction');await tap('KeyE');const taken=await snap();assert.equal(taken.player.car,target.id);assert(taken.police.level>0);assert(taken.events.some(v=>v.event==='entered-vehicle'&&v.stolen));await mark('occupied traffic car stolen at a slowing junction');await capture('occupied-car-theft');
  await stop();await tap('KeyE');assert.equal((await snap()).player.car,null);await mark('vehicle stopped and exited on foot');assert.equal(errors.length,0);assert.equal(external.length,0);
}catch(e){errors.push(String(e));console.error(String(e));await capture('theft-failure').catch(()=>{});}
finally{await keys().catch(()=>{});const final=await snap().catch(()=>null);await writeFile('.qa/theft-test.json',JSON.stringify({errors,external,steps,final},null,2));console.log('THEFT RESULT',JSON.stringify({errors,external,steps:steps.map(x=>x.label)}));await browser.close();server.kill();}
