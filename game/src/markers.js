import { T, textSign, part } from './models.js';
import { PLACES } from './world.js';
import { dist } from './math.js';
export class WorldMarkers {
  constructor(g) {
    this.g=g;this.group=new T.Group();g.render.scene.add(this.group);
    const yellow=new T.MeshBasicMaterial({color:'#ffd167'});
    this.ring=new T.Mesh(new T.TorusGeometry(3.7,.09,6,48),yellow);this.ring.rotation.x=-Math.PI/2;this.group.add(this.ring);
    this.pointer=part(this.group,'cone',yellow,0,5,0,1.0,1.7,1.0,Math.PI);
    this.beam=new T.Mesh(new T.CylinderGeometry(3.7,3.7,4.5,32,1,true),new T.MeshBasicMaterial({color:'#ffdc7a',transparent:true,opacity:.055,depthWrite:false,side:T.DoubleSide}));this.beam.position.y=2.5;this.group.add(this.beam);
    this.places=Object.entries(PLACES).map(([id,p])=>{
      const c=document.createElement('canvas');c.width=64;c.height=64;const cx=c.getContext('2d');cx.fillStyle='#153b40';cx.fillRect(2,2,60,60);cx.strokeStyle='#f9e5bd';cx.lineWidth=3;cx.strokeRect(2,2,60,60);cx.fillStyle='#f9e5bd';cx.font='bold 36px Arial';cx.textAlign='center';cx.textBaseline='middle';cx.fillText(p.icon,32,34);
      const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;const sprite=new T.Sprite(new T.SpriteMaterial({map:tex,depthTest:true}));sprite.position.set(p.x,3.8,p.z);sprite.scale.set(1.7,1.7,1);g.render.scene.add(sprite);return{id,sprite,...p};
    });
    this.cacheModels=g.world.caches.map(p=>{
      const group=new T.Group();part(group,'box','#806845',0,.35,0,.8,.65,.55);part(group,'box','#f3d17d',0,.7,0,.9,.08,.65);g.render.scene.add(group);group.position.set(p.x,.3,p.z);return group;
    });
    this.cargo=new T.Group();part(this.cargo,'box','#416761',0,.7,0,1.7,1.4,1.1);part(this.cargo,'box','#e9d49a',0,.8,-.57,.5,.3,.03);this.cargo.position.set(238,.2,253);g.render.scene.add(this.cargo);
    this.envelope=new T.Group();part(this.envelope,'box','#926d4d',0,.65,0,.8,1.3,.7);part(this.envelope,'box','#fff0cf',0,1.36,0,.53,.05,.37);this.envelope.position.set(286,.2,-27);g.render.scene.add(this.envelope);
    this.relays=[[-115,-167],[85,-287],[286,-167]].map(([x,z])=>{const relay=new T.Group();part(relay,'box','#426963',0,.8,0,.8,1.6,.55);part(relay,'box','#f0d18b',0,1.15,.3,.5,.45,.04);part(relay,'cylinder','#d2c19a',0,2,0,.06,1.2,.06);part(relay,'box','#294e54',0,.2,0,1,.25,.75);relay.position.set(x,.2,z);g.render.scene.add(relay);return relay;});
  }
  update() {
    const g=this.g,target=g.activeTarget();this.group.visible=!!target;
    if(target){this.group.position.set(target.x,.33,target.z);this.pointer.position.y=4.6+Math.sin(g.time*2)*.3;this.ring.rotation.z=g.time*.1;}
    for(const p of this.places)p.sprite.visible=dist(p,g.player)<80;
    this.cacheModels.forEach((m,i)=>{m.visible=!g.save.caches.includes(i)&&dist(g.world.caches[i],g.player)<85;});
    this.cargo.visible=g.save.chapter<=2;
    this.envelope.visible=g.save.chapter===0&&(!g.missions.active||g.missions.stageIndex===0);
  }
}
