import { dist } from './math.js';
import { PLACES } from './world.js';
export const STORY = [
  { title:'Salt money', contact:'INEZ • ferry steward', reward:650, rep:100,
    brief:'Aster Port is buying our blocks with stolen relief money. My father kept a second ledger. Get his envelope from the market and take it to Sora at Tern Motors. Take the copper Kestrel if you need a quiet ride.',
    stages:[
      {kind:'pickup',text:'Collect Inez’s envelope on foot.',target:{x:286,z:-27},hint:'Leave your car. Press F beside the yellow marker.'},
      {kind:'vehicle',text:'Find a ride to Tern Motors.',target:{x:294,z:17},hint:'E enters a nearby vehicle. The copper Kestrel is yours.'},
      {kind:'deliver',text:'Deliver the envelope to Tern Motors.',target:PLACES.garage,hint:'Park at the marker. Clear any wanted level, then press F.',car:true},
    ], outro:'Sora found a shipping number in the envelope. The van carrying the next ledger is parked off Radio Avenue.' },
  { title:'Borrowed steel', contact:'SORA • mechanic', reward:1000,rep:180,
    brief:'That green Tideline belongs to the port auditors. Take it off Radio Avenue. Their tracker will alert Coast Patrol. Lose them before you bring the van to my shutter. Keep the van in one piece.',
    stages:[
      {kind:'steal',text:'Steal the green auditor van.',target:{x:113,z:-167},tag:'borrowed',hint:'Go to the yellow van marker and press E.'},
      {kind:'escape',text:'Lose the patrol. Keep the auditor van.',hint:'Break sightlines. Turn behind buildings, then wait out the search.',tag:'borrowed'},
      {kind:'deliver',text:'Return the auditor van to Tern Motors.',target:PLACES.garage,car:true,tag:'borrowed',hint:'Press F at the garage with no wanted level.'},
    ],outro:'The van’s ledger points to refrigerated cargo at Low Water. Sora left you a Kite 9. The security crew will not hand the manifest over.' },
  { title:'The cold ledger', contact:'INEZ • ferry steward',reward:1600,rep:250,
    brief:'Three port guards are holding the manifest in the container yard. Fire from your car for protection, then get out and take the case back to me. Their fire can damage your ride; keep a fresh getaway nearby. I want the ledger, not a funeral.',
    stages:[
      {kind:'travel',text:'Reach the Low Water container yard.',target:{x:238,z:253},radius:24,hint:'Drive south. The yard opens off Dock Road.'},
      {kind:'guards',text:'Neutralize the three port guards.',target:{x:238,z:253},hint:'2 equips your pistol. Aim with the cursor and click. R reloads.'},
      {kind:'pickup',text:'Take the manifest from the cargo case.',target:{x:238,z:253},hint:'On foot, press F next to the cargo case.'},
      {kind:'escape',text:'Break the patrol search with the manifest.',hint:'A fast car and two inland turns will help.'},
      {kind:'deliver',text:'Return the manifest to Inez.',target:PLACES.contact,foot:true,hint:'Leave your vehicle and press F by the ferry market.'},
    ],outro:'The cargo was never relief aid. It was surveillance equipment. Inez has the relay codes; shut those relays down before Aster seals the evidence.' },
  { title:'Dead air',contact:'SORA • mechanic',reward:2100,rep:300,time:210,
    brief:'Three street relays feed Aster’s private port network. Stop beside each box, get out, and hold F to upload the code. Every upload brings more patrols. Finish before the backup link comes online.',
    stages:[
      {kind:'hack',text:'Disable the Foundry relay.',target:{x:-115,z:-167},hint:'On foot: hold F at the relay for 3 seconds.'},
      {kind:'hack',text:'Disable the North Heights relay.',target:{x:85,z:-287},hint:'On foot: hold F at the relay for 3 seconds.'},
      {kind:'hack',text:'Disable the Strand relay.',target:{x:286,z:-167},hint:'On foot: hold F at the relay for 3 seconds.'},
      {kind:'escape',text:'Disappear before the backup link returns.',hint:'Use buildings to break sight. Search progress is in the dispatch panel.'},
    ],outro:'Dead air. Their archive is moving out by truck. Intercept it, bring it to the old quay, and we can release the whole ledger.' },
  {title:'Low water',contact:'INEZ • ferry steward',reward:4000,rep:500,
    brief:'Aster’s armored archive truck is on Dock Road. Ram it or shoot the engine until it stops, then take it. Expect a cordon and air search. Lose them and bring the truck to Low Water Quay. I will meet you there.',
    stages:[
      {kind:'disable',text:'Stop the moving archive truck.',tag:'archive',hint:'Ram or shoot the truck until its engine gives out.'},
      {kind:'steal',text:'Take the disabled archive truck.',tag:'archive',hint:'Press E beside the marked truck. Sora can keep it running.'},
      {kind:'escape',text:'Lose Coast Patrol and the air unit.',tag:'archive',hint:'Fire back from the truck, then turn inland behind buildings. Keep distance from the air unit.'},
      {kind:'deliver',text:'Bring the archive to Low Water Quay.',target:{x:315,z:300},tag:'archive',car:true,hint:'Keep the archive truck. Press F at the quay after the heat clears.'},
      {kind:'pickup',text:'Meet Inez on foot. Release the ledger.',target:{x:329,z:307},hint:'Leave the truck. Press F beside Inez.'},
    ],outro:'The ledger is public. Aster’s buyout is frozen, and the ferry workers own their route again. Cairn Coast is still yours to roam. Sora’s garage has the upgrades you earned.'},
];
export class MissionDirector {
  constructor(g){this.g=g;this.active=false;this.index=0;this.stageIndex=0;this.elapsed=0;this.failed=false;this.progress=0;this.guards=[];this.finishedBanner=0;}
  get job(){return STORY[this.index];}
  get stage(){return this.active?this.job.stages[this.stageIndex]:null;}
  get target(){const s=this.stage;if(!s)return null;if(s.tag&&(s.kind==='steal'||s.kind==='disable'))return this.g.traffic.cars.find(v=>v.missionTag===s.tag);return s.target||null;}
  start(index=this.g.save.chapter) {
    if(index>=STORY.length)return;this.cleanup();if(this.g.player.car?.missionTag)this.g.exitCar?.(true);Object.assign(this,{active:true,index,stageIndex:0,elapsed:0,failed:false,progress:0});
    const g=this.g;
    if(index===1){let v=g.traffic.cars.find(v=>v.missionTag==='borrowed');if(!v||v.destroyed){v=g.traffic.add('van',113,-167,Math.PI/2,'parked','#5f9690');v.missionTag='borrowed';}v.x=113;v.z=-167;v.health=v.maxHealth;v.destroyed=false;v.exploded=false;v.role='parked';v.occupant=null;v.stolen=false;}
    if(index===2){this.guards=g.people.guards([[232,246],[252,253],[227,267]]);g.combat.weapon='pistol';g.combat.ammo.pistol=Math.max(72,g.combat.ammo.pistol);g.combat.mag.pistol=12;}
    if(index===4){for(const old of g.traffic.cars.filter(v=>v.missionTag==='archive'))old.missionTag=null;const v=g.traffic.add('truck',203,267,0,'convoy','#ac885c');v.missionTag='archive';v.occupant='port driver';v.speed=11;g.traffic.wanderNext(v);}
    g.closeMenu();g.speech(this.job.contact,this.job.brief);g.toast('JOB '+(index+1)+' / '+STORY.length+' • '+this.job.title);g.recordEvent('mission-start',{index});
  }
  cleanup(){for(const p of this.guards){this.g.render.scene.remove(p.model.group);p.hp=0;p.role='removed';p.model.group.visible=false;}this.guards=[];for(const p of this.g.people.people.filter(p=>p.role==='removed'))this.g.people.people.splice(this.g.people.people.indexOf(p),1);}
  cancel(){this.active=false;this.failed=false;this.cleanup();}
  fail(reason){if(!this.active||this.failed)return;this.failed=true;this.g.toast('JOB INTERRUPTED • '+reason,7);this.g.speech('SORA • mechanic','We can try that run again. Open the map and choose Retry job.');this.g.recordEvent('mission-failed',{index:this.index,reason});}
  retry(){this.g.police.clear();this.start(this.index);}
  advance() {
    const g=this.g;this.stageIndex++;this.progress=0;g.audio.checkpoint();g.recordEvent('mission-stage',{index:this.index,stage:this.stageIndex});
    if(this.stageIndex>=this.job.stages.length){this.complete();return;}
    const s=this.stage;
    if(this.index===1&&s.kind==='escape'){g.police.crime(.95,'Auditor tracker activated');g.speech('SORA • mechanic','Tracker just woke up. Take a side street before they box you in.');}
    if(this.index===4&&s.kind==='steal'){const v=g.traffic.cars.find(v=>v.missionTag==='archive');v.speed=0;v.role='parked';v.occupant=null;v.health=Math.max(70,v.health);g.combat.cooldown=Math.max(g.combat.cooldown||0,.85);g.police.crime(3.5,'Archive convoy intercepted');}
    if(this.index===4&&s.kind==='escape'){const v=g.player.car;v.health=Math.max(v.health,v.maxHealth*.78);g.speech('SORA • mechanic','Cutoff bypassed. The cargo armor is intact. You have power again. Get moving.');}
    if(this.index===4&&this.stageIndex===4){g.people.contact.x=329;g.people.contact.z=307;}
    g.toast('OBJECTIVE UPDATED • '+s.text,4);
  }
  complete() {
    const g=this.g,job=this.job;this.active=false;this.finishedBanner=7;g.save.chapter=Math.max(g.save.chapter,this.index+1);g.save.money+=job.reward;g.save.rep+=job.rep;g.save.stats.jobs++;g.saveProgress();g.audio.success();g.toast('JOB COMPLETE • '+job.title+' • +$'+job.reward.toLocaleString(),7);g.speech(job.contact,job.outro,12);this.cleanup();g.recordEvent('mission-complete',{index:this.index,reward:job.reward});
    if(this.index===4){g.save.completed=true;g.people.contact.x=286;g.people.contact.z=18;g.saveProgress();}
  }
  canInteract() {
    const s=this.stage,t=this.target,g=this.g;if(!s||!t||this.failed||dist(g.player,t)>6)return false;
    return ['pickup','deliver','hack'].includes(s.kind);
  }
  interact() {
    const g=this.g,s=this.stage;if(!this.canInteract())return false;
    if((s.kind==='pickup'||s.kind==='hack'||s.foot)&&g.player.car){g.toast('Leave your vehicle first (E).');return true;}
    if(s.car&&!g.player.car){g.toast('Bring a vehicle into the marker.');return true;}
    if(s.tag&&g.player.car?.missionTag!==s.tag){g.toast('Bring the marked job vehicle.');return true;}
    if(s.kind==='deliver'&&g.police.level){g.toast('Lose the patrol before the handover.');return true;}
    if(s.kind==='hack'){g.toast('Hold F for 3 seconds.');return true;}
    g.audio.pickup();this.advance();return true;
  }
  update(dt) {
    if(!this.active||this.failed)return;const g=this.g,s=this.stage;this.elapsed+=dt;
    if(this.job.time&&this.elapsed>this.job.time){this.fail('The backup network came online.');return;}
    if(s.kind==='vehicle'&&g.player.car)this.advance();
    else if(s.kind==='travel'&&dist(g.player,this.target)<s.radius)this.advance();
    else if(s.kind==='steal'&&g.player.car?.missionTag===s.tag)this.advance();
    else if(s.kind==='disable') {
      const v=this.target;if(v&&v.health<v.maxHealth*.4&&!v.destroyed)this.advance();
    } else if(s.kind==='guards'&&this.guards.length&&this.guards.every(p=>p.hp<=0))this.advance();
    else if(s.kind==='escape') {
      if(s.tag&&g.player.car?.missionTag!==s.tag)return;
      if(g.police.level===0&&this.elapsed>1)this.advance();
    } else if(s.kind==='hack') {
      if(!g.player.car&&dist(g.player,this.target)<5&&g.input.down('KeyF')) {
        this.progress+=dt;if(this.progress>=3){g.police.crime(.95,'Port relay disabled');this.advance();}
      }else this.progress=Math.max(0,this.progress-dt*.7);
    }
  }
}
export const RACE_POINTS=[{x:303,z:-180},{x:103,z:-180},{x:103,z:60},{x:303,z:60}];
export class SideActivities {
  constructor(g){this.g=g;this.active=null;this.index=0;this.elapsed=0;this.limit=0;}
  get target(){if(this.active==='race')return RACE_POINTS[this.index];if(this.active==='delivery')return [PLACES.arms,PLACES.clinic,PLACES.garage][this.index];return null;}
  start(kind){const g=this.g;if(g.missions.active){g.toast('Finish or abandon your current story job first.');return;}if(!g.player.car){g.toast('Bring a car to start this activity.');return;}this.active=kind;this.index=0;this.elapsed=0;this.limit=kind==='race'?90:170;g.toast(kind==='race'?'STRAND SPRINT • four checkpoints • 90 seconds':'AFTER HOURS • three drops • 170 seconds');g.closeMenu();}
  interact(){if(this.active==='delivery'&&dist(this.g.player,this.target)<7){this.g.save.money+=150;this.index++;this.g.audio.pickup();if(this.index===3)this.complete();else this.g.toast('Drop delivered • +$150');return true;}return false;}
  complete(){const g=this.g;if(this.active==='race'){const record=!g.save.bestRace||this.elapsed<g.save.bestRace;if(record)g.save.bestRace=Math.round(this.elapsed*100)/100;g.save.money+=400;g.save.rep+=60;g.toast('SPRINT FINISHED • '+this.elapsed.toFixed(1)+'s • +$400'+(record?' • new best':''),7);}else{g.save.money+=300;g.save.rep+=70;g.toast('DELIVERY ROUND COMPLETE • +$300 bonus',6);}g.save.stats.activities++;this.active=null;g.saveProgress();g.audio.success();}
  update(dt){if(!this.active)return;this.elapsed+=dt;if(this.elapsed>this.limit){this.g.toast('Time expired. Try the activity again.');this.active=null;return;}if(this.active==='race'&&this.g.player.car&&dist(this.g.player,this.target)<12){this.index++;this.g.audio.checkpoint();if(this.index===RACE_POINTS.length)this.complete();else this.g.toast('CHECKPOINT '+this.index+' / 4');}}
}
