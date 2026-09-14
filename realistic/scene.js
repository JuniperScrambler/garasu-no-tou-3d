import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { createArchitecture,H,TOP,yFloor,radius } from './architecture.js';
import { createLandscape,randomSource } from './landscape.js';

const $=id=>document.getElementById(id);
let renderer;
try{
  renderer=new THREE.WebGLRenderer({canvas:$('scene'),antialias:true,alpha:false,powerPreference:'high-performance'});
}catch(error){
  window.sceneFailed('このブラウザでは3D描画を利用できません。SafariまたはChromeの通常のタブで開き、ハードウェアアクセラレーションを確認してください。');
}
if(renderer){try{start()}catch(error){console.error(error);window.sceneFailed('3D表示の準備中に問題が発生しました。再読み込みしても改善しない場合は、元のビューアをお使いください。')}}

function start(){
const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x8193a8,.0055);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
renderer.localClippingEnabled=true;
const camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.15,400);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.065;controls.rotateSpeed=.5;controls.panSpeed=.65;controls.zoomSpeed=.7;controls.minDistance=5;controls.maxDistance=170;controls.maxPolarAngle=Math.PI*.49;
controls.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN};controls.autoRotateSpeed=.28;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const state={mode:'exterior',floor:'all',dusk:true,labels:false,angle:55,height:22,quality:'auto'};
const clipPlane=new THREE.Plane(new THREE.Vector3(-1,0,0),0),clipPlanes=[clipPlane];

// Procedural textures: no paid or remotely hosted image assets.
function texture(kind){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const c=canvas.getContext('2d');const random=randomSource(3821);
  if(kind==='wood'){
    c.fillStyle='#877160';c.fillRect(0,0,512,512);
    for(let row=0;row<16;row++){
      const tone=Math.floor(112+random()*30);c.fillStyle=`rgb(${tone+22},${tone+2},${tone-18})`;c.fillRect(0,row*32,512,31);
      for(let j=0;j<50;j++){
        c.strokeStyle=`rgba(39,26,19,${.02+random()*.09})`;c.lineWidth=.3+random()*.6;c.beginPath();const y=row*32+random()*31;
        c.moveTo(0,y);c.bezierCurveTo(160,y-2,360,y+2,512,y);c.stroke();
      }
      const seam=(row*131)%420;c.fillStyle='#433d3744';c.fillRect(seam,row*32,1,32);
    }
  }else{
    const d=c.createImageData(512,512);
    for(let i=0;i<d.data.length;i+=4){const v=kind==='stone'?172+random()*24:226+random()*27;d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255}c.putImageData(d,0,0);
  }
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;
}
const wood=texture('wood'),stone=texture('stone'),snowTex=texture('snow');snowTex.repeat.set(80,80);
const std=(color,opts={})=>new THREE.MeshStandardMaterial({color,roughness:.65,side:THREE.DoubleSide,...opts});
const M={
  stone:std(0x95999a,{roughness:.85,map:stone}),foundation:std(0x677078,{roughness:.93,map:stone}),core:std(0x877a65,{roughness:.8}),
  woodFloor:std(0xb99b74,{map:wood,roughness:.42,metalness:.05}),wood:std(0x674833,{map:wood,roughness:.44}),corridor:std(0x9b9589,{map:stone,roughness:.62}),
  serviceFloor:std(0x999c99,{roughness:.7}),floorSeam:std(0x5d5447),plaster:std(0xdbc8aa,{roughness:.96}),ceiling:std(0xd6c3a2,{roughness:.95}),
  metal:std(0x26343c,{roughness:.28,metalness:.78}),mullion:std(0x55616a,{roughness:.24,metalness:.86}),brass:std(0xb89a5d,{roughness:.28,metalness:.82}),stair:std(0x666462,{roughness:.44,metalness:.35}),
  fabric:std(0x778588,{roughness:1}),linen:std(0xe9dfcf,{roughness:1}),blanket:std(0x7b6257,{roughness:1}),rug:std(0x958b7b,{roughness:1}),felt:std(0x2e6056,{roughness:1}),
  shade:std(0xe7ccb0,{roughness:.9,emissive:0xdba968,emissiveIntensity:.23}),glow:std(0xffd5a2,{emissive:0xffbc70,emissiveIntensity:3.2,roughness:.8}),screen:std(0x66798a,{emissive:0x536981,emissiveIntensity:.15}),
  glass:new THREE.MeshPhysicalMaterial({color:0xb2c9d1,roughness:.11,metalness:.08,transparent:true,opacity:.28,depthWrite:false,side:THREE.DoubleSide,transmission:0,thickness:.10,ior:1.46,clearcoat:1,clearcoatRoughness:.06,envMapIntensity:1.1}),
  snow:std(0xe3ebf0,{roughness:.94,map:snowTex}),needles:std(0x283e40,{roughness:1}),treeSnow:std(0xdbe5eb,{roughness:1}),bark:std(0x514a42,{roughness:1}),path:std(0x56616b,{roughness:.4,map:stone}),pool:null,
};
const glowCanvas=document.createElement('canvas');glowCanvas.width=128;glowCanvas.height=128;const gc=glowCanvas.getContext('2d'),gradient=gc.createRadialGradient(64,64,0,64,64,64);gradient.addColorStop(0,'rgba(255,199,128,.42)');gradient.addColorStop(.35,'rgba(255,199,128,.18)');gradient.addColorStop(1,'rgba(255,199,128,0)');gc.fillStyle=gradient;gc.fillRect(0,0,128,128);
M.pool=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(glowCanvas),transparent:true,depthWrite:false,opacity:.65,blending:THREE.AdditiveBlending});

// Environment illumination plus two directional sources; one localized lobby light.
// The architecture receives actual shadow maps; window coves add a restrained glow.
const hemi=new THREE.HemisphereLight(0x99b8d8,0xa29782,1.25);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffc293,2.2);sun.position.set(-45,35,-55);sun.castShadow=true;sun.shadow.camera.left=-35;sun.shadow.camera.right=35;sun.shadow.camera.top=44;sun.shadow.camera.bottom=-30;sun.shadow.camera.near=1;sun.shadow.camera.far=160;sun.shadow.bias=-.00025;sun.shadow.normalBias=.035;sun.target.position.set(0,12,0);scene.add(sun,sun.target);
const fill=new THREE.DirectionalLight(0xaacbea,1.6);fill.position.set(30,25,45);scene.add(fill);
const warmFill=new THREE.DirectionalLight(0xffc58b,.45);warmFill.position.set(0,12,0);warmFill.target.position.set(12,14,12);scene.add(warmFill,warmFill.target);
const lobby=new THREE.PointLight(0xffc586,24,23,2);lobby.position.set(3.8,2.1,0);scene.add(lobby);
const landscapeM={...M};for(const key of ['snow','stone','metal','glow'])landscapeM[key]=M[key].clone();
const landscape=createLandscape(scene,landscapeM);
const building=createArchitecture(M);scene.add(building.root);
const clippedMaterials=new Set();building.root.traverse(o=>{if(o.material)clippedMaterials.add(o.material)});

// A generated HDR sky supplies physically based reflections with no asset downloads.
const pmrem=new THREE.PMREMGenerator(renderer);pmrem.compileEquirectangularShader();let skyTexture=null,envTarget=null;
function environment(dusk){
  const w=512,h=256,data=new Float32Array(w*h*4);
  const top=new THREE.Color(dusk?0x254761:0x6399c7),horizon=new THREE.Color(dusk?0xc4a5a0:0xd1e2ed),bottom=new THREE.Color(dusk?0x62798c:0xadbcc5);
  const sunDir=new THREE.Vector3(-.61,dusk?.08:.6,-.78).normalize(),col=new THREE.Color();
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const v=y/(h-1),u=x/(w-1),lat=(v-.5)*Math.PI,lon=(u-.5)*Math.PI*2;
    const yy=Math.sin(lat),dx=Math.cos(lat)*Math.cos(lon),dz=Math.cos(lat)*Math.sin(lon);
    if(yy>=0)col.copy(horizon).lerp(top,Math.pow(Math.min(1,yy*1.5),.55));else col.copy(horizon).lerp(bottom,Math.min(1,-yy*3));
    const dot=dx*sunDir.x+yy*sunDir.y+dz*sunDir.z;
    const halo=Math.exp((dot-1)*38)*(dusk?.8:.3),disc=Math.exp((dot-1)*5500)*(dusk?9:24);
    const cloud=(Math.sin(lon*17+yy*29)*Math.sin(lon*9-yy*15)+1)*.024*Math.exp(-Math.pow((yy-.22)*4,2));
    const i=(y*w+x)*4;data[i]=col.r+halo+disc+cloud;data[i+1]=col.g+halo*.55+disc*.8+cloud;data[i+2]=col.b+halo*.28+disc*.58+cloud;data[i+3]=1;
  }
  const tex=new THREE.DataTexture(data,w,h,THREE.RGBAFormat,THREE.FloatType);tex.mapping=THREE.EquirectangularReflectionMapping;tex.needsUpdate=true;tex.colorSpace=THREE.LinearSRGBColorSpace;
  const next=pmrem.fromEquirectangular(tex);scene.background=tex;scene.environment=next.texture;scene.backgroundBlurriness=.06;scene.backgroundIntensity=dusk?.85:1;
  skyTexture?.dispose();envTarget?.dispose();skyTexture=tex;envTarget=next;
}

const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
class GlassAwareAO extends GTAOPass{
  overrideVisibility(){super.overrideVisibility();this.scene.traverse(o=>{if(o.material?.transparent)o.visible=false})}
}
const ao=new GlassAwareAO(scene,camera,innerWidth,innerHeight,undefined,{radius:.55,thickness:.35,distanceFallOff:1,scale:1,samples:8},{radius:4,samples:8});ao.blendIntensity=.65;composer.addPass(ao);
const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.22,.55,1.25);composer.addPass(bloom);
composer.addPass(new OutputPass());const fxaa=new ShaderPass(FXAAShader);composer.addPass(fxaa);

// Snowflakes are round alpha sprites and are kept away from the building envelope.
const snowRandom=randomSource(902),snowCount=420,snowPos=new Float32Array(snowCount*3),snowSpeed=new Float32Array(snowCount);
for(let i=0;i<snowCount;i++){const a=snowRandom()*Math.PI*2,r=16+snowRandom()*65;snowPos[i*3]=Math.cos(a)*r;snowPos[i*3+1]=snowRandom()*48;snowPos[i*3+2]=Math.sin(a)*r;snowSpeed[i]=.35+snowRandom()*.48}
const snowGeo=new THREE.BufferGeometry();snowGeo.setAttribute('position',new THREE.BufferAttribute(snowPos,3));
const flakeCanvas=document.createElement('canvas');flakeCanvas.width=32;flakeCanvas.height=32;const fc=flakeCanvas.getContext('2d'),fg=fc.createRadialGradient(16,16,0,16,16,16);fg.addColorStop(0,'rgba(255,255,255,.9)');fg.addColorStop(.3,'rgba(255,255,255,.7)');fg.addColorStop(1,'rgba(255,255,255,0)');fc.fillStyle=fg;fc.fillRect(0,0,32,32);
const snow=new THREE.Points(snowGeo,new THREE.PointsMaterial({color:0xe8f3ff,map:new THREE.CanvasTexture(flakeCanvas),size:.10,transparent:true,opacity:.57,depthWrite:false,sizeAttenuation:true}));snow.frustumCulled=false;scene.add(snow);

const labelEntries=building.anchors.map(a=>{
  const el=document.createElement('div');el.className='room-label';
  const chip=document.createElement('span');chip.className='floor-chip';chip.textContent=a.floor<0?'B1':a.floor+'F';
  const name=document.createElement('span');name.className='room-name';name.textContent=a.name;
  el.append(chip,name);el.hidden=true;$('labels').appendChild(el);
  return{...a,el};
});
const projected=new THREE.Vector3(),_camDist=new THREE.Vector3();
function updateLabels(){
  const w=innerWidth,h=innerHeight,bottom=$('dock')?.offsetHeight||140;
  const candidates=[];
  for(const a of labelEntries){
    a.el.hidden=true;
    if(!state.labels||(state.floor!=='all'&&a.floor!==Number(state.floor)))continue;
    if(state.mode!=='exterior'&&clipPlane.distanceToPoint(a.pos)<.02)continue;
    if(a.floor===-1&&state.mode==='exterior')continue;
    projected.copy(a.pos).project(camera);
    if(projected.z<-1||projected.z>1)continue;
    const x=(projected.x*.5+.5)*w,y=(-projected.y*.5+.5)*h;
    if(x<55||x>w-55||y<100||y>h-bottom-38)continue;
    const depth=_camDist.copy(a.pos).distanceToSquared(camera.position);
    candidates.push({a,x,y,depth,w:Math.max(78,a.name.length*11+48),h:28});
  }
  // Nearer labels win; nudge overlapping ones 8px vertically when possible.
  candidates.sort((p,q)=>p.depth-q.depth);
  const placed=[];
  for(const c of candidates){
    let y=c.y,ok=false;
    for(const tryY of [y,y-8,y+8,y-16,y+16]){
      if(tryY<100||tryY>h-bottom-38)continue;
      const hit=placed.some(r=>Math.abs(r.x-c.x)<(r.w+c.w)/2+4&&Math.abs(r.y-tryY)<(r.h+c.h)/2+2);
      if(!hit){y=tryY;ok=true;break}
    }
    if(!ok)continue; // farther label loses
    placed.push({x:c.x,y,w:c.w,h:c.h});
    c.a.el.hidden=false;c.a.el.style.left=c.x+'px';c.a.el.style.top=y+'px';
  }
}
function setPressed(id,value){$(id).setAttribute('aria-pressed',String(value))}
function updateClip(){
  if(state.mode==='vertical'){const a=state.angle*Math.PI/180;clipPlane.normal.set(-Math.cos(a),0,-Math.sin(a));clipPlane.constant=0}
  else if(state.mode==='horizontal'){clipPlane.normal.set(0,-1,0);clipPlane.constant=state.height}
  for(const m of clippedMaterials){const wanted=state.mode==='exterior'?null:clipPlanes;if(m.clippingPlanes!==wanted){m.clippingPlanes=wanted;m.clipShadows=true;m.needsUpdate=true}}
  renderer.shadowMap.needsUpdate=true;needsFrame=true;
}
function visibility(){
  for(const group of building.root.children){const selected=state.floor==='all'||group.userData.floor===Number(state.floor);group.visible=selected;group.traverse(o=>{if(o.userData.ceiling)o.visible=state.floor==='all';if(o.userData.facade)o.visible=true})}
  building.roof.visible=state.floor==='all';
  building.entrance.visible=state.floor==='all'||state.floor==='1';
  // Free the underground floor from the opaque 1F slab in floor-isolation mode.
  renderer.shadowMap.needsUpdate=true;needsFrame=true;
}
let cameraMove=null;
function cameraTo(position,target,instant=false){
  if(instant||reduced){camera.position.copy(position);controls.target.copy(target);controls.update();cameraMove=null}
  else cameraMove={from:camera.position.clone(),to:position,fromTarget:controls.target.clone(),toTarget:target,t:0};
  needsFrame=true;
}
function fullView(instant=false){
  const tan=Math.tan(camera.fov*Math.PI/360),distance=Math.max(59,42/tan*.55,27/(tan*camera.aspect)*.56);
  const target=new THREE.Vector3(0,16.2,0),pos=target.clone().add(new THREE.Vector3(.56,.14,.83).normalize().multiplyScalar(distance));cameraTo(pos,target,instant);
}
function floorView(){
  if(state.floor==='all'){fullView();return}
  const f=Number(state.floor),y=yFloor(f)+1.3,R=radius(yFloor(f));
  const dist=Math.max(10,R*2.8,R*1.38/(Math.tan(camera.fov*Math.PI/360)*camera.aspect));
  const target=new THREE.Vector3(0,y,0),dir=new THREE.Vector3(.63,state.mode==='horizontal'?1.05:.55,.77).normalize();cameraTo(target.clone().add(dir.multiplyScalar(dist)),target);
}
function setMode(mode){
  state.mode=mode;for(const id of ['exterior','vertical','horizontal'])setPressed(id,mode===id);
  ao.enabled=activeQuality==='high'&&mode==='exterior';
  $('sectionControl').hidden=mode==='exterior';$('gesture').hidden=mode!=='exterior';
  if(mode==='horizontal'){
    state.height=state.floor==='all'?22:yFloor(Number(state.floor))+2.8;
    $('cut').min=String(-H);$('cut').max=String(TOP);$('cut').step='.1';$('cut').value=String(state.height);$('cut').setAttribute('aria-label','断面の高さ');$('cutLabel').textContent='カット';$('cutValue').textContent=state.height.toFixed(1)+'m';
  }else{$('cut').min='0';$('cut').max='360';$('cut').step='1';$('cut').value=String(state.angle);$('cut').setAttribute('aria-label','断面の方位');$('cutLabel').textContent='カット';$('cutValue').textContent=state.angle+'°'}
  state.labels=mode!=='exterior';syncLabelButton();
  M.glass.opacity=mode==='exterior'?(activeQuality==='high'?.68:.28):.08;M.glass.transmission=mode==='exterior'&&activeQuality==='high'?.55:0;M.glass.needsUpdate=true;
  hemi.intensity=mode==='exterior'?(state.dusk?1.25:2.15):2.55;
  warmFill.intensity=mode==='exterior'?(state.dusk?.45:.2):.9;
  updateClip();visibility();if(state.floor!=='all')floorView();
}
function syncLabelButton(){setPressed('labelToggle',state.labels);$('labelToggle').querySelector('span').textContent=state.labels?'ON':'OFF';needsFrame=true}
let needsFrame=true,activeQuality='';
function quality(){
  const coarse=matchMedia('(pointer: coarse)').matches||innerWidth<700;
  activeQuality=state.quality==='auto'?(coarse?'balanced':'high'):state.quality;
  ao.enabled=activeQuality==='high'&&state.mode==='exterior';
  const dpr=Math.min(devicePixelRatio||1,activeQuality==='high'?2:activeQuality==='light'?1:1.35);
  renderer.setPixelRatio(dpr);renderer.setSize(innerWidth,innerHeight,false);composer.setPixelRatio(dpr);composer.setSize(innerWidth,innerHeight);
  bloom.enabled=activeQuality!=='light';fxaa.enabled=true;fxaa.material.uniforms.resolution.value.set(1/(innerWidth*dpr),1/(innerHeight*dpr));
  const mapSize=activeQuality==='high'?2048:1024;if(sun.shadow.mapSize.x!==mapSize){sun.shadow.mapSize.set(mapSize,mapSize);sun.shadow.map?.dispose();sun.shadow.map=null}
  M.glass.transmission=activeQuality==='high'&&state.mode==='exterior'?.55:0;M.glass.opacity=state.mode!=='exterior'?.08:activeQuality==='high'?.68:.28;M.glass.needsUpdate=true;
  snow.geometry.setDrawRange(0,activeQuality==='light'?140:snowCount);renderer.shadowMap.needsUpdate=true;needsFrame=true;
}
function lighting(dusk){
  state.dusk=dusk;setPressed('dusk',dusk);setPressed('day',!dusk);applyLightTokens(dusk);environment(dusk);
  scene.fog.color.set(dusk?0x8193a8:0xbdcedc);scene.fog.density=dusk?.0055:.0042;
  sun.color.set(dusk?0xffc293:0xffecd4);sun.intensity=dusk?2.2:3.2;sun.position.set(-45,dusk?35:70,-55);
  fill.color.set(dusk?0xaacbea:0xd4e6fa);fill.intensity=dusk?1.6:1.7;
  hemi.intensity=state.mode==='exterior'?(dusk?1.25:2.15):2.55;
  warmFill.intensity=state.mode==='exterior'?(dusk?.45:.2):.9;
  M.glow.emissiveIntensity=dusk?3.2:.8;landscapeM.glow.emissiveIntensity=dusk?3.2:.8;M.pool.opacity=dusk?.65:.1;lobby.intensity=dusk?24:7;M.shade.emissiveIntensity=dusk?.23:.06;
  renderer.toneMappingExposure=dusk?1.12:.95;bloom.strength=dusk?.22:.1;
  landscape.mountainMaterials.forEach((m,i)=>m.color.set((dusk?[0x5a738c,0x72869c,0x8b9aab]:[0x8ba1b2,0xa3b8c8,0xbacbd8])[i]));
  // Capture the real landscape once per lighting change, without the tower itself.
  const cubeTarget=new THREE.WebGLCubeRenderTarget(256,{type:THREE.HalfFloatType});
  const probe=new THREE.CubeCamera(.5,320,cubeTarget);probe.position.set(0,12,0);
  const towerVisible=building.root.visible,snowVisible=snow.visible;
  building.root.visible=false;snow.visible=false;renderer.shadowMap.needsUpdate=true;
  try{probe.update(renderer,scene);const captured=pmrem.fromCubemap(cubeTarget.texture);scene.environment=captured.texture;envTarget.dispose();envTarget=captured}
  finally{building.root.visible=towerVisible;snow.visible=snowVisible;cubeTarget.dispose()}
  renderer.shadowMap.needsUpdate=true;needsFrame=true;
}
function setFloor(floor){
  state.floor=floor;
  for(const btn of document.querySelectorAll('.floor-pill'))setPressedEl(btn,btn.dataset.floor===floor);
  if(state.mode==='horizontal'){
    state.height=state.floor==='all'?22:yFloor(Number(state.floor))+2.8;
    $('cut').value=String(state.height);$('cutValue').textContent=state.height.toFixed(1)+'m';updateClip();
  }
  visibility();floorView();
}
function setPressedEl(el,value){el.setAttribute('aria-pressed',String(value))}
function applyLightTokens(dusk){
  const mode=dusk?'dusk':'day';
  document.documentElement.dataset.light=mode;
  document.body.dataset.light=mode;
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute('content',dusk?'#17232f':'#E8EEF4');
}
function closeSheets(){
  $('about').hidden=true;$('info').setAttribute('aria-expanded','false');
  $('moreMenu').hidden=true;$('more').setAttribute('aria-expanded','false');
}
$('exterior').onclick=()=>setMode('exterior');$('vertical').onclick=()=>setMode('vertical');$('horizontal').onclick=()=>setMode('horizontal');
$('dusk').onclick=()=>lighting(true);$('day').onclick=()=>lighting(false);
$('floorPills').onclick=e=>{const btn=e.target.closest('.floor-pill');if(btn)setFloor(btn.dataset.floor)};
$('cut').oninput=()=>{const value=Number($('cut').value);if(state.mode==='vertical'){state.angle=value;$('cutValue').textContent=value+'°'}else{state.height=value;$('cutValue').textContent=value.toFixed(1)+'m'}updateClip()};
$('labelToggle').onclick=()=>{state.labels=!state.labels;syncLabelButton()};
$('quality').onchange=()=>{state.quality=$('quality').value;quality()};
$('orbit').onclick=()=>{controls.autoRotate=!controls.autoRotate;setPressed('orbit',controls.autoRotate);needsFrame=true};
$('reset').onclick=()=>{controls.autoRotate=false;setPressed('orbit',false);setFloor('all');fullView()};
$('info').onclick=()=>{const open=$('about').hidden;$('moreMenu').hidden=true;$('more').setAttribute('aria-expanded','false');$('about').hidden=!open;$('info').setAttribute('aria-expanded',String(open))};
$('closeInfo').onclick=()=>{$('about').hidden=true;$('info').setAttribute('aria-expanded','false')};
$('more').onclick=()=>{const open=$('moreMenu').hidden;$('about').hidden=true;$('info').setAttribute('aria-expanded','false');$('moreMenu').hidden=!open;$('more').setAttribute('aria-expanded',String(open))};
addEventListener('keydown',e=>{if(e.key==='Escape')closeSheets()});
addEventListener('pointerdown',e=>{
  const t=e.target;
  if(!$('moreMenu').hidden&&!t.closest('#moreMenu')&&!t.closest('#more')){$('moreMenu').hidden=true;$('more').setAttribute('aria-expanded','false')}
  if(!$('about').hidden&&!t.closest('#about')&&!t.closest('#info')){$('about').hidden=true;$('info').setAttribute('aria-expanded','false')}
});
let toastTimer;function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2600)}
$('save').onclick=()=>{try{composer.render();const data=renderer.domElement.toDataURL('image/png');const a=document.createElement('a');a.download='garasu-no-tou-'+(state.dusk?'dusk':'day')+'.png';a.href=data;a.click();toast('現在の3D画面を保存しました')}catch(error){toast('画像を保存できませんでした。端末のスクリーンショットをお使いください。')}};
controls.addEventListener('start',()=>{cameraMove=null});controls.addEventListener('change',()=>{needsFrame=true});
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();running=false;window.sceneFailed('3D描画が一時的に停止しました。他のタブを閉じ、再読み込みしてください。')});
let resizeTimer;addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();quality();state.floor==='all'?fullView(true):floorView()},100)});

quality();lighting(true);fullView(true);updateClip();
let running=true,last=performance.now(),lastRender=0,labelsAt=0;
function animate(now){
  requestAnimationFrame(animate);if(!running||document.hidden)return;
  const dt=Math.min((now-last)/1000,.05);last=now;
  if(cameraMove){cameraMove.t+=dt;const t=Math.min(1,cameraMove.t/.95),s=t*t*(3-2*t);camera.position.lerpVectors(cameraMove.from,cameraMove.to,s);controls.target.lerpVectors(cameraMove.fromTarget,cameraMove.toTarget,s);if(t===1)cameraMove=null;needsFrame=true}
  controls.update(dt);
  if(!reduced){
    for(let i=0;i<snowCount;i++){const j=i*3;snowPos[j+1]-=snowSpeed[i]*dt;if(snowPos[j+1]<-1)snowPos[j+1]=48;snowPos[j]+=Math.sin(now*.00015+i)*.025*dt}
    snowGeo.attributes.position.needsUpdate=true;
  }
  const fps=activeQuality==='high'?60:30;
  if(now-lastRender<1000/fps)return;
  if(needsFrame||!reduced||controls.autoRotate){composer.render();lastRender=now;needsFrame=false}
  if(now-labelsAt>90){updateLabels();labelsAt=now}
}
document.addEventListener('gesturestart',e=>e.preventDefault());
document.addEventListener('visibilitychange',()=>{last=performance.now();needsFrame=true});
// Log only non-sensitive scene statistics, useful when comparing real devices.
let meshes=0,triangles=0;scene.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1)}});
console.info('Glass tower ready',{floors:building.floors.length,rooms:building.anchors.length,trees:landscape.treeCount,meshes,triangles:Math.round(triangles)});
composer.render();$('loading').hidden=true;requestAnimationFrame(animate);
}
