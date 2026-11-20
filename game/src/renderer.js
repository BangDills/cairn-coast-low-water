import { T } from './models.js';
import { angleDelta, clamp, mix, dist } from './math.js';
export class GameRenderer {
  constructor(canvas) {
    this.canvas=canvas;this.scene=new T.Scene();this.scene.background=new T.Color('#c8d9d4');this.scene.fog=new T.Fog('#c8d9d4',120,590);
    this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1));this.renderer.setSize(innerWidth,innerHeight);
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;this.renderer.shadowMap.autoUpdate=false;this.renderer.shadowMap.needsUpdate=true;
    this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.18;
    this.camera=new T.PerspectiveCamera(61,innerWidth/innerHeight,.15,1800);
    this.scene.add(new T.HemisphereLight('#d3e7ec','#b99570',2.1));
    this.sun=new T.DirectionalLight('#ffdcaa',3.0);this.sun.position.set(-90,140,-50);this.sun.castShadow=true;
    Object.assign(this.sun.shadow.camera,{left:-75,right:75,top:75,bottom:-75,near:10,far:400});this.sun.shadow.mapSize.set(1024,1024);this.sun.shadow.bias=-.0003;this.sun.shadow.normalBias=.06;
    this.scene.add(this.sun,this.sun.target);
    const sky=new T.Mesh(new T.SphereGeometry(1300,32,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{},vertexShader:'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 p;void main(){float h=normalize(p).y;vec3 c=mix(vec3(.89,.79,.65),vec3(.27,.55,.66),smoothstep(-.07,.8,h));float cloud=sin(p.x*.009+sin(p.z*.006))*sin(p.z*.009);c=mix(c,vec3(.95,.88,.74),smoothstep(.48,.85,cloud)*smoothstep(.1,.3,h)*.32);vec3 sun=normalize(vec3(-.8,.3,-.5));float d=dot(normalize(p),sun);c+=vec3(.4,.25,.08)*pow(max(d,0.),50.);c+=vec3(.9,.65,.35)*smoothstep(.9992,.9998,d);gl_FragColor=vec4(c,1.);}'}));this.scene.add(sky);
    this.yaw=0;this.pitch=.35;this.distance=13;this.target=new T.Vector3(286,1,24);this.camera.position.set(286,8,39);this.shake=0;this.lookTime=0;this.ray=new T.Raycaster();this.ground=new T.Plane(new T.Vector3(0,1,0),-1);this.shadowAt={x:9999,z:9999};
    const pixels=new Uint8Array(32*32*4);
    for(let y=0;y<32;y++)for(let x=0;x<32;x++){const i=(y*32+x)*4,d=Math.hypot((x-15.5)/16,(y-15.5)/16);pixels[i]=pixels[i+1]=pixels[i+2]=12;pixels[i+3]=Math.round(Math.max(0,1-d)**1.5*95);}
    const shadowMap=new T.DataTexture(pixels,32,32);shadowMap.needsUpdate=true;shadowMap.magFilter=T.LinearFilter;
    this.contacts=new T.InstancedMesh(new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false}),200);this.contacts.frustumCulled=false;this.contacts.instanceMatrix.setUsage(T.DynamicDrawUsage);this.contactTransform=new T.Object3D();this.scene.add(this.contacts);
    window.addEventListener('resize',()=>this.resize());
  }
  resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);}
  quality(level){
    this.level=level;this.renderer.setPixelRatio(level==='eco'?.65:Math.min(devicePixelRatio,1));this.renderer.shadowMap.enabled=level!=='eco';this.renderer.shadowMap.needsUpdate=true;
    this.scene.traverse(o=>{if(o.isMesh){for(const m of Array.isArray(o.material)?o.material:[o.material])m.needsUpdate=true;}});this.resize();
  }
  update(dt,g) {
    const p=g.player;
    if(g.input.dragging){this.yaw-=g.input.dragX*.005;this.pitch=clamp(this.pitch+g.input.dragY*.003,.1,.9);this.lookTime=2.0;}
    if(g.input.mouse.fire&&g.combat.weapon!=='fists')this.lookTime=Math.max(this.lookTime,2);
    this.lookTime=Math.max(0,this.lookTime-dt);
    if(p.car&&this.lookTime===0)this.yaw+=angleDelta(this.yaw,p.car.a)*Math.min(1,dt*2.7);
    if(g.input.down('ArrowLeft')){this.yaw-=dt*1.4;this.lookTime=2;}
    if(g.input.down('ArrowRight')){this.yaw+=dt*1.4;this.lookTime=2;}
    const velocity=p.car?Math.abs(p.car.speed):0;
    this.distance=mix(this.distance,p.car?12.2+velocity*.07:8.0,1-Math.exp(-dt*3));
    const height=p.car?5.8+velocity*.025:4.3;
    const center=new T.Vector3(p.x,1.3,p.z);
    this.target.lerp(center,1-Math.exp(-dt*9));
    const back=new T.Vector3(-Math.sin(this.yaw)*this.distance,height+this.pitch*3,Math.cos(this.yaw)*this.distance);
    let desired=this.target.clone().add(back);
    for(let t=1;t>.23;t-=.1) {
      const point=this.target.clone().lerp(desired,t);
      const blocker=g.world.colliders.some(b=>b.h>point.y&&Math.abs(point.x-b.x)<b.w/2+.4&&Math.abs(point.z-b.z)<b.d/2+.4);
      if(blocker)desired=this.target.clone().lerp(desired,Math.max(.22,t-.12));
    }
    this.camera.position.lerp(desired,1-Math.exp(-dt*9));
    if(!g.settings.reduced&&this.shake>.01){this.camera.position.x+=(Math.random()-.5)*this.shake;this.camera.position.y+=(Math.random()-.5)*this.shake;}
    this.shake*=Math.exp(-dt*9);
    this.camera.lookAt(this.target.x+Math.sin(this.yaw)*2,3+(0.35-this.pitch)*16,this.target.z-Math.cos(this.yaw)*2);
    this.camera.fov=mix(this.camera.fov,61+velocity*.12,1-Math.exp(-dt*2));this.camera.updateProjectionMatrix();
    if(dist(p,this.shadowAt)>8){this.shadowAt={x:p.x,z:p.z};this.sun.position.set(p.x-90,140,p.z-50);this.sun.target.position.set(p.x,0,p.z);this.sun.target.updateMatrixWorld();this.renderer.shadowMap.needsUpdate=true;}
    let count=0;const dummy=this.contactTransform;
    for(const entity of [p,...g.traffic.cars,...g.people.people]){
      if(count===200||entity===p&&p.car||dist(entity,p)>115||entity.hp<=0)continue;
      dummy.position.set(entity.x,.285,entity.z);dummy.rotation.set(0,-(entity.a||0),0);dummy.scale.set(entity.config?3.8:1.6,1,entity.config?entity.config.length*1.35:1.6);dummy.updateMatrix();this.contacts.setMatrixAt(count++,dummy.matrix);
    }
    this.contacts.count=count;this.contacts.instanceMatrix.needsUpdate=true;
    this.renderer.render(this.scene,this.camera);
  }
  aim(mouse,p) {
    this.ray.setFromCamera(new T.Vector2(mouse.x/innerWidth*2-1,-mouse.y/innerHeight*2+1),this.camera);
    const v=new T.Vector3();return this.ray.ray.intersectPlane(this.ground,v)?{x:v.x,z:v.z}:{x:p.x+Math.sin(this.yaw)*50,z:p.z-Math.cos(this.yaw)*50};
  }
  project(x,y,z) { const p=new T.Vector3(x,y,z).project(this.camera);return{x:(p.x*.5+.5)*innerWidth,y:(-.5*p.y+.5)*innerHeight,visible:p.z<1}; }
}
export class Effects {
  constructor(scene) {this.scene=scene;this.particles=[];this.tracers=[];this.skids=[];this.geometry=new T.IcosahedronGeometry(.1,0);this.materials=new Map();}
  burst(x,y,z,count,color,power=4,life=.5) {
    let m=this.materials.get(color);if(!m){m=new T.MeshBasicMaterial({color});this.materials.set(color,m);}
    for(let i=0;i<count;i++) {
      if(this.particles.length>180)break;
      const mesh=new T.Mesh(this.geometry,m);mesh.position.set(x,y,z);this.scene.add(mesh);
      this.particles.push({mesh,vx:(Math.random()-.5)*power,vy:Math.random()*power,vz:(Math.random()-.5)*power,life,max:life});
    }
  }
  impact(x,y,z,n){this.burst(x,y,z,Math.min(18,Math.ceil(n)), '#f5c774',5,.45);}
  explosion(x,y,z){this.burst(x,y,z,45,'#f4a34e',12,1.5);this.burst(x,y,z,20,'#4b514d',6,3);}
  smoke(x,y,z){this.burst(x,y,z,1,'#6c7065',1.4,2);}
  tracer(a,b,color='#ffe3a0') {
    const geo=new T.BufferGeometry().setFromPoints([new T.Vector3(a.x,1.25,a.z),new T.Vector3(b.x,1.1,b.z)]);
    const mesh=new T.Line(geo,new T.LineBasicMaterial({color}));this.scene.add(mesh);this.tracers.push({mesh,life:.18});
  }
  skid(car) {
    if(this.skids.length>240){const s=this.skids.shift();this.scene.remove(s);s.geometry.dispose();}
    const mesh=new T.Mesh(new T.PlaneGeometry(1.5,.15),new T.MeshBasicMaterial({color:'#303c3b',transparent:true,opacity:.4,depthWrite:false}));
    mesh.rotation.set(-Math.PI/2,0,car.a+Math.PI/2);mesh.position.set(car.x,.29,car.z);this.scene.add(mesh);this.skids.push(mesh);
  }
  update(dt) {
    for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.life-=dt;if(p.life<=0){this.scene.remove(p.mesh);this.particles.splice(i,1);continue;}p.vy-=dt*5;p.mesh.position.x+=p.vx*dt;p.mesh.position.y+=p.vy*dt;p.mesh.position.z+=p.vz*dt;p.mesh.scale.setScalar(Math.max(.1,p.life/p.max)*2);}
    for(let i=this.tracers.length-1;i>=0;i--){const p=this.tracers[i];p.life-=dt;if(p.life<=0){this.scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();this.tracers.splice(i,1);}}
  }
}
