import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {roadRoute,dist,headingTo,angleDelta} from '../game/src/math.js';
process.env.RESUME='1';process.env.DRIVER_ONLY='1';
const {server,browser,context,page,errors,external,steps,snap,keys,mark,tap,walkTo,stop,driveTo,capture,port,observeDrive}=await import('./browser.mjs');
async function walkRoad(target){for(const point of roadRoute((await snap()).player,target)){await walkTo(point,2.3);if(!(await snap()).police.level){await tap('F5');await context.storageState({path:'.qa/browser-save.json'});}}}
async function quality(q){await tap('Escape');await page.locator('#quality').selectOption(q);await page.getByRole('button',{name:'Return to the city',exact:true}).click();}
async function buy(pattern){await page.getByRole('button',{name:pattern}).click();}
let cover=false;
let defending=false;
async function defend(s){
  const threats=s.cars.filter(c=>c.role==='patrol'&&!c.destroyed&&c.health>0&&dist(c,s.player)<28).sort((a,b)=>dist(a,s.player)-dist(b,s.player));
  const target=threats[0];
  if(!target){await page.mouse.up();if(defending){await tap('KeyC');defending=false;}return;}
  if(!target.screen.visible||target.screen.x<260||target.screen.x>1020||target.screen.y<100||target.screen.y>640){await page.mouse.up();const turn=angleDelta(s.camera.yaw,headingTo(s.player,target));await page.mouse.move(640,360);await page.mouse.down({button:'right'});await page.mouse.move(640-turn/.005,360,{steps:4});await page.mouse.up({button:'right'});return;}
  defending=true;await page.mouse.move(target.screen.x,target.screen.y);await page.mouse.down();
}
try{
  await page.goto('http://127.0.0.1:'+port,{waitUntil:'networkidle'});await page.getByRole('button',{name:'Continue saved game',exact:true}).click();assert.equal((await snap()).progress.chapter,4);
  const initial=await snap(),ride=initial.cars.find(c=>c.owned);await walkRoad({x:ride.x+2.4,z:ride.z});await tap('KeyE');assert((await snap()).player.car);
  if(!initial.progress.upgrades.smg||initial.player.hp<99||initial.player.armor<99||initial.weapon.ammo.pistol<48){
  await driveTo({x:185,z:72},{max:30});assert.equal((await snap()).police.level,0);await tap('KeyF');if(!(await snap()).progress.upgrades.turbo)await buy(/Tern engine tune/);if(!(await snap()).progress.upgrades.armor)await buy(/Reinforced chassis/);await buy(/Repair vehicle/);await buy(/Back to the street/);const repaired=await snap();assert.equal(repaired.cars.find(c=>c.id===repaired.player.car).health,repaired.cars.find(c=>c.id===repaired.player.car).max);await mark('garage engine and chassis upgrades fitted');
  await driveTo({x:15,z:-76},{max:30});await tap('KeyF');await buy(/Kite 9 ammunition/);if(!(await snap()).progress.upgrades.smg)await buy(/Tern SMG/);await buy(/Back to the street/);await mark('supply shop weapon and ammunition purchases');
  await driveTo({x:286,z:135},{max:30});await tap('KeyF');await buy(/Rest & save/);await buy(/Back outside/);await context.storageState({path:'.qa/browser-save.json'});
  }else await mark('continued prepared earned checkpoint');
  await driveTo({x:203,z:230},{max:30});await quality('eco');
  await tap('KeyM');await buy(/^Call /);await buy(/^Take the job$/);await tap('KeyC');await tap('Digit3');
  await mark('moving archive convoy intercepted through normal driving');
  const firing=Date.now();while((await snap()).mission.stage===0&&Date.now()-firing<30000){const s=await snap(),truck=s.cars.find(c=>c.tag==='archive');assert(truck&&!truck.destroyed);if(!truck.screen.visible||truck.screen.x<260||truck.screen.x>1020||truck.screen.y<80||truck.screen.y>640){await page.mouse.up();const turn=angleDelta(s.camera.yaw,headingTo(s.player,truck));await page.mouse.move(640,360);await page.mouse.down({button:'right'});await page.mouse.move(640-turn/.005,360,{steps:5});await page.mouse.up({button:'right'});await page.waitForTimeout(350);continue;}await page.mouse.move(truck.screen.x,truck.screen.y);await page.mouse.down();await page.waitForTimeout(90);}await page.mouse.up();
  assert.equal((await snap()).mission.stage,1);await mark('archive engine disabled with automatic fire');await capture('archive-disabled');
  await quality('eco');let truck=(await snap()).cars.find(c=>c.tag==='archive');await driveTo(truck,{max:18});await tap('KeyE');const boarding=Date.now();while(!(await snap()).player.car&&Date.now()-boarding<18000){const s=await snap();assert(!s.menu);truck=s.cars.find(c=>c.tag==='archive');if(dist(s.player,truck)<4.7){await tap('KeyE');continue;}const dx=truck.x-s.player.x,dz=truck.z-s.player.z,yaw=s.camera.yaw,f=dx*Math.sin(yaw)-dz*Math.cos(yaw),r=dx*Math.cos(yaw)+dz*Math.sin(yaw),k=['ShiftLeft'];if(Math.abs(f)>.4)k.push(f>0?'KeyW':'KeyS');if(Math.abs(r)>.4)k.push(r>0?'KeyD':'KeyA');await keys(k);await page.waitForTimeout(100);}await keys();const taken=await snap();assert.equal(taken.cars.find(c=>c.id===taken.player.car)?.tag,'archive');assert(taken.cars.find(c=>c.tag==='archive').health>180);await mark('disabled archive boarded and crew engine bypass applied');
  await quality(process.env.SKIP_COVER?'eco':'high');await mkdir('screenshots',{recursive:true});
  if(!process.env.SKIP_COVER)observeDrive(async s=>{if(!cover&&s.player.car&&s.police.level>=4&&Math.abs(s.player.speed)>18&&Math.abs(s.cars.find(c=>c.id===s.player.car).a)<.12&&s.player.x>190&&s.player.x<210&&s.player.z<145&&s.player.z>-200&&s.police.units.some(c=>dist(c,s.player)<65)){
    await keys(['KeyW']);const pursuer=s.police.units.toSorted((a,b)=>dist(a,s.player)-dist(b,s.player))[0],turn=angleDelta(s.camera.yaw,headingTo(s.player,pursuer)+1.0);await page.mouse.move(640,360);await page.mouse.down({button:'right'});await page.mouse.move(640-turn/.005,300,{steps:5});await page.waitForTimeout(350);await page.screenshot({path:'screenshots/01-archive-pursuit.jpg',type:'jpeg',quality:88});await page.mouse.up({button:'right'});cover=true;await mark('direct cover capture: archive truck pursuit');await page.mouse.move(640,300);await page.mouse.down({button:'right'});await page.mouse.move(640,360,{steps:5});await page.mouse.up({button:'right'});await tap('KeyC');await quality('eco');
  }else if(cover)await defend(s);});
  for(const point of [{x:200,z:-300},{x:-300,z:-300},{x:-300,z:60}]){if(!(await snap()).police.level)break;await driveTo(point,{max:30,timeout:150000,stopAtEnd:false});}
  await page.mouse.up();observeDrive(null);await quality('eco');
  if((await snap()).police.level){await driveTo({x:-273,z:120},{max:14,direct:true,cornerRadius:5,via:[{x:-250,z:60},{x:-250,z:120}]});await mark('archive hidden in an Old Quarter back lane');}
  await stop();const start=Date.now();while((await snap()).police.level&&Date.now()-start<65000){assert(!(await snap()).menu);await page.waitForTimeout(400);}
  assert.equal((await snap()).police.level,0);await mark('cordon and air pursuit escaped with the archive');
  await driveTo({x:315,z:300},{max:30});await tap('KeyF');assert.equal((await snap()).mission.stage,4);await tap('KeyE');await walkTo({x:329,z:307});await tap('KeyF');assert.equal((await snap()).progress.chapter,5);await quality('high');await capture('ledger-released');await mark('all five story jobs completed through real input');await tap('F5');assert(cover||process.env.SKIP_COVER,'cover captured here or retained from an earlier real pursuit');
  assert.equal(errors.length,0);assert.equal(external.length,0);
}catch(e){errors.push(String(e));console.error(String(e));await capture('finale-failure').catch(()=>{});}
finally{await keys().catch(()=>{});await context.storageState({path:'.qa/browser-save.json'}).catch(()=>{});const final=await snap().catch(()=>null);await writeFile('.qa/finale-playthrough.json',JSON.stringify({errors,external,steps,final},null,2));console.log('FINALE RESULT',JSON.stringify({errors,external,steps:steps.map(x=>x.label),final:final?{player:final.player,progress:final.progress,mission:final.mission}:null}));await browser.close();server.kill();}
