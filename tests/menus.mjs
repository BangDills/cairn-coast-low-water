import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
process.env.DRIVER_ONLY='1';process.env.PORT='8096';delete process.env.RESUME;
const {server,browser,context,page,errors,external,steps,snap,keys,mark,tap,walkTo,capture,port}=await import('./browser.mjs');
try{
  await page.goto('http://127.0.0.1:'+port,{waitUntil:'networkidle'});
  assert(await page.getByRole('button',{name:'Continue saved game',exact:true}).isDisabled());
  await page.getByRole('button',{name:'Controls',exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  const narrow=await page.evaluate(()=>({body:document.body.scrollWidth,width:innerWidth,menu:document.getElementById('screen').scrollWidth}));assert(narrow.body<=390&&narrow.menu<=390);
  await page.getByRole('button',{name:'Back',exact:true}).scrollIntoViewIfNeeded();await capture('narrow-controls');await page.getByRole('button',{name:'Back',exact:true}).click();
  await page.setViewportSize({width:1280,height:720});await page.getByRole('button',{name:'Begin Low Water',exact:true}).click();await page.waitForTimeout(1000);
  await tap('KeyV');assert.match(await page.locator('#radio').innerText(),/RADIO OFF/);await tap('KeyV');assert.match(await page.locator('#radio').innerText(),/RADIO TERN/);
  await tap('Escape');await page.getByLabel('Sound',{exact:true}).uncheck();await page.getByLabel('Reduced camera motion',{exact:true}).check();await page.locator('#quality').selectOption('eco');
  await page.getByRole('button',{name:'Save progress',exact:true}).click();assert.match(await page.locator('#save-message').innerText(),/Progress saved/);
  await page.getByRole('button',{name:'Start a new story',exact:true}).click();await page.getByRole('button',{name:'Keep this story',exact:true}).click();assert.equal((await snap()).menu,'pause');
  await page.getByRole('button',{name:'Controls',exact:true}).click();await page.getByRole('button',{name:'Back',exact:true}).click();
  await page.getByRole('button',{name:'Map & jobs',exact:true}).click();await page.getByRole('button',{name:'Retry job',exact:true}).click();assert.equal((await snap()).mission.stage,0);
  await tap('KeyM');await page.getByRole('button',{name:'Abandon job',exact:true}).click();assert(!(await snap()).mission.active);await tap('KeyM');await page.getByRole('button',{name:'Call INEZ',exact:true}).click();await page.getByRole('button',{name:'Back to the city',exact:true}).click();await mark('menu navigation, cancel, retry and abandon');
  await page.setViewportSize({width:1024,height:768});await capture('desktop-1024-hud');await page.setViewportSize({width:1280,height:720});
  await tap('Digit2');await page.mouse.move(650,340);await page.mouse.down();await page.waitForTimeout(3500);await page.mouse.up();assert((await snap()).police.level>0);await tap('F5');assert.match(await page.locator('#toast').innerText(),/unavailable during a pursuit/);await mark('pursuit blocks saving');
  await page.waitForFunction(()=>window.cairn.snapshot().menu==='defeat',null,{timeout:100000});const before=(await snap()).progress;await tap('Escape');assert.equal((await snap()).menu,'defeat');await tap('KeyM');assert.equal((await snap()).menu,'defeat');await capture('actual-defeat');await page.getByRole('button',{name:'Recover at Strand clinic',exact:true}).click();assert.equal((await snap()).player.hp,100);assert.equal((await snap()).progress.chapter,before.chapter);assert.equal((await snap()).police.level,0);await mark('actual defeat and recovery preserve completed progress');
  await walkTo({x:300,z:79});await walkTo({x:300,z:135});await walkTo({x:286,z:135});await tap('KeyF');await page.getByRole('button',{name:'Rest & save',exact:true}).click();assert.equal((await snap()).player.armor,100);await page.getByRole('button',{name:'Crew journal',exact:true}).click();await page.getByRole('button',{name:'Return',exact:true}).click();await mark('safehouse rest and save');
  await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'Begin Low Water',exact:true}).click();assert.equal((await snap()).menu,'confirm');await page.getByRole('button',{name:'Keep this story',exact:true}).click();assert.equal((await snap()).menu,'start');await page.getByRole('button',{name:'Continue saved game',exact:true}).click();assert.equal((await snap()).player.armor,100);await mark('start screen protects an existing save');
  await tap('Escape');await page.locator('#quality').selectOption('auto');await page.getByLabel('Sound',{exact:true}).check();await page.getByLabel('Reduced camera motion',{exact:true}).uncheck();await page.getByRole('button',{name:'Start a new story',exact:true}).click();await page.getByRole('button',{name:'Replace save and begin',exact:true}).click();assert.equal((await snap()).progress.chapter,0);assert.equal((await snap()).progress.money,400);assert.equal((await snap()).player.armor,0);await mark('confirmed new story resets only the isolated test save');
  assert.equal(errors.length,0);assert.equal(external.length,0);
}catch(e){errors.push(String(e));console.error(String(e));await capture('menu-failure').catch(()=>{});}
finally{await keys().catch(()=>{});const final=await snap().catch(()=>null);await writeFile('.qa/menu-tests.json',JSON.stringify({errors,external,steps,final},null,2));console.log('MENU RESULT',JSON.stringify({errors,external,steps:steps.map(x=>x.label),final:final?{player:final.player,menu:final.menu}:null}));await browser.close();server.kill();}
