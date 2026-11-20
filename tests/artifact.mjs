import {readdirSync,readFileSync,lstatSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {join,relative,resolve,extname} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {buildDossier} from '../vendor/makefun-game.ts';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const caps={text_max_bytes:163840,screenshots:{max:4,max_bytes:262144},game_max_files:993,game_max_bytes:50331648,game_path_max_bytes:1000};
function walk(root,base=root,result=[]){for(const item of readdirSync(base).sort()){const path=join(base,item),s=lstatSync(path);assert(!s.isSymbolicLink());assert(s.isFile()||s.isDirectory());const name=relative(root,path).replaceAll('\\','/');result.push({name,bytes:s.size,dir:s.isDirectory(),path});if(s.isDirectory())walk(root,path,result);}return result;}
function manifest(root){return walk(root).filter(v=>!v.dir).map(v=>sha(readFileSync(v.path))+'  '+v.name).join('\n')+'\n';}
function jpegSize(buffer){assert.equal(buffer.readUInt16BE(0),0xffd8);assert.equal(buffer.readUInt16BE(buffer.length-2),0xffd9);let i=2;while(i<buffer.length){if(buffer[i++]!==255)continue;const marker=buffer[i++];if(marker===0xd9)break;const n=buffer.readUInt16BE(i);if([0xc0,0xc1,0xc2].includes(marker))return{height:buffer.readUInt16BE(i+3),width:buffer.readUInt16BE(i+5)};i+=n;}throw Error('Missing JPEG dimensions');}
mkdirSync('.qa',{recursive:true});const runs=[];
for(const name of ['out-a','out-b']){const root=resolve(name);rmSync(root,{recursive:true,force:true});const start=performance.now();const r=spawnSync(process.execPath,['main.ts'],{env:{...process.env,MAKEFUN_OUTPUT_DIR:root},encoding:'utf8',timeout:10000});const ms=performance.now()-start;assert.equal(r.status,0,r.stderr);assert(ms<10000);runs.push({root,ms});}
const a=manifest(runs[0].root),b=manifest(runs[1].root);assert.equal(a,b,'exact packaged bytes repeat');
assert.equal(manifest(resolve('game')),manifest(join(runs[0].root,'game')),'the packaged game is the tested source tree');
assert.equal(manifest(resolve('screenshots')),manifest(join(runs[0].root,'screenshots')),'the packaged images are the direct selected captures');
const root=runs[0].root,all=walk(root),game=walk(join(root,'game'));assert(all.length<=1000);assert(all.reduce((n,v)=>n+(v.dir?0:v.bytes),0)<=67108864);assert(game.length<=993);assert(game.reduce((n,v)=>n+(v.dir?0:v.bytes),0)<=50331648);
const sourceBytes=game.filter(v=>!v.dir&&!v.name.startsWith('vendor/')&&['.js','.mjs','.html','.css','.json','.glsl','.vert','.frag','.wgsl'].includes(extname(v.name))).reduce((n,v)=>n+v.bytes,0);assert(sourceBytes<=163840,'all custom game source fits the dossier text cap');
for(const v of game)assert(Buffer.byteLength(v.name)<=1000);
const screenshots=walk(join(root,'screenshots')).filter(v=>!v.dir);assert(screenshots.length>=3&&screenshots.length<=4);
const images=screenshots.map(v=>{assert(/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/.test(v.name));assert(v.bytes<=262144);assert(['.jpg','.jpeg'].includes(extname(v.name)));const size=jpegSize(readFileSync(v.path));assert(Math.max(size.width,size.height)<=1280&&Math.min(size.width,size.height)>=480);return{name:v.name,bytes:v.bytes,...size,sha256:sha(readFileSync(v.path))};});
const dossier=readFileSync(join(root,'dossier.json'));assert(dossier.length<=1572864);assert.equal(dossier.toString(),buildDossier(root,caps));
assert.equal(sha(readFileSync('vendor/makefun-game.ts')),'dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129');
for(const v of game.filter(v=>!v.dir&&['.js','.mjs'].includes(extname(v.name)))){const r=spawnSync(process.execPath,['--check',v.path],{encoding:'utf8'});assert.equal(r.status,0,v.name+' '+r.stderr);const source=readFileSync(v.path,'utf8');for(const m of source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)){const target=m[1];if(target.startsWith('data:'))continue;assert(target.startsWith('.'),v.name+' non-local module '+target);const file=resolve(v.path,'..',target);assert(file.startsWith(join(root,'game')+'/'));assert(lstatSync(file).isFile());}}
const report={node:process.version,runs:runs.map(v=>({directory:relative('.',v.root),ms:Math.round(v.ms*100)/100})),manifest_sha256:sha(a),game_entries:game.length,game_bytes:game.reduce((n,v)=>n+(v.dir?0:v.bytes),0),custom_source_bytes:sourceBytes,output_entries:all.length,dossier_bytes:dossier.length,dossier_sha256:sha(dossier),images};
writeFileSync('.qa/output-manifest.txt',a);writeFileSync('.qa/artifact-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
