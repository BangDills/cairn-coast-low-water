import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {headingTo,angleDelta,roadRoute,roadAnchor} from '../game/src/math.js';
process.env.RESUME='1';process.env.DRIVER_ONLY='1';
const {server,browser,context,page,errors,external,steps,snap,keys,mark,tap,walkTo,stop,driveTo,capture,port}=await import('./browser.mjs');
async function call(){await tap('KeyM');await page.getByRole('button',{name:/^Call /}).click();await page.getByRole('button',{name:'Take the job',exact:true}).click();}
async function walkRoad(target){for(const point of roadRoute((await snap()).player,target))await walkTo(point,2.2);}
async function quality(q){await tap('Escape');await page.locator('#quality').selectOption(q);await page.getByRole('button',{name:'Return to the city',exact:true}).click();}
let combatPhoto=false;
async function fireAt(getTarget,{timeout=30000,condition=()=>true}={}){
  await keys();await tap('Digit2');const start=Date.now();
  while(Date.now()-start<timeout){const s=await snap(),t=getTarget(s);if(!t||!condition(t,s))return;if(s.menu)throw Error('Menu during combat '+s.menu);
    if(!t.screen.visible||t.screen.x<260||t.screen.x>1020||t.screen.y<80||t.screen.y>640){const turn=angleDelta(s.camera.yaw,headingTo(s.player,t));await page.mouse.move(640,360);await page.mouse.down({button:'right'});await page.mouse.move(640-turn/.005,360,{steps:5});await page.mouse.up({button:'right'});await page.waitForTimeout(350);continue;}
    await page.mouse.move(t.screen.x,t.screen.y);await page.mouse.down();await page.waitForTimeout(160);await page.mouse.up();if(!s.player.car&&!combatPhoto&&!process.env.SKIP_PHOTO){await mkdir('screenshots',{recursive:true});await page.screenshot({path:'screenshots/02-port-firefight.jpg',type:'jpeg',quality:88});combatPhoto=true;await mark('direct on-foot firefight capture');await quality('eco');}await page.waitForTimeout(200);
  }throw Error('Combat target timeout');
}
async function escape(){
  const edge=(await snap()).player.z<0?-300:300;
  for(const p of [{x:300,z:edge},{x:-300,z:edge},{x:-300,z:-edge},{x:300,z:-edge}]){if(!(await snap()).police.level)break;await driveTo(p,{max:52,stopAtEnd:false});}
  await stop();const start=Date.now();
  while((await snap()).police.level&&Date.now()-start<70000){const s=await snap();if(s.police.seen){await driveTo({x:s.player.x>0?-200:200,z:-300},{max:30,stopAtEnd:false});await driveTo({x:s.player.x>0?-200:200,z:180},{max:30});}else await page.waitForTimeout(500);}
  assert.equal((await snap()).police.level,0,'escape successful');
}
try{
  await page.goto('http://127.0.0.1:'+port,{waitUntil:'networkidle'});await page.getByRole('button',{name:'Continue saved game',exact:true}).click();await mark('continued earned save for later story');
  const chapter=(await snap()).progress.chapter;assert(chapter>=2,'requires the earned second-job save');
  if(chapter===2){
    if((await snap()).player.armor<100){await walkRoad({x:315,z:80});await tap('KeyF');assert.equal((await snap()).menu,'clinic');await page.getByRole('button',{name:/Harbor work vest/}).click();assert.equal((await snap()).player.armor,100);await page.getByRole('button',{name:'Back to the street',exact:true}).click();await mark('clinic armor purchased');}
    await walkRoad({x:297,z:18});await tap('KeyE');assert((await snap()).player.car);
    if(!(await snap()).progress.upgrades.turbo&&(await snap()).progress.money>=1200){await driveTo({x:185,z:72},{max:30});await tap('KeyF');await page.getByRole('button',{name:/Tern engine tune/}).click();await page.getByRole('button',{name:/Reinforced chassis/}).click();await page.getByRole('button',{name:'Back to the street',exact:true}).click();await mark('earned funds invested in the escape vehicle');}
    await call();await driveTo({x:300,z:253},{max:38});await driveTo({x:254,z:253},{max:18});assert.equal((await snap()).mission.stage,1);await tap('KeyC');
    await fireAt(s=>s.mission.guards.filter(v=>v.hp>0).sort((a,b)=>Math.hypot(a.x-s.player.x,a.z-s.player.z)-Math.hypot(b.x-s.player.x,b.z-s.player.z))[0],{condition:(t,s)=>s.mission.guards.filter(v=>v.hp>0).length>1});await tap('KeyE');await walkTo({x:244,z:261},1.7);await mark('left vehicle to finish port security on foot');
    if(!process.env.SKIP_PHOTO)await quality('high');
    for(let i=0;i<3;i++)await fireAt(s=>s.mission.guards.find(v=>v.hp>0),{condition:t=>t.hp>0});
    await quality('eco');assert.equal((await snap()).mission.stage,2);await mark('three port guards defeated with cursor fire');
    if(!process.env.PHOTO_ONLY){
    await walkTo({x:238,z:253});await tap('KeyF');assert((await snap()).mission.stage>=3);await mark('manifest collected');
    const state=await snap(),car=state.cars.filter(c=>!c.destroyed&&Math.abs(c.speed)<10&&Math.hypot(c.x-state.player.x,c.z-state.player.z)<40).sort((a,b)=>(b.health/b.max-a.health/a.max)*40+Math.hypot(a.x-state.player.x,a.z-state.player.z)-Math.hypot(b.x-state.player.x,b.z-state.player.z))[0];assert(car);await walkTo(car,1.2);await tap('KeyE');assert((await snap()).player.car);await mark('fresh escape vehicle taken');await escape();await driveTo({x:300,z:18},{max:40});await tap('KeyE');await walkTo({x:286,z:18});await tap('KeyF');assert.equal((await snap()).progress.chapter,3);await mark('cold ledger completed');await tap('F5');await context.storageState({path:'.qa/browser-save.json'});await tap('KeyM');await page.screenshot({path:'screenshots/03-city-journal.jpg',type:'jpeg',quality:88});await page.getByRole('button',{name:'Return',exact:true}).click();
    }
  }
  if((await snap()).progress.chapter===3&&process.env.CHAPTER_LIMIT!=='3'){
    await walkRoad({x:286,z:135});await tap('KeyF');await page.getByRole('button',{name:'Rest & save',exact:true}).click();await page.getByRole('button',{name:'Back outside',exact:true}).click();const ride=(await snap()).cars.find(c=>c.owned&&!c.destroyed);await walkRoad(ride);await tap('KeyE');assert((await snap()).player.car);
    await call();await mark('dead air relay job accepted');
    if(!(await snap()).player.car){const near=(await snap()).cars.filter(c=>!c.destroyed).sort((a,b)=>Math.hypot(a.x-286,a.z-18)-Math.hypot(b.x-286,b.z-18))[0];await walkTo(near);await tap('KeyE');}
    for(const target of [{x:-115,z:-167},{x:85,z:-287},{x:286,z:-167}]){
      await driveTo(roadAnchor(target),{max:30});await tap('KeyE');await walkTo(target,.7);const uploadStage=(await snap()).mission.stage;for(let j=0;j<8&&(await snap()).mission.stage===uploadStage;j++){await keys(['KeyF',j%2?'KeyD':'KeyA']);await page.waitForTimeout(450);}await keys();assert((await snap()).mission.stage>uploadStage||!(await snap()).mission.active);await mark('relay upload complete while moving within the ring');
      const s=await snap();if(s.mission.failed)throw Error('Relay mission failed');const nearby=s.cars.filter(c=>!c.destroyed&&Math.abs(c.speed)<10&&Math.hypot(c.x-s.player.x,c.z-s.player.z)<40),fresh=nearby.toSorted((a,b)=>(b.health/b.max-a.health/a.max)*50+Math.hypot(a.x-s.player.x,a.z-s.player.z)-Math.hypot(b.x-s.player.x,b.z-s.player.z))[0],car=uploadStage===2?fresh:s.cars.find(c=>c.owned&&!c.destroyed)||fresh;await walkTo(car,1.2);await tap('KeyE');if(uploadStage===2)await mark('fresh vehicle selected for relay escape');
    }
    await escape();assert.equal((await snap()).progress.chapter,4);await mark('dead air completed within timer');await tap('F5');await context.storageState({path:'.qa/browser-save.json'});
  }
}catch(e){errors.push(String(e));console.error(String(e));await capture('story-failure').catch(()=>{});}
finally{await keys().catch(()=>{});await context.storageState({path:'.qa/browser-save.json'}).catch(()=>{});const final=await snap().catch(()=>null);await writeFile('.qa/story-playthrough.json',JSON.stringify({errors,external,steps,final},null,2));console.log('STORY RESULT',JSON.stringify({errors,external,steps:steps.map(x=>x.label),player:final?.player,progress:final?.progress,mission:final?.mission}));await browser.close().catch(()=>{});server.kill();}
