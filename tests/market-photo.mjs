import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
process.env.RESUME='1';process.env.DRIVER_ONLY='1';
const {server,browser,page,errors,external,snap,keys,tap,walkTo,port}=await import('./browser.mjs');
try{
  await page.goto('http://127.0.0.1:'+port,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Continue saved game',exact:true}).click();
  assert.equal((await snap()).progress.chapter,5);
  for(const target of [{x:300,z:135},{x:300,z:60},{x:300,z:20},{x:296,z:20}])await walkTo(target,1.5);
  await tap('Escape');await page.locator('#quality').selectOption('high');await page.getByRole('button',{name:'Return to the city',exact:true}).click();
  await page.waitForTimeout(1200);await page.screenshot({path:'.qa/market-forward.jpg',type:'jpeg',quality:88});
  await page.mouse.move(640,360);await page.mouse.down({button:'right'});await page.mouse.move(810,360,{steps:5});await page.mouse.up({button:'right'});await page.waitForTimeout(500);
  await page.screenshot({path:'.qa/market-quarter.jpg',type:'jpeg',quality:88});
  assert.equal(errors.length,0);assert.equal(external.length,0);
}catch(e){errors.push(String(e));}
finally{await keys();await writeFile('.qa/market-photo.json',JSON.stringify({errors,external,final:await snap().catch(()=>null)},null,2));await browser.close();server.kill();}
