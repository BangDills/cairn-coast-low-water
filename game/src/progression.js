import { clamp } from './math.js';
export const SAVE_KEY='cairn-coast-low-water-v1';
export function freshSave(){return{version:1,chapter:0,money:400,rep:0,completed:false,x:286,z:28,hp:100,armor:0,bestRace:0,caches:[],upgrades:{grip:false,turbo:false,armor:false,smg:false},ammo:{pistol:72,smg:112},stats:{jobs:0,escapes:0,crimes:0,activities:0,cars:0}};}
export class SaveStore {
  constructor(){this.available=true;this.error='';this.cached=null;try{const raw=localStorage.getItem(SAVE_KEY);if(raw)this.cached=this.validate(JSON.parse(raw));}catch{this.error='The local save could not be read. You can start a new game.';}}
  validate(raw){
    if(!raw||raw.version!==1||!Number.isFinite(raw.money)||!Number.isInteger(raw.chapter))throw Error('Unknown save format');
    const base=freshSave();base.chapter=clamp(raw.chapter,0,5);base.money=clamp(raw.money,0,9999999);base.rep=clamp(Number(raw.rep)||0,0,999999);
    base.x=clamp(Number.isFinite(raw.x)?raw.x:286,-340,386);base.z=clamp(Number.isFinite(raw.z)?raw.z:28,-348,348);base.hp=clamp(Number(raw.hp)||100,1,100);base.armor=clamp(Number(raw.armor)||0,0,100);base.completed=base.chapter>=5;
    for(const k of Object.keys(base.upgrades))base.upgrades[k]=!!raw.upgrades?.[k];
    for(const k of Object.keys(base.stats))base.stats[k]=Math.max(0,Number(raw.stats?.[k])||0);
    for(const k of Object.keys(base.ammo))base.ammo[k]=clamp(Number(raw.ammo?.[k])||0,0,9999);
    base.caches=Array.isArray(raw.caches)?raw.caches.filter(n=>Number.isInteger(n)&&n>=0&&n<12):[];base.bestRace=Math.max(0,Number(raw.bestRace)||0);return base;
  }
  write(g){
    if(g.police.level){g.toast('Saving is unavailable during a pursuit.');return false;}
    const p=g.player;Object.assign(g.save,{x:p.x,z:p.z,hp:p.hp,armor:p.armor,ammo:{...g.combat.ammo}});
    try{localStorage.setItem(SAVE_KEY,JSON.stringify(g.save));this.cached=this.validate(g.save);this.error='';g.recordEvent('saved',{chapter:g.save.chapter});return true;}
    catch{this.available=false;this.error='Browser storage is unavailable. This session still works, but it cannot save.';g.toast(this.error,7);return false;}
  }
  clear(){try{localStorage.removeItem(SAVE_KEY);this.cached=null;}catch{this.error='Could not erase browser storage.';}}
}
export const SHOP_ITEMS={
  garage:[
    {id:'repair',name:'Repair vehicle',desc:'Restore the current vehicle to full condition.',price:90},
    {id:'grip',name:'Road tires',desc:'18% quicker steering response on every vehicle you drive.',price:450,upgrade:true},
    {id:'turbo',name:'Tern engine tune',desc:'20% higher top speed and 16% stronger acceleration.',price:650,upgrade:true},
    {id:'armor',name:'Reinforced chassis',desc:'Reduce wall and vehicle collision damage by 41%.',price:550,upgrade:true},
    {id:'plates',name:'New plates',desc:'Reduce an unseen pursuit by two wanted tiers.',price:350},
  ],
  clinic:[
    {id:'heal',name:'First aid',desc:'Restore health to 100.',price:50},
    {id:'vest',name:'Harbor work vest',desc:'Restore armor to 100.',price:120},
  ],
  arms:[
    {id:'pistolAmmo',name:'Kite 9 ammunition',desc:'48 reserve rounds.',price:80},
    {id:'smg',name:'Tern SMG',desc:'Unlock the automatic weapon. Includes 112 rounds.',price:700,upgrade:true},
    {id:'smgAmmo',name:'SMG ammunition',desc:'84 reserve rounds.',price:120},
  ],
};
export function purchase(g,id) {
  const item=Object.values(SHOP_ITEMS).flat().find(i=>i.id===id);if(!item)return;
  const refuse=message=>{g.ui.shopMessage=message;g.ui.showShop(g.menu);};
  if(g.police.seen&&g.police.level)return refuse('The patrol can see you. Break sight before shopping.');
  if(g.police.level&&id!=='plates')return refuse('The shop is closed while the patrol searches for you.');
  if(g.save.money<item.price)return refuse('You need $'+(item.price-g.save.money)+' more.');
  if(item.upgrade&&g.save.upgrades[id])return refuse('Already fitted.');
  if(id==='repair'&&!g.player.car)return refuse('Bring a vehicle into the garage marker.');
  if(id==='plates'&&(!g.player.car||g.police.level===0))return refuse('New plates need an unseen wanted vehicle.');
  g.save.money-=item.price;
  if(item.upgrade)g.save.upgrades[id]=true;
  if(id==='repair')g.player.car.health=g.player.car.maxHealth;
  if(id==='heal')g.player.hp=100;
  if(id==='vest')g.player.armor=100;
  if(id==='pistolAmmo')g.combat.ammo.pistol+=48;
  if(id==='smgAmmo')g.combat.ammo.smg+=84;
  if(id==='smg'){g.combat.ammo.smg+=112;g.combat.weapon='smg';}
  if(id==='plates'){g.police.score=Math.max(0,g.police.score-2);g.police.unseen+=8;if(g.police.score===0)g.police.clear(g);}
  g.audio.pickup();g.ui.shopMessage=item.name+' purchased.';if(!g.police.level)g.saveProgress();g.recordEvent('purchase',{id,price:item.price});g.ui.showShop(g.menu);
}
