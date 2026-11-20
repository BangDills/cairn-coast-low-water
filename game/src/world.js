import { T, StaticBatch, geometries, textSign, namedMaterial } from './models.js';
import { ROADS_X, ROADS_Z, seeded, clamp, segmentBox, dist, roadRoute } from './math.js';

export const PLACES = {
  contact: { x:286, z:18, name:'Inez • ferry market', icon:'I' },
  garage: { x:185, z:72, name:'Tern Motors', icon:'G' },
  home: { x:286, z:135, name:'Room 9 • safehouse', icon:'H' },
  clinic: { x:315, z:80, name:'Strand clinic', icon:'+' },
  arms: { x:15, z:-76, name:'Foundry supply', icon:'A' },
  race: { x:307, z:66, name:'Strand sprint', icon:'R' },
  delivery: { x:215, z:174, name:'After-hours delivery', icon:'D' },
};
const COLORS = ['#e3bda0','#c8826b','#e4cfad','#86ada9','#cfaf8b','#f0d9b4'];
export class CityWorld {
  constructor(scene) {
    this.scene = scene; this.colliders = []; this.buildings = []; this.signals = [];
    this.random = seeded(86291); this.batch = new StaticBatch(scene);this.facades=new Map();
    this.createCoast(); this.createRoads(); this.createBlocks(); this.createPort(); this.createLandmarks(); this.createStreetLife(); this.batch.finish();
    this.mapRoute = [];
    this.caches = [
      [315,-280], [285,-125], [215,-260], [115,-138], [85,102], [-15,80], [-115,15], [-215,-137], [-315,210], [-130,284], [150,317], [320,215],
    ].map(([x,z],i)=>({x,z,id:i,collected:false}));
  }
  box(color,x,y,z,w,h,d,ry=0) { this.batch.add('box',color,x,y,z,w,h,d,0,ry); }
  cylinder(color,x,y,z,w,h,d,rx=0,ry=0,rz=0) { this.batch.add('cylinder',color,x,y,z,w,h,d,rx,ry,rz); }
  solid(x,z,w,d,height=12) { this.colliders.push({x,z,w,d,h:height}); }
  createCoast() {
    this.box('#abbaa0',-25,-.55,0,850,1,820);
    this.box('#cbbf9f',350,-.38,0,100,.6,800);
    this.box('#f1dab1',374,-.11,0,62,.3,780);
    this.box('#e4ddc9',328,.08,0,26,.25,750);
    this.box('#b8ac92',341,.15,0,1,.45,750);
    this.box('#e4ddc9',340,.4,0,.55,.55,750);
    this.box('#c6b494',329,.28,0,.22,.15,750);
    const waterGeo = new T.PlaneGeometry(5000,5000,80,80); waterGeo.rotateX(-Math.PI/2);
    this.water = new T.Mesh(waterGeo,new T.ShaderMaterial({
      uniforms:{ time:{value:0}, fogColor:{value:new T.Color('#c4d4ca')} },
      vertexShader:'uniform float time; varying vec3 vP; void main(){ vec3 p=position; p.y+=sin(p.x*.04+time*.8)*.16+cos(p.z*.06+time*.6)*.12; vP=(modelMatrix*vec4(p,1.)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }',
      fragmentShader:'uniform float time; varying vec3 vP; void main(){float a=sin(vP.x*.17+vP.z*.11+time)*sin(vP.z*.43-time*.5); float s=pow(max(0.,a),18.); vec3 col=mix(vec3(.13,.40,.44),vec3(.35,.65,.62),.5+.1*a)+vec3(.62,.44,.18)*s*.5; float d=clamp((length(vP.xz-vec2(350.,0.))-250.)/1800.,0.,1.); col=mix(col,vec3(.73,.79,.73),d); gl_FragColor=vec4(col,1.); }',
    })); this.water.position.set(2895,-.32,0); this.scene.add(this.water);
    for(let i=0;i<34;i++) {
      const z=-350+i*22;
      this.box('#fff0d1',398,.02,z,1.1,.025,12+(i%4)*2,.04);
      if(i%2===0) { this.palm(332,z,8.5+this.random()*3); this.bench(323,z+7,Math.PI/2); }
      if(i%3===0) this.umbrella(366,z+5,['#bc7456','#537c78','#dccb96'][i%3]);
    }
    for(let i=0;i<20;i++) {
      const x=-700+this.random()*1200,z=-650-this.random()*180;
      this.batch.add('sphere','#91a699',x,12,z,100+this.random()*150,60+this.random()*110,120);
    }
    for(const z of [-250,130,270]) {
      this.box('#e2d5ae',418,1.6,z,22,1,7);
      this.box('#b2805f',418,1,z,24,.8,8);
      for(const x of [411,425]) this.cylinder('#c4b792',x,-.2,z,1.2,4,1.2);
      this.box('#f1dcb5',418,4,z,7,3,4);
      this.box('#506b65',418,6,z,8,.3,5);
    }
  }
  createRoads() {
    for(const x of ROADS_X) {
      this.box('#e4ddc9',x,.01,0,31,.18,740);
      this.box('#555b5b',x,.12,0,21,.13,740);
      for(const s of [-1,1]) this.box('#f9eed4',x+s*9.55,.2,0,.12,.015,740);
      for(let z=-365;z<370;z+=9) {
        if(ROADS_Z.some(r=>Math.abs(r-z)<15))continue;
        this.box('#ddc377',x-.16,.21,z,.1,.015,5.7);this.box('#ddc377',x+.16,.21,z,.1,.015,5.7);
        for(const s of [-1,1])this.box('#f9eed4',x+s*5,.21,z,.1,.015,3.6);
      }
    }
    for(const z of ROADS_Z) {
      this.box('#e4ddc9',0,.04,z,660,.2,31);
      this.box('#555b5b',0,.14,z,660,.13,21);
      for(let x=-325;x<330;x+=9) {
        if(ROADS_X.some(r=>Math.abs(r-x)<15))continue;
        for(const s of [-1,1]) { this.box('#ddc377',x,.23,z+s*.15,5.7,.015,.1); this.box('#f9eed4',x,.23,z+s*5,3.6,.015,.1); }
      }
    }
    for(const x of ROADS_X)for(const z of ROADS_Z) {
      this.box('#555b5b',x,.23,z,22,.03,22);
      for(const s of [-1,1])for(let d=-8;d<=8;d+=2.5) {
        this.box('#f9eed4',x+d,.26,z+s*12.3,1.3,.02,3.8);
        this.box('#f9eed4',x+s*12.3,.26,z+d,3.8,.02,1.3);
      }
      if((x+z)%3===0 || x===300) {
        this.cylinder('#4c6260',x+12,3.6,z+12,.17,7,.17);
        this.box('#4c6260',x+6,7,z+12,12,.13,.13);
        this.box('#243b3c',x,6.6,z+12,.5,1.3,.38);
        this.cylinder('#c77750',x,6.92,z+12.23,.18,.035,.18,Math.PI/2);
        this.cylinder('#b4bd80',x,6.35,z+12.23,.18,.035,.18,Math.PI/2);
      }
    }
  }
  createBlocks() {
    for(let ix=0;ix<6;ix++)for(let iz=0;iz<5;iz++) {
      const x0=ROADS_X[ix],z0=ROADS_Z[iz];
      if(iz===4 && ix>=3)continue;
      if(ix===3&&iz===2){this.createPark(50,0);continue;}
      for(let a=0;a<2;a++)for(let b=0;b<2;b++) {
        const x=x0+27+a*46,z=z0+30+b*60;
        if(x>140&&x<190&&z>65&&z<120)continue;
        const w=20+this.random()*4,d=26+this.random()*4;
        let h=9+Math.floor(this.random()*5)*3.5;
        const modern=x>-180&&x<80&&z<130;
        if(modern)h=22+Math.floor(this.random()*13)*3.5;
        if(x>220)h=15+Math.floor(this.random()*5)*3.4;
        const color=COLORS[Math.floor(this.random()*COLORS.length)];
        this.building(x,z,w,d,h,color,modern);
      }
      for(const z of [z0+23,z0+62,z0+98])for(const x of [x0+15,x0+85])this.palm(x,z,8+this.random()*4);
      for(const x of [x0+22,x0+65])this.lamp(x,z0+14,Math.PI);
      if(this.random()>.5)this.bench(x0+54,z0+14,Math.PI);
    }
    this.building(164,99,42,36,10,'#73978e',false);
    this.box('#1d4045',174,3,80.8,17,5.3,.2);
    for(let i=0;i<7;i++)this.box('#426561',174,1.2+i*.65,80.65,16,.08,.06);
    textSign(this.scene,'TERN MOTORS',165,8,80.5,31,2.8,Math.PI,'#17474b','#ffdb83');
    this.box('#f0d9b4',317,2.5,90,6,5,10);textSign(this.scene,'CLINIC +',317,4,84.8,5.7,1.4,Math.PI);
    textSign(this.scene,'ROOM 9',284,5,137,7,2,Math.PI/2);
    textSign(this.scene,'FOUNDRY SUPPLY',17,4,-86,10,1.6,Math.PI/2);
    textSign(this.scene,'FERRY MARKET',281,6,8,19,2.6,Math.PI/2,'#b97051','#fff0d6');
    for(const [text,x,z] of [['SALT & SODA',281,-99],['CAIRN CINEMA',-19,-97],['NORTHLINE HOTEL',281,-245],['THE TERN',181,-20],['OLD QUARTER',-280,-145]]) {
      textSign(this.scene,text,x,6,z,16,2.4,Math.PI/2);
    }
    for(let i=0;i<6;i++){
      const x=276,z=-19+i*5;
      this.box('#c18561',x,.85,z,4,1.7,3);
      this.box(i%2?'#efdcb4':'#538f8b',x,3,z,5,.2,4);
      for(const dx of [-2,2])this.cylinder('#756248',x+dx,1.6,z,.09,3.2,.09);
      for(let j=0;j<4;j++)this.batch.add('sphere',j%2?'#d4b853':'#c4774f',x-1.3+j*.8,1.9,z,.62,.62,.62);
    }
  }
  building(x,z,w,d,h,color,modern) {
    this.buildings.push({x,z,w,d,h,color});this.solid(x,z,w,d,h);
    this.box(color,x,h/2+.23,z,w,h,d);
    this.box('#d9c7a6',x,.9,z,w+.5,1.5,d+.5);
    this.box('#e7dac0',x,h+.3,z,w+1,.5,d+1);
    this.box('#b4ab95',x,h+.6,z,w-.7,.24,d-.7);
    const floors=Math.max(1,Math.floor((h-3)/3.5)),cols=Math.max(2,Math.floor(w/5)),rows=Math.max(3,Math.floor(d/5));
    const front=this.facadeTexture(color,modern,cols,floors),side=this.facadeTexture(color,modern,rows,floors);
    for(const s of [-1,1]){
      this.batch.add('panel',front,x,(h+3)/2,z+s*(d/2+.035),w-.3,h-3,1,0,s>0?0:Math.PI);
      this.batch.add('panel',side,x+s*(w/2+.035),(h+3)/2,z,d-.3,h-3,1,0,s*Math.PI/2);
    }
    for(let f=1;f<Math.min(4,floors);f++){
      const y=3.5+f*3.5;
      if(!modern)for(const s of [-1,1]){
        this.box('#e8d9b9',x+s*(w/2+.7),y-.9,z,1.5,.18,d*.76);
        this.box('#91a9a0',x+s*(w/2+1.35),y-.4,z,.08,.9,d*.76);
      }
    }
    if(modern)for(let f=3;f<floors;f+=4)this.box('#e7d3b1',x,3.3+f*3.5,z,w+.3,.18,d+.3);
    for(const s of [-1,1])for(let j=-1;j<=1;j++) {
      this.box('#284d54',x+j*w*.27,1.9,z+s*(d/2+.06),w*.19,2.6,.12);
      this.box('#386365',x+s*(w/2+.06),1.9,z+j*d*.27,.12,2.6,d*.19);
    }
    if(!modern) {
      for(const s of [-1,1]) {
        this.box('#537e76',x,3.4,z+s*(d/2+.7),w*.9,.22,1.7);
        for(let c=0;c<Math.floor(w/2);c++)if(c%2===0)this.box('#f0d9b4',x-w*.45+c*2,3.52,z+s*(d/2+.7),.95,.03,1.7);
      }
    } else {
      this.box('#496965',x,h+1.5,z,w*.25,2,d*.24);
      if(h>48)this.cylinder('#acb6a2',x,h+5,z,.2,10,.2);
    }
  }
  facadeTexture(color,modern,cols,floors){
    const key='facade:'+color+':'+modern+':'+cols+':'+floors;if(this.facades.has(key))return key;
    const c=document.createElement('canvas');c.width=cols*64;c.height=floors*64;const cx=c.getContext('2d');cx.fillStyle=color;cx.fillRect(0,0,c.width,c.height);
    for(let y=0;y<floors;y++)for(let x=0;x<cols;x++){
      const xx=x*64,yy=y*64;cx.fillStyle=modern?'#315966':'#315757';cx.fillRect(xx+12,yy+9,40,43);
      const grad=cx.createLinearGradient(xx,yy,xx+64,yy+64);grad.addColorStop(0,modern?'#6d9196':'#5e8580');grad.addColorStop(1,'#22484f');cx.fillStyle=grad;cx.fillRect(xx+15,yy+11,34,36);
      cx.fillStyle='#c8c7ad';cx.fillRect(xx+31,yy+10,2,39);cx.fillRect(xx+13,yy+28,38,2);
      cx.fillStyle='#e7d6b5';cx.fillRect(xx+9,yy+50,46,3);cx.fillStyle='#5f746c';cx.fillRect(xx+10,yy+53,44,4);
      if(!modern){cx.fillStyle='#728878';cx.fillRect(xx+6,yy+10,4,36);cx.fillRect(xx+54,yy+10,4,36);}
    }
    const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=2;
    namedMaterial(key,new T.MeshLambertMaterial({map:texture}));this.facades.set(key,true);return key;
  }
  createPark(x,z) {
    this.box('#8f9f79',x,.12,z,67,.2,83);
    this.box('#e0d1ae',x,.24,z,8,.1,83);this.box('#e0d1ae',x,.24,z,67,.1,7);
    this.cylinder('#e7d7b9',x,.6,z,14,.8,14);
    this.cylinder('#5b9994',x,1,z,11,.1,11);
    this.cylinder('#d3c3a0',x,2,z,1.4,3,1.4);
    this.batch.add('sphere','#c4d9c2',x,3.5,z,2,2,2);
    for(const dx of [-22,22])for(const dz of [-30,0,30]){this.palm(x+dx,z+dz,11);this.bench(x+dx+4,z+dz,Math.PI/2);}
  }
  createPort() {
    this.box('#9caa9f',148,.11,253,280,.19,84);
    for(let x=18;x<286;x+=24)this.box('#8d9a92',x,.215,253,.045,.012,82);
    for(let z=214;z<294;z+=20)this.box('#8d9a92',148,.215,z,278,.012,.045);
    for(const x of [225,251,277])for(const z of [230,279]){
      for(const side of [-1,1]){
        this.box('#e6c66d',x+side*11,.233,z,.16,.014,12);
        this.box('#e6c66d',x,.233,z+side*6,22,.014,.16);
      }
      for(let i=0;i<6;i++)this.box('#e6c66d',x-8+i*3,.235,z+4.5,.4,.018,2.5,.55);
    }
    for(let i=0;i<19;i++) {
      const x=30+(i%6)*43+(i%6===4?14:0),z=216+Math.floor(i/6)*25;
      if(x>220&&z>240)continue;
      const color=['#b96e50','#567a79','#d0a862'][i%3];
      const n=i%4===0?2:1;
      for(let j=0;j<n;j++) {
        this.box(color,x,1.7+j*3,z,11,3,5.7);
        for(let k=0;k<12;k++)this.box('#a0a18c',x-5+k*.9,1.7+j*3,z+2.9,.06,2.75,.06);
      }
      this.solid(x,z,11,5.7,n*3);
    }
    this.building(-62,252,48,62,13,'#a7b1a0',true);
    textSign(this.scene,'CAIRN PORT AUTHORITY',-62,10,284,44,3.2);
    for(const z of [230,320]) {
      for(const x of [318,342])this.box('#caa86c',x,14,z,1.7,28,1.7);
      this.box('#caa86c',330,29,z,46,1.6,1.6);this.box('#caa86c',330,22,z,30,1.1,1.1);
      for(let i=0;i<6;i++)this.box('#b08d53',310+i*7,25.5,z,.5,8.5,.5,-.65);
      this.box('#e1bc78',354,27,z,7,5,4);
      this.cylinder('#5b6a63',362,15,z,.12,27,.12);
      this.box('#384e4a',362,2,z,3,.6,2);
    }
    for(let i=0;i<9;i++) {
      const z=203+i*17;
      this.cylinder('#e0c89c',310,1,z,.6,1.8,.6);
      this.box('#a1b8a5',309,2.6,z,.15,1.2,13);
    }
    this.box('#c3b392',361,.13,302,46,.22,25);
    for(let x=343;x<383;x+=4)this.box('#9c8c6d',x,.26,302,.07,.03,25);
  }
  createLandmarks() {
    this.cylinder('#e4cfad',322,8,-70,8,16,8);
    this.cylinder('#e9d5ae',322,17,-70,10,2,10);
    this.batch.add('cone','#6d9691',322,20.5,-70,13,7,13);
    const clock=new T.Group();
    const face=new T.Mesh(new T.CircleGeometry(2.2,32),new T.MeshBasicMaterial({color:'#fff0cf'}));face.position.set(322,14,-65.95);clock.add(face);
    this.scene.add(clock);this.box('#294a4e',322.5,14.7,-65.85,.13,1.7,.06,.5);this.box('#294a4e',321.4,14,-65.85,1.5,.13,.06);
    textSign(this.scene,'CAIRN FERRY',322,7,-65.9,7,1.3);
    for(let i=0;i<16;i++)this.cylinder('#e4cfad',320+i*4,1.2,-76,.18,2.4,.18);
    for(let i=0;i<4;i++) {
      const x=-24+i*16;
      this.box('#dac7a5',x,4,-340,1,8,1);this.box('#dac7a5',x,9,-340,17,.8,1);
    }
    textSign(this.scene,'CAIRN COAST',0,10,-339.4,60,4);
    for(const z of [-340,342])for(const x of [-340,340])this.palm(x,z,15);
  }
  createStreetLife() {
    for(const x of ROADS_X)for(let z=-338;z<350;z+=39) {
      if(ROADS_Z.some(a=>Math.abs(a-z)<16))continue;
      if(x!==300||z%2===0)this.lamp(x+13,z,Math.PI/2);
      if(x===300)this.palm(x-14,z+6,10+this.random()*3);
      if((z+x)%4===0){this.box('#6f847c',x+13,1,z+5,.7,1.8,.7);this.box('#405b58',x+13,2,z+5,.85,.15,.85);}
    }
    for(const p of Object.values(PLACES)) {
      this.box('#e0c58c',p.x,1,p.z,.4,2,.4);
    }
    this.box('#497d7b',286,1.2,18,1.3,2.4,.6);this.box('#f1ce72',286,1.7,17.65,1,.9,.05);
    for(let i=0;i<11;i++){
      const z=-285+i*48;
      this.bench(326,z,Math.PI/2);
      if(i%2===0){this.box('#c9ba95',325,.5,z+5,1.8,1,1.8);this.batch.add('sphere','#6e8d69',325,1.8,z+5,2.5,2,2.5);}
    }
  }
  palm(x,z,h=10) {
    const lean=(this.random()-.5)*1.2;
    for(let i=0;i<4;i++)this.cylinder('#a08b66',x+lean*i*.28,h*(i+.5)/4,z,.45-i*.035,h/4+.15,.45-i*.035,0,0,-lean*.03);
    if(!geometries.leaf) {
      const g=new T.BufferGeometry(),verts=[];
      const widths=[.04,.27,.34,.24,0],ys=[0,.18,.14,-.06,-.3];
      for(let i=0;i<4;i++){
        const a=[-widths[i],ys[i],i/4],b=[widths[i],ys[i],i/4],c=[-widths[i+1],ys[i+1],(i+1)/4],d=[widths[i+1],ys[i+1],(i+1)/4];
        verts.push(...a,...b,...c,...b,...d,...c,...c,...b,...a,...c,...d,...b);
      }
      g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.computeVertexNormals();geometries.leaf=g;
    }
    for(let i=0;i<8;i++)this.batch.add('leaf',i%2?'#59805c':'#75916a',x+lean,h,z,3.4,4,5+this.random()*2,0,i*Math.PI/4+lean);
    this.batch.add('sphere','#739069',x+lean,h,z,1.1,1.6,1.1);
  }
  lamp(x,z,ry=0) {
    this.cylinder('#536562',x,3.8,z,.14,7.6,.14);
    this.box('#536562',x+Math.cos(ry)*1.1,7.7,z+Math.sin(ry)*1.1,2.5,.15,.15,ry);
    this.box('#efdfaf',x+Math.cos(ry)*2,7.58,z+Math.sin(ry)*2,.9,.13,.4,ry);
  }
  bench(x,z,ry=0) {
    this.box('#997c59',x,.63,z,2.7,.15,.7,ry);
    this.box('#a88a65',x,1,z+.28,2.7,.6,.1,ry);
    for(const s of [-1,1])this.box('#49635e',x+s*.95,.34,z,.12,.6,.5,ry);
  }
  umbrella(x,z,color) {
    this.cylinder('#ad9877',x,1.6,z,.08,3.2,.08);
    this.batch.add('cone',color,x,3.2,z,5,1.2,5);
    this.box('#c5a87d',x,0,z+3,2,.3,4);
  }
  blocked(p,r=.6) {
    if(p.x<-342+r||p.x>390-r||p.z<-351+r||p.z>351-r)return true;
    return this.colliders.some(b=>Math.abs(p.x-b.x)<b.w/2+r&&Math.abs(p.z-b.z)<b.d/2+r);
  }
  move(p,dx,dz,r=.6) {
    let hit=false;
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.75));
    for(let i=0;i<steps;i++){
      const nx=clamp(p.x+dx/steps,-341+r,389-r),nz=clamp(p.z+dz/steps,-350+r,350-r);
      if(!this.blocked({x:nx,z:p.z},r))p.x=nx;else hit=true;
      if(!this.blocked({x:p.x,z:nz},r))p.z=nz;else hit=true;
    }
    return hit;
  }
  visible(a,b) { return !this.colliders.some(box=>segmentBox(a,b,box,.05)); }
  route(a,b) { return roadRoute(a,b); }
  update(dt) { this.water.material.uniforms.time.value+=dt; }
  nearestPlace(p,max=6) {
    return Object.entries(PLACES).map(([id,place])=>({id,...place,distance:dist(p,place)})).filter(x=>x.distance<max).sort((a,b)=>a.distance-b.distance)[0];
  }
}
