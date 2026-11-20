import * as T from '../vendor/three.module.min.js';
export { T };
const materials = new Map();
export function material(color, roughness = .8, metalness = 0) {
  if(materials.has('named:'+color))return materials.get('named:'+color);
  const key = [color, roughness, metalness].join();
  if (!materials.has(key)) materials.set(key, metalness>0?new T.MeshPhongMaterial({ color, shininess:42, specular:'#94aaa8' }):new T.MeshLambertMaterial({color}));
  return materials.get(key);
}
export function namedMaterial(name,value){materials.set('named:'+name,value);return name;}
export const geometries = {
  box: new T.BoxGeometry(1, 1, 1),
  cylinder: new T.CylinderGeometry(.5, .5, 1, 10),
  sphere: new T.IcosahedronGeometry(.5, 1),
  cone: new T.ConeGeometry(.5, 1, 7),
  panel: new T.PlaneGeometry(1,1),
};
export function part(parent, shape, color, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) {
  const mesh = new T.Mesh(geometries[shape] || shape, typeof color === 'object' ? color : material(color));
  mesh.position.set(x, y, z); mesh.scale.set(w, h, d); mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
const rigidMaterials={plain:new T.MeshLambertMaterial({vertexColors:true}),gloss:new T.MeshPhongMaterial({vertexColors:true,shininess:35,specular:'#748c8b'})};
export function mergeRigid(root,exclude=[],gloss=false){
  const meshes=root.children.filter(m=>m.isMesh&&!exclude.includes(m));if(meshes.length<2)return;
  const positions=[],normals=[],colors=[],v=new T.Vector3(),n=new T.Vector3();
  for(const mesh of meshes){
    mesh.updateMatrix();const geo=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry,pa=geo.getAttribute('position'),na=geo.getAttribute('normal'),normalMatrix=new T.Matrix3().getNormalMatrix(mesh.matrix),color=mesh.material.color;
    for(let i=0;i<pa.count;i++){
      v.fromBufferAttribute(pa,i).applyMatrix4(mesh.matrix);positions.push(v.x,v.y,v.z);
      if(na)n.fromBufferAttribute(na,i).applyMatrix3(normalMatrix).normalize();else n.set(0,1,0);normals.push(n.x,n.y,n.z);colors.push(color.r,color.g,color.b);
    }
    root.remove(mesh);if(mesh.geometry.index)geo.dispose();
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeBoundingSphere();
  const merged=new T.Mesh(geometry,rigidMaterials[gloss?'gloss':'plain']);merged.castShadow=true;merged.receiveShadow=true;root.add(merged);
}
export class StaticBatch {
  constructor(scene) { this.scene = scene; this.groups = new Map(); this.dummy = new T.Object3D(); }
  add(shape, color, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) {
    const tile=Math.max(w,d)>100?'large':Math.floor(x/128)+','+Math.floor(z/128);
    const key = shape + ':' + color+':'+tile;
    if (!this.groups.has(key)) this.groups.set(key, { shape, color, tile, instances: [] });
    this.groups.get(key).instances.push([x, y, z, w, h, d, rx, ry, rz]);
  }
  finish() {
    const tiles=new Map(),expanded=new Map(),vertex=new T.Vector3(),normal=new T.Vector3(),nm=new T.Matrix3();
    for (const g of this.groups.values()) {
      if(g.color.startsWith('#')){
        if(!tiles.has(g.tile))tiles.set(g.tile,{positions:[],normals:[],colors:[]});const tile=tiles.get(g.tile),color=new T.Color(g.color);
        if(!expanded.has(g.shape)){const source=geometries[g.shape];expanded.set(g.shape,source.index?source.toNonIndexed():source);}
        const geometry=expanded.get(g.shape),pa=geometry.getAttribute('position'),na=geometry.getAttribute('normal');
        for(const v of g.instances){
          this.dummy.position.set(v[0],v[1],v[2]);this.dummy.scale.set(v[3],v[4],v[5]);this.dummy.rotation.set(v[6],v[7],v[8]);this.dummy.updateMatrix();nm.getNormalMatrix(this.dummy.matrix);
          for(let i=0;i<pa.count;i++){
            vertex.fromBufferAttribute(pa,i).applyMatrix4(this.dummy.matrix);normal.fromBufferAttribute(na,i).applyMatrix3(nm).normalize();
            tile.positions.push(vertex.x,vertex.y,vertex.z);tile.normals.push(normal.x,normal.y,normal.z);tile.colors.push(color.r,color.g,color.b);
          }
        }
        continue;
      }
      const mesh = new T.InstancedMesh(geometries[g.shape], material(g.color), g.instances.length);
      g.instances.forEach((v, i) => {
        this.dummy.position.set(v[0], v[1], v[2]); this.dummy.scale.set(v[3], v[4], v[5]); this.dummy.rotation.set(v[6], v[7], v[8]); this.dummy.updateMatrix();
        mesh.setMatrixAt(i, this.dummy.matrix);
      });
      mesh.castShadow = !['#e4ddc9', '#555b5b', '#ddc377', '#f9eed4'].includes(g.color);
      mesh.receiveShadow = true; mesh.computeBoundingSphere(); this.scene.add(mesh);
    }
    for(const [key,tile]of tiles){
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(tile.positions,3));geo.setAttribute('normal',new T.Float32BufferAttribute(tile.normals,3));geo.setAttribute('color',new T.Float32BufferAttribute(tile.colors,3));geo.computeBoundingSphere();
      const mesh=new T.Mesh(geo,rigidMaterials.plain);mesh.castShadow=key!=='large';mesh.receiveShadow=true;this.scene.add(mesh);
    }
    this.groups.clear();
  }
}
function bodyGeometry(width, length, height) {
  const shape = new T.Shape();
  shape.moveTo(-length * .49, .0); shape.lineTo(length * .49, .0);
  shape.lineTo(length * .5, height * .55); shape.lineTo(length * .37, height);
  shape.lineTo(-length * .39, height); shape.lineTo(-length * .5, height * .55); shape.closePath();
  const geo = new T.ExtrudeGeometry(shape, { depth: width, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .08, bevelThickness: .08 });
  geo.rotateY(Math.PI / 2); geo.translate(-width / 2, 0, 0); return geo;
}
const carBodies = {};
export const VEHICLE_TYPES = {
  coupe: { name: 'KESTREL GT', max: 48, accel: 16, turn: 1.0, grip: 6.2, mass: 1, color: '#dc754c', length: 4.6, health: 110 },
  sedan: { name: 'MORROW S4', max: 36, accel: 11.5, turn: .9, grip: 8, mass: 1.25, color: '#e5d8b3', length: 4.6, health: 135 },
  van: { name: 'TIDELINE PANEL', max: 29, accel: 8, turn: .7, grip: 5.8, mass: 2, color: '#809f9a', length: 5.4, health: 190 },
  patrol: { name: 'CP • INTERCEPTOR', max: 42, accel: 15, turn: 1.05, grip: 8, mass: 1.4, color: '#f0ede0', length: 4.9, health: 155 },
  truck: { name: 'CAIRN CARGO 8', max: 25, accel: 7, turn: .7, grip: 5, mass: 3, color: '#b7885a', length: 7, health: 270 },
};
export function createVehicleModel(type = 'sedan', color) {
  const config = VEHICLE_TYPES[type], g = new T.Group(); const L = config.length, W = type === 'truck' ? 2.5 : 2.05;
  color ||= config.color;
  if (!carBodies[type]) carBodies[type] = bodyGeometry(W, L, type === 'coupe' ? .52 : .7);
  part(g, carBodies[type], material(color, .32, .34), 0, .5, 0, 1, 1, 1);
  part(g, 'box', '#172e34', 0, .53, 0, W * .9, .2, L * .87);
  const glass = material('#193e4c', .17, .55);
  const cabin = part(g, 'box', glass, 0, 1.35, .0, W * .82, type === 'coupe' ? .53 : .67, L * .47, -.1);
  part(g, 'box', color, 0, 1.67, .12, W * .83, .12, L * .38);
  for (const s of [-1, 1]) {
    part(g, 'box', color, s * W * .42, 1.4, .02, .075, .6, .1);
    part(g, 'box', color, s * W * .43, 1.39, L * .21, .085, .65, .1, -.18);
    part(g, 'box', '#a5b5af', s * W * .43, 1.31, -L * .24, .06, .59, .07, .32);
    part(g, 'box', '#081e27', s * W * .54, 1.24, -L * .16, .22, .15, .25);
    part(g, 'box', '#e9dfc0', s * .66, .95, -L * .5, .52, .19, .07);
    part(g, 'box', '#e15842', s * .67, .94, L * .5, .48, .16, .07);
    part(g, 'box', '#d3c8b0', s * W * .49, .62, 0, .04, .06, L * .53);
  }
  part(g, 'box', '#102329', 0, .68, -L * .51, .8, .2, .055);
  part(g, 'box', '#d8d4c0', 0, .66, L * .51, .54, .17, .05);
  const wheels = [];
  for (const x of [-W * .49, W * .49]) for (const z of [-L * .31, L * .31]) {
    const pivot = new T.Group(); pivot.position.set(x, .48, z); g.add(pivot);
    part(pivot, 'cylinder', '#152328', 0, 0, 0, .82, .32, .82, 0, 0, Math.PI / 2);
    part(pivot, 'cylinder', '#a8b6b2', Math.sign(x) * .17, 0, 0, .46, .02, .46, 0, 0, Math.PI / 2);
    part(pivot, 'cylinder', '#405358', Math.sign(x) * .184, 0, 0, .19, .025, .19, 0, 0, Math.PI / 2);
    wheels.push(pivot);
  }
  if (type === 'coupe') {
    part(g, 'box', '#f1d5a6', -.32, 1.09, -1.52, .12, .02, 1.2);
    part(g, 'box', '#f1d5a6', .32, 1.09, -1.52, .12, .02, 1.2);
    part(g, 'box', '#182e35', 0, 1.25, 1.9, 2.17, .09, .32);
    for (const x of [-.65,.65]) part(g, 'box', '#182e35', x, 1.1, 1.9, .08, .28, .12);
  }
  if (type === 'van' || type === 'truck') {
    part(g, 'box', color, 0, type === 'truck' ? 1.9 : 1.6, .75, W * .95, type === 'truck' ? 2.4 : 1.6, L * .58);
    part(g, 'box', '#e2d9be', 0, 1.45, L * .52, W * .9, 1.5, .07);
    for (const x of [-.43, .43]) part(g, 'box', '#5a716d', x, 1.5, L * .53, .05, 1.25, .06);
  }
  let lights = null,glows=[];
  if (type === 'patrol') {
    for (const x of [-1.033, 1.033]) part(g, 'box', '#173f4b', x, .92, .0, .035, .34, 2.4);
    part(g, 'box', '#132e36', 0, 1.82, .2, 1.5, .12, .43);
    lights = [-.48, .48].map((x, i) => part(g, 'box', new T.MeshBasicMaterial({color:i ? '#3cc3ff':'#ff3c28'}), x, 1.94, .2, .57, .18, .36));
    glows=[-1.3,1.3].map((x,i)=>{const m=new T.Mesh(new T.CircleGeometry(1.9,20),new T.MeshBasicMaterial({color:i?'#39bdf0':'#ff603b',transparent:true,opacity:.22,depthWrite:false,blending:T.AdditiveBlending}));m.rotation.x=-Math.PI/2;m.position.set(x,.07,.2);g.add(m);return m;});
    part(g, 'cylinder', '#e8d59c', -1.06, .95, .0, .28, .04, .28, 0, 0, Math.PI / 2);
    part(g, 'cylinder', '#e8d59c', 1.06, .95, .0, .28, .04, .28, 0, 0, Math.PI / 2);
  }
  for(const wheel of wheels)mergeRigid(wheel,[],true);
  mergeRigid(g,[...(lights||[]),...glows],true);if(type==='coupe')g.scale.y=.86;
  return { group: g, wheels, lights, glows, cabin };
}
export function createPersonModel(shirt = '#dc754c', skin = '#b9815e', player = false) {
  const g = new T.Group(), torso = new T.Group(); g.add(torso); torso.position.y = .94;
  part(torso, 'box', shirt, 0, .28, 0, .53, .65, .29);
  if (player) { part(torso, 'box', '#f5dfbb', 0, .27, -.157, .2, .55, .02); part(torso, 'box', '#e0bb76', -.2, .4, -.18, .08, .12, .03);part(torso,'box','#f2dbac',.13,.28,.16,.1,.58,.035,0,0,-.32);part(torso,'box','#26474c',-.05,.18,.25,.39,.37,.16); }
  part(torso, 'cylinder', skin, 0, .7, 0, .19, .16, .19);
  part(torso, 'sphere', skin, 0, .91, 0, .4, .46, .38);
  part(torso, 'sphere', '#2c2928', 0, 1.06, .015, .42, .25, .39);
  part(torso, 'box', '#142c32', 0, .95, -.18, .33, .07, .04);
  const arms = [], legs = [];
  for (const s of [-1, 1]) {
    const arm = new T.Group(); arm.position.set(s * .36, .51, 0); torso.add(arm);
    part(arm, 'box', shirt, 0, -.14, 0, .19, .35, .22);
    part(arm, 'box', skin, 0, -.44, 0, .16, .29, .17); arms.push(arm);
    const leg = new T.Group(); leg.position.set(s * .15, 1.0, 0); g.add(leg);
    part(leg, 'box', player ? '#263d45' : '#3c4544', 0, -.36, 0, .22, .7, .24);
    part(leg, 'box', '#1a272b', 0, -.83, -.07, .25, .17, .4); legs.push(leg);
  }
  const gun = new T.Group();
  part(gun, 'box', '#152c32', 0, 0, -.16, .1, .12, .4);
  part(gun, 'box', '#152c32', 0, -.12, -.03, .1, .23, .12);
  gun.position.set(0, -.53, -.03); arms[1].add(gun); gun.visible = false;
  mergeRigid(torso);for(const arm of arms)mergeRigid(arm);for(const leg of legs)mergeRigid(leg);mergeRigid(gun);
  return { group: g, torso, arms, legs, gun };
}
export function animatePerson(m, t, speed, aiming = false) {
  const step = Math.sin(t * 10) * Math.min(Math.abs(speed) * .2, .8);
  m.legs[0].rotation.x = step; m.legs[1].rotation.x = -step;
  m.arms[0].rotation.x = aiming ? -1.2 : -step * .7;
  m.arms[1].rotation.x = aiming ? -1.42 : step * .7;
  m.torso.rotation.z = aiming ? 0 : Math.sin(t * 5) * .015;
  m.gun.visible = aiming;
}
export function createHelicopter() {
  const g = new T.Group();
  part(g, 'sphere', '#f2ebcf', 0, 0, 0, 3, 2.5, 5.2);
  part(g, 'sphere', '#183a47', 0, .1, -1.2, 2.8, 1.8, 2.6);
  part(g, 'box', '#194b56', 0, .6, 3.6, .6, .8, 5.8, .08);
  part(g, 'box', '#e9d6b0', 0, 1.15, 5.8, .15, 2.6, 1.6, .25);
  for (const s of [-1,1]) {
    part(g, 'box', '#233c43', s * 1.15, -1.7, .1, .1, .16, 4.8);
    part(g, 'box', '#233c43', s * .85, -1.2, -.7, .09, 1, .1, 0, 0, s * -.55);
  }
  const rotor = new T.Group(); rotor.position.y = 1.7; g.add(rotor);
  part(rotor, 'box', '#183a42', 0, 0, 0, 12, .07, .24);
  part(rotor, 'box', '#183a42', 0, 0, 0, .24, .07, 12);
  part(g, 'cylinder', '#2c4546', 0, 1.3, 0, .25, 1, .25);
  const beam = new T.Mesh(new T.ConeGeometry(15, 46, 32, 1, true), new T.MeshBasicMaterial({ color:'#fcebb2', transparent:true, opacity:.055, depthWrite:false, side:T.DoubleSide, blending:T.AdditiveBlending }));
  beam.position.y = -24; g.add(beam);
  return { group:g, rotor, beam };
}
export function textSign(scene, text, x, y, z, width, height, rotation = 0, bg = '#153e45', fg = '#ffedc8') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const cx = c.getContext('2d'); cx.fillStyle = bg; cx.fillRect(0, 0, 512, 128);
  cx.fillStyle = fg; cx.font = 'bold 52px Arial'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(text, 256, 67, 470);
  const texture = new T.CanvasTexture(c); texture.colorSpace = T.SRGBColorSpace;
  const mesh = new T.Mesh(new T.PlaneGeometry(width, height), new T.MeshBasicMaterial({map:texture}));
  mesh.position.set(x, y, z); mesh.rotation.y = rotation; scene.add(mesh); return mesh;
}
