import { clamp, dist, district, street, ROADS_X, ROADS_Z } from './math.js';
import { PLACES } from './world.js';
import { STORY } from './missions.js';
import { WEAPONS } from './combat.js';
import { SHOP_ITEMS, purchase } from './progression.js';
const $=id=>document.getElementById(id);
const money=n=>'$'+Math.floor(n).toLocaleString('en-US');
const timer=n=>Math.floor(Math.max(0,n)/60)+':'+String(Math.floor(Math.max(0,n)%60)).padStart(2,'0');
export class GameUI {
  constructor(g){this.g=g;this.hitTime=0;this.clock=0;this.shopMessage='';this.lastContext='';this.map=$('minimap').getContext('2d');}
  screen(kind,html) {
    const g=this.g;g.menu=kind;g.input.clear();g.audio.pause(true);$('screen').hidden=false;$('screen-content').innerHTML=html;
    const first=$('screen-content').querySelector('button:not(:disabled)');if(first)first.focus({preventScroll:true});
  }
  bind(id,fn){const e=$(id);if(e)e.addEventListener('click',fn);}
  start() {
    const g=this.g;this.screen('start',`<div class="menu-kicker">AN ORIGINAL HARBOR CRIME STORY</div><h1 class="title">CAIRN<br>COAST<em>LOW WATER</em></h1><p class="intro">The port owns the police. Your crew has the ledger.<br>Drive the coast. Steal back the city.</p><div class="menu-actions"><button id="begin" class="primary">Begin Low Water</button><button id="continue" ${g.store.cached?'':'disabled'}>Continue saved game</button><button id="how">Controls</button></div><p class="menu-note">Five staged story jobs. A living city on foot and by car.<br>Local saves • Original synthesized audio • Fully offline<br>${g.store.error||'Your first ride is waiting by the ferry market.'}</p>`);
    this.bind('begin',()=>g.store.cached?this.confirmNew('start'):g.begin(false));this.bind('continue',()=>g.begin(true));this.bind('how',()=>this.controls('start'));
  }
  controls(back='pause') {
    this.screen('controls',`<div class="menu-kicker">FIELD GUIDE</div><h1 class="menu-title">Know your way around.</h1><div class="columns"><div><div class="keylist"><div><kbd>W A S D</kbd> walk / throttle & steer</div><div><kbd>SHIFT</kbd> sprint on foot</div><div><kbd>E</kbd> enter, steal or leave a car</div><div><kbd>F</kbd> talk, buy, collect, deliver</div><div><kbd>SPACE</kbd> handbrake / jump</div><div><kbd>Q</kbd> cycle available weapons</div><div><kbd>MOUSE</kbd> aim & click to fire</div><div><kbd>R</kbd> reload</div><div><kbd>RIGHT DRAG</kbd> orbit the camera</div><div><kbd>← →</kbd> orbit without a mouse</div><div><kbd>C</kbd> center the camera</div><div><kbd>M</kbd> map, jobs & checkpoints</div><div><kbd>F5</kbd> save when clear</div><div><kbd>V</kbd> radio on / off</div><div><kbd>ESC</kbd> pause / close menu</div></div><button id="back" class="primary">Back</button></div><article class="menu-card"><h3>Lose their sightline.</h3><p>Patrols pursue the last location where they saw you. Turn behind buildings and keep moving. An unseen vehicle swap shortens the search. At three wanted tiers, expect a cordon; at four, an air unit.<br><br>Shops and handovers need a clear wanted level. New plates at Tern Motors can reduce a pursuit if the patrol cannot see you.<br><br>A failed job can be restarted from the map. Completed jobs and purchased upgrades survive a hospital visit. Saving stores completed jobs, upgrades, standing, ammunition and your current location; a job in progress restarts from its briefing after a reload.</p></article></div>`);
    this.bind('back',()=>back==='start'?this.start():this.pause());
  }
  pause() {
    const g=this.g;this.screen('pause',`<div class="menu-kicker">CAIRN COAST / LOW WATER</div><h1 class="menu-title">Take a breath.</h1><p class="menu-sub">${district(g.player)} • ${money(g.save.money)} • ${g.save.chapter} / 5 story jobs complete</p><div class="columns"><div><div class="menu-actions"><button id="resume" class="primary">Return to the city</button><button id="map-open">Map & jobs</button><button id="save">Save progress</button><button id="how">Controls</button></div><div class="settings"><label for="sound"><input id="sound" type="checkbox" ${!g.audio.muted?'checked':''}> Sound</label><label for="reduce"><input id="reduce" type="checkbox" ${g.settings.reduced?'checked':''}> Reduced camera motion</label><label for="quality">Quality <select id="quality"><option value="high" ${g.settings.quality==='high'?'selected':''}>Shadows</option><option value="eco" ${g.settings.quality==='eco'?'selected':''}>Performance</option></select></label></div><p id="save-message" class="menu-note">${g.store.error||'Save while clear. Your browser keeps the save on this device.'}</p><button id="new" class="danger">Start a new story</button></div><article class="menu-card"><h3>Your standing</h3><p>${g.rankName()} • ${g.save.rep} standing<br>${g.save.stats.cars} vehicles taken • ${g.save.stats.escapes} pursuits escaped<br>${g.save.stats.activities} activities finished • ${g.save.caches.length} / 12 hidden dock cases found<br>Strand sprint best: ${g.save.bestRace?g.save.bestRace.toFixed(2)+' seconds':'not yet set'}</p></article></div>`);
    const quality=$('quality');quality.add(new Option('Automatic','auto'),0);quality.value=g.settings.quality;
    this.bind('resume',()=>g.closeMenu());this.bind('map-open',()=>this.journal());this.bind('how',()=>this.controls());this.bind('save',()=>{$('save-message').textContent=g.saveProgress()?'Progress saved on this device.':g.police.level?'Lose the patrol before saving.':g.store.error;});
    this.bind('new',()=>this.confirmNew());
    $('sound').addEventListener('change',()=>{g.audio.toggle();});$('reduce').addEventListener('change',e=>{g.settings.reduced=e.target.checked;});$('quality').addEventListener('change',e=>{g.settings.quality=e.target.value;const mean=g.frameTimes.slice(-30).reduce((a,b)=>a+b,0)/Math.min(30,g.frameTimes.length);g.render.quality(e.target.value==='auto'?(mean>65?'eco':'high'):e.target.value);});
  }
  confirmNew(back='pause'){this.screen('confirm',`<h1 class="menu-title">Start over?</h1><p class="menu-sub">This replaces the current local story save. Your new run begins at the ferry market.</p><div class="menu-actions"><button id="cancel">Keep this story</button><button id="reset" class="danger">Replace save and begin</button></div>`);this.bind('cancel',()=>back==='start'?this.start():this.pause());this.bind('reset',()=>{this.g.store.clear();this.g.begin(false);});}
  briefing(index=this.g.save.chapter) {
    const job=STORY[index];if(!job)return this.journal();
    this.screen('briefing',`<div class="menu-kicker">JOB ${index+1} / 5 • ${job.contact}</div><h1 class="menu-title">${job.title}</h1><div class="columns"><div><p class="menu-sub">${job.brief}</p><div class="menu-actions"><button id="accept" class="primary">Take the job</button><button id="back">Back to the city</button></div><p class="menu-note">Payment ${money(job.reward)} • +${job.rep} standing<br>${job.stages.length} stages${job.time?' • '+timer(job.time)+' time limit':''}</p></div><article class="menu-card"><h3>First objective</h3><p>${job.stages[0].text}<br><br>${job.stages[0].hint}<br><br>Failed jobs can be retried from the map. Your completed story progress is preserved.</p></article></div>`);
    this.bind('accept',()=>this.g.missions.start(index));this.bind('back',()=>this.g.closeMenu());
  }
  journal() {
    const g=this.g,m=g.missions,next=STORY[g.save.chapter];
    this.screen('map',`<div class="menu-kicker">CITY MAP / CREW JOURNAL</div><h1 class="menu-title">Every road leads to the water.</h1><div class="columns"><div><canvas id="atlas" width="740" height="650" aria-label="Full city map with roads, current objective and service locations"></canvas><p class="legend">I Inez • G Garage • H Safehouse • + Clinic • A Supply • R Race • D Delivery<br>Yellow: objective & route. Red: patrol. Ivory triangle: you.</p></div><div><div class="journal">${STORY.map((job,i)=>`<article><h3>${i<g.save.chapter?'✓':i===g.save.chapter?'●':'○'} ${i+1}. ${job.title}</h3><p>${i<g.save.chapter?'Complete • '+money(job.reward)+' earned':i===g.save.chapter?(m.active?m.failed?'Interrupted. Retry this job.':m.stage.text:job.brief):'Locked until the previous job is complete.'}</p></article>`).join('')}</div><div class="menu-actions"><button id="return" class="primary">Return</button>${m.active?'<button id="retry">Retry job</button><button id="abandon">Abandon job</button>':next?'<button id="next">Call '+next.contact.split(' ')[0]+'</button>':''}${g.activities.active?'<button id="cancel-activity">Cancel activity</button>':''}</div><p class="menu-note">${money(g.save.money)} • ${g.rankName()} • ${g.save.rep} standing<br>Cases found ${g.save.caches.length} / 12. Sprint best ${g.save.bestRace?g.save.bestRace.toFixed(1)+'s':'not set'}.</p></div></div>`);
    this.drawMap($('atlas').getContext('2d'),true);this.bind('return',()=>g.closeMenu());this.bind('next',()=>this.briefing());this.bind('retry',()=>m.retry());this.bind('abandon',()=>{m.cancel();g.closeMenu();g.toast('Job abandoned. Call Inez when ready.');});this.bind('cancel-activity',()=>{g.activities.active=null;g.closeMenu();});
  }
  showShop(kind) {
    const g=this.g,items=SHOP_ITEMS[kind],title={garage:'Tern Motors',clinic:'Strand clinic',arms:'Foundry Supply'}[kind];
    this.screen(kind,`<div class="menu-kicker">${district(g.player)} • ${money(g.save.money)}</div><h1 class="menu-title">${title}</h1><div class="columns"><div><div class="shop-actions">${items.map(item=>`<button id="buy-${item.id}" ${item.upgrade&&g.save.upgrades[item.id]?'disabled class="owned"':''}><span>${item.name}<br><small>${item.desc}</small></span><b>${item.upgrade&&g.save.upgrades[item.id]?'Fitted':money(item.price)}</b></button>`).join('')}</div><p id="shop-message" class="menu-sub" role="status">${this.shopMessage||'Choose a service. Purchases persist when you save.'}</p><button id="leave" class="primary">Back to the street</button></div><article class="menu-card"><h3>${g.player.car?g.player.car.config.name:'On foot'}</h3><p>${g.player.car?'Vehicle condition '+Math.ceil(g.player.car.health/g.player.car.maxHealth*100)+'%.<br>':''}Health ${Math.ceil(g.player.hp)} / 100<br>Armor ${Math.ceil(g.player.armor)} / 100<br><br>Installed: ${Object.keys(g.save.upgrades).filter(k=>g.save.upgrades[k]).join(', ')||'standard equipment'}<br><br>${kind==='garage'?'Sora fits upgrades to every vehicle you drive. Bring a car for repairs and plates.':kind==='arms'?'Q cycles weapons. R reloads. Aim with your cursor and click.':'Armor absorbs most incoming small-arms damage. Health recovers slowly once the coast is clear.'}</p></article></div>`);
    for(const item of items)this.bind('buy-'+item.id,()=>purchase(g,item.id));this.bind('leave',()=>{this.shopMessage='';g.closeMenu();});
  }
  home() {
    const g=this.g;this.screen('home',`<div class="menu-kicker">ROOM 9 / FERRY STRAND</div><h1 class="menu-title">A room above the tide.</h1><p class="menu-sub">Rest, save the ledger, then pick up the next job. Your safehouse restores health and armor when the patrol is clear.</p><div class="menu-actions"><button id="rest" class="primary">Rest & save</button><button id="journal">Crew journal</button><button id="leave">Back outside</button></div><p id="home-message" class="menu-note">Completed jobs ${g.save.chapter} / 5 • ${money(g.save.money)}</p>`);
    this.bind('rest',()=>{if(g.police.level){$('home-message').textContent='The patrol is still searching. Come back when clear.';return;}g.player.hp=100;g.player.armor=100;$('home-message').textContent=g.saveProgress()?'Rested. Health and armor restored. Progress saved.':g.store.error;g.audio.pickup();});this.bind('journal',()=>this.journal());this.bind('leave',()=>g.closeMenu());
  }
  activity(kind) {
    const g=this.g;this.screen('activity',`<div class="menu-kicker">${kind==='race'?'STRAND SPRINT':'AFTER-HOURS DELIVERY'}</div><h1 class="menu-title">${kind==='race'?'The long way around.':'Keep the quay moving.'}</h1><p class="menu-sub">${kind==='race'?'Four road checkpoints. Ninety seconds. Drive any vehicle and cut your own route. Finish for $400 and 60 standing. Your best time stays in the save.':'Three neighborhood drops in 170 seconds. Press F at each destination while in a vehicle. Each drop pays $150; finishing all three pays a $300 bonus.'}</p><div class="menu-actions"><button id="activity-start" class="primary">${kind==='race'?'Start the sprint':'Take the delivery round'}</button><button id="back">Back</button></div><p class="menu-note">Finish or abandon a story job first. Bring a vehicle.</p>`);
    this.bind('activity-start',()=>g.activities.start(kind));this.bind('back',()=>g.closeMenu());
  }
  defeat(title,reason){const g=this.g;this.screen('defeat',`<div class="menu-kicker">COAST PATROL / INCIDENT REPORT</div><h1 class="menu-title">${title}.</h1><p class="menu-sub">${reason}</p><div class="menu-actions"><button id="recover" class="primary">Recover at Strand clinic</button>${g.missions.active?'<button id="retry">Recover & retry job</button>':''}</div><p class="menu-note">Hospital fee: up to $150. Completed jobs, upgrades and standing are preserved.</p>`);this.bind('recover',()=>g.recover(false));this.bind('retry',()=>g.recover(true));}
  drawMap(cx,full=false) {
    const g=this.g,p=g.player,c=cx.canvas,w=c.width,h=c.height;
    cx.fillStyle='#33696e';cx.fillRect(0,0,w,h);
    const scale=full?Math.min(w/815,h/785):1.23,center=full?{x:12,z:0}:p;
    const xy=q=>({x:(q.x-center.x)*scale+w*.5,y:(q.z-center.z)*scale+h*.5});
    const rect=(x,z,ww,dd,color)=>{const a=xy({x:x-ww/2,z:z-dd/2});cx.fillStyle=color;cx.fillRect(a.x,a.y,ww*scale,dd*scale);};
    rect(-20,0,820,760,'#779487');rect(370,0,57,760,'#dcc99d');rect(328,0,25,740,'#bdc7ae');
    for(const b of g.world.buildings)rect(b.x,b.z,b.w,b.d,'#aab79c');
    for(const x of ROADS_X)rect(x,0,20,740,'#3f5c5b');
    for(const z of ROADS_Z)rect(0,z,660,20,'#3f5c5b');
    const target=g.activeTarget();
    if(target){
      const route=g.world.route(p,target);cx.strokeStyle='#ffcd59';cx.lineWidth=full?3:3;cx.lineJoin='round';cx.beginPath();const first=xy(p);cx.moveTo(first.x,first.y);for(const t of route){const q=xy(t);cx.lineTo(q.x,q.y);}cx.stroke();
      const q=xy(target);const x=clamp(q.x,8,w-8),y=clamp(q.y,8,h-8);cx.fillStyle='#ffcd59';cx.beginPath();cx.arc(x,y,full?6:5,0,7);cx.fill();cx.strokeStyle='#183d42';cx.lineWidth=2;cx.stroke();
    }
    if(g.police.level){const q=xy(g.police.lastKnown);cx.strokeStyle='#f28c76';cx.lineWidth=1;cx.setLineDash([4,4]);cx.beginPath();cx.arc(q.x,q.y,82*scale,0,7);cx.stroke();cx.setLineDash([]);}
    for(const [id,place]of Object.entries(PLACES)) {
      if(!full&&dist(place,p)>88)continue;const q=xy(place);cx.fillStyle='#102e34';cx.fillRect(q.x-6,q.y-6,12,12);cx.fillStyle='#fff0d6';cx.font='bold '+(full?13:10)+'px Arial';cx.textAlign='center';cx.textBaseline='middle';cx.fillText(place.icon,q.x,q.y+.5);
      if(full){cx.font='10px Arial';cx.textAlign='left';cx.fillText(place.name,q.x+9,q.y);}
    }
    for(const car of g.traffic.cars) {
      if(!full&&dist(car,p)>90||car.destroyed||car===p.car)continue;
      const q=xy(car);cx.save();cx.translate(q.x,q.y);cx.rotate(car.a);cx.fillStyle=car.role==='patrol'?'#ff9b81':car.missionTag?'#f5d06e':'#d1dac0';cx.fillRect(-1.5,-3.1,3,6.2);cx.restore();
    }
    if(g.police.heli.group.visible){const q=xy(g.police.heli);cx.strokeStyle='#fba389';cx.beginPath();cx.moveTo(q.x-5,q.y);cx.lineTo(q.x+5,q.y);cx.moveTo(q.x,q.y-5);cx.lineTo(q.x,q.y+5);cx.stroke();}
    const q=xy(p);cx.save();cx.translate(q.x,q.y);cx.rotate(p.car?p.car.a:p.a);cx.fillStyle='#fff5d9';cx.strokeStyle='#102e34';cx.lineWidth=2;cx.beginPath();cx.moveTo(0,-7);cx.lineTo(5,5);cx.lineTo(0,2);cx.lineTo(-5,5);cx.closePath();cx.fill();cx.stroke();cx.restore();
    if(full){cx.font='bold 16px Arial';cx.fillStyle='#f4e9c6';cx.textAlign='center';const q=xy({x:370,z:0});cx.save();cx.translate(q.x,q.y);cx.rotate(-Math.PI/2);cx.fillText('CAIRN SOUND',0,0);cx.restore();}
  }
  update(dt) {
    const g=this.g,p=g.player,m=g.missions;this.clock+=dt;this.hitTime=Math.max(0,this.hitTime-dt);
    $('damage').style.opacity=g.settings.reduced?0:g.combat.damageFlash*.6;
    const aim=$('reticle');aim.style.display=g.combat.weapon!=='fists'&&!g.menu?'block':'none';aim.style.left=g.input.mouse.x+'px';aim.style.top=g.input.mouse.y+'px';aim.style.borderColor=this.hitTime?'#ffcd59':'#ffffffaa';
    if(this.clock<.1)return;this.clock=0;
    $('hud').hidden=!g.started;$('money').textContent=money(g.save.money);$('heat').innerHTML=Array.from({length:5},(_,i)=>`<span class="${i<g.police.level?'':'off'}">★</span>`).join('');$('heat').setAttribute('aria-label',g.police.level+' of 5 wanted tiers');
    $('pursuit').textContent=p.arrest>0?'ARREST '+Math.ceil((3-p.arrest)*10)/10+'s':g.police.level?g.police.state:'COAST CLEAR';$('pursuit').style.background=g.police.seen?'#a14f3f':'#102c31';$('rep').textContent=g.rankName()+' / '+g.save.rep+' STANDING';
    $('dispatch').hidden=!g.police.level;$('unit-count').textContent=g.police.units.filter(c=>!c.destroyed).length+(g.police.heli.group.visible?' + AIR':'')+' UNITS';
    $('units').innerHTML=g.police.units.filter(c=>!c.destroyed&&c!==p.car).sort((a,b)=>dist(a,p)-dist(b,p)).slice(0,4).map(c=>`<div><b>${c.unitName}</b><span>${c.task} • ${Math.round(dist(c,p))}m</span></div>`).join('')+(g.police.heli.group.visible?'<div><b>AIR • HARRIER</b><span>SEARCHLIGHT</span></div>':'');
    $('search-fill').style.width=((g.police.searchProgress||0)*100)+'%';$('search-label').textContent=g.police.seen?'Break line of sight to begin the search timer.':g.police.state==='COOLING'?'Search fading. Stay unseen.':'Searching the last known block.';
    let title='The coast is yours.',objective=g.save.chapter===5?'Find a street sprint, run deliveries, or explore the coast.':'Call Inez from the map for your next job.',chapter=g.save.chapter===5?'STORY COMPLETE':'FREE ROAM',stages=0,index=0,tail='M • map & crew journal';
    if(m.active){title=m.job.title;objective=m.failed?'Job interrupted. Open the map to retry.':m.stage.text;chapter='JOB '+(m.index+1)+' / 5 • '+m.job.contact.split(' • ')[0];stages=m.job.stages.length;index=m.stageIndex+1;tail=m.job.time?timer(m.job.time-m.elapsed)+' REMAINING':'STAGE '+index+' / '+stages;if(m.stage.kind==='guards')tail=this.g.missions.guards.filter(x=>x.hp<=0).length+' / 3 GUARDS';if(m.stage.kind==='hack'&&m.progress>0)tail='UPLOADING '+Math.round(m.progress/3*100)+'%';}
    if(g.activities.active){title=g.activities.active==='race'?'Strand sprint':'After hours';objective=g.activities.active==='race'?'Reach the next road checkpoint.':'Deliver the parcel. Press F at the marker.';chapter='SIDE JOB • '+timer(g.activities.limit-g.activities.elapsed);stages=g.activities.active==='race'?4:3;index=g.activities.index+1;tail='STOP '+index+' / '+stages;}
    $('job-title').textContent=title;$('chapter').textContent=chapter;$('objective').textContent=objective;$('stage-track').innerHTML=Array.from({length:stages},(_,i)=>'<i class="'+(i<index?'done':'')+'"></i>').join('');$('stage-label').textContent=tail;
    const target=g.activeTarget();$('distance').textContent=target?Math.round(dist(p,target))+' m':'';
    $('health-bar').style.width=p.hp+'%';$('armor-bar').style.width=p.armor+'%';$('health-value').textContent=Math.ceil(p.hp);$('armor-value').textContent=Math.ceil(p.armor);$('district').textContent=district(p);$('road').textContent=street(p);
    $('radio').textContent=g.audio.radio?'RADIO TERN 92.4 • Original instrumental / Salt Circuit':'RADIO OFF • V to tune in';
    const w=WEAPONS[g.combat.weapon];$('weapon').textContent=g.combat.reload?'RELOADING…':w.name+(g.combat.weapon==='fists'?' • CLOSE COMBAT':' • '+g.combat.mag[g.combat.weapon]+' / '+g.combat.ammo[g.combat.weapon]);
    $('car-name').textContent=p.car?p.car.config.name:'ROWAN VALE';$('speed').innerHTML=p.car?Math.round(Math.abs(p.car.speed)*3.6)+'<small>KM/H</small>':'';$('condition').textContent=p.car?'CONDITION '+Math.ceil(p.car.health/p.car.maxHealth*100)+'%'+(p.car.stolen?' • STOLEN':''):g.combat.weapon==='fists'?'ON FOOT • SHIFT TO SPRINT':'ON FOOT • CURSOR TO AIM';
    const context=g.context();$('context').hidden=!context;$('context').innerHTML=context;this.drawMap(this.map);
  }
}
