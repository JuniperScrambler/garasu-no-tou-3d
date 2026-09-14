import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// These are illustrative proportions, not a measured architectural survey.
// One continuous radius function is shared by slabs, walls, windows and rooms.
export const H = 3.2;
export const FLOORS = [-1,1,2,3,4,5,6,7,8,9,10,11];
export const TOP = 39.2;
export const yFloor = f => f < 0 ? -H : (f - 1) * H;
export function radius(y){
  if(y < 0) return 12 - y * .28;
  if(y <= 32) return 12 - y * (8.8 / 32);
  if(y <= 35.2) return 3.2 - (y - 32) * .22;
  return Math.max(.02, 2.496 * (1 - (y - 35.2) / (TOP - 35.2)));
}
export const SPACES = [
  [-1,'メインキッチン',225,110,'kitchen'],[-1,'倉庫',315,62,'storage'],[-1,'冷凍室',45,48,'storage'],[-1,'発電室',90,40,'service'],
  [1,'正面玄関',0,24,'entry'],[1,'廊下',0,34,'corridor'],[1,'ホール',42,28,'hall'],[1,'遊戯室',90,76,'play'],[1,'シアター',180,64,'theater'],[1,'サブキッチン',236,44,'kitchen'],[1,'ダイニング',310,75,'dining'],
  [2,'玖の部屋',135,90,'guest'],[2,'拾の部屋',225,90,'guest'],[3,'捌の部屋',225,106,'guest'],[4,'漆の部屋',45,106,'guest'],[5,'陸の部屋',0,106,'guest'],[6,'伍の部屋',135,106,'guest'],[7,'肆の部屋',135,106,'guest'],[8,'参の部屋',45,106,'guest'],[9,'弐の部屋',0,106,'guest'],[10,'壱の部屋',0,106,'guest'],[11,'展望室',60,360,'observatory'],[11,'階段室',-35,50,'stair']
].map(([floor,name,az,span,kind])=>({floor,name,az,span,kind}));
const D = Math.PI / 180;
const V = (r,y,a) => new THREE.Vector3(r*Math.cos(a),y,r*Math.sin(a));

export function annulus(ri,ro,y,thickness,segments=80,start=0,span=Math.PI*2){
  if(!(ro>ri && ri>=0 && thickness>0)) throw new Error(`Invalid ring: ${ri}, ${ro}, ${thickness}`);
  const p=[];const idx=[];
  for(let i=0;i<=segments;i++){
    const a=start+span*i/segments,c=Math.cos(a),s=Math.sin(a);
    p.push(ri*c,y,ri*s,ro*c,y,ro*s,ri*c,y+thickness,ri*s,ro*c,y+thickness,ro*s);
    if(i<segments){const n=i*4;idx.push(n,n+5,n+1,n,n+4,n+5,n+2,n+3,n+7,n+2,n+7,n+6,n,n+2,n+6,n,n+6,n+4,n+1,n+5,n+7,n+1,n+7,n+3)}
  }
  const last=segments*4;idx.push(0,1,3,0,3,2,last,last+2,last+3,last,last+3,last+1);
  for(let i=0;i<idx.length;i+=3){const n=idx[i+1];idx[i+1]=idx[i+2];idx[i+2]=n}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return g;
}

export function createArchitecture(M){
  const root=new THREE.Group();root.name='硝子館';
  const floors=[],anchors=[],glass=[],lights=[],metrics={roomCount:SPACES.length,invalidRings:0};
  let batches=new Map();
  function push(geo,mat){
    // Non-indexed geometries with identical attributes can be merged safely.
    const g=geo.index?geo.toNonIndexed():geo;
    for(const key of Object.keys(g.attributes))if(!['position','normal','uv'].includes(key))g.deleteAttribute(key);
    if(!g.attributes.uv){const p=g.attributes.position,uv=[];for(let i=0;i<p.count;i++)uv.push(p.getX(i)/3,p.getZ(i)/3);g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2))}
    if(!g.attributes.normal)g.computeVertexNormals();
    if(!batches.has(mat))batches.set(mat,[]);batches.get(mat).push(g);
    if(g!==geo)geo.dispose();
  }
  function flush(parent){
    for(const [mat,geos] of batches){
      const merged=mergeGeometries(geos,false);if(!merged)throw new Error('Geometry merge failed');
      merged.computeBoundingSphere();
      const mesh=new THREE.Mesh(merged,mat);mesh.castShadow=!mat.transparent && mat!==M.glow;mesh.receiveShadow=!mat.transparent;
      parent.add(mesh);geos.forEach(g=>g.dispose());
    }batches=new Map();
  }
  function box(x,y,z,w,h,d,mat,angle=0,bevel=false){
    const geo=new THREE.BoxGeometry(w,h,d);geo.rotateY(angle);geo.translate(x,y,z);push(geo,mat);
  }
  function rod(a,b,r,mat,segments=6){
    const dir=b.clone().sub(a),geo=new THREE.CylinderGeometry(r,r,dir.length(),segments);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize()));
    geo.translate((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);push(geo,mat);
  }
  function round(r,y,height,mat,x=0,z=0){const g=new THREE.CylinderGeometry(r,r,height,28);g.translate(x,y,z);push(g,mat)}
  function arc(r,y,start,span,tube,mat){
    const path=new THREE.CatmullRomCurve3(Array.from({length:49},(_,i)=>V(r,y,start+span*i/48)));
    push(new THREE.TubeGeometry(path,48,tube,5,false),mat);
  }
  function placeFurniture(fi,sp,outer){
    const a=sp.az*D;const base=yFloor(fi)+.22;
    const usable=Math.max(.44,outer-2.3);const rr=2.3+usable*.56;
    const scale=Math.min(1,usable/1.55);const pos=V(rr,base,a);
    function b(u,v,w,sx,sy,sz,mat,rot=0){const x=pos.x+(u*Math.cos(a)-w*Math.sin(a))*scale,z=pos.z+(u*Math.sin(a)+w*Math.cos(a))*scale;box(x,base+v*scale,z,sx*scale,sy*scale,sz*scale,mat,-a+rot)}
    function table(u,w,r=.5){const p=V(1,0,a);const x=pos.x+(u*Math.cos(a)-w*Math.sin(a))*scale,z=pos.z+(u*Math.sin(a)+w*Math.cos(a))*scale;round(r*scale,base+.74*scale,.07*scale,M.wood,x,z);round(.065*scale,base+.36*scale,.72*scale,M.metal,x,z);round(.3*scale,base+.04*scale,.04*scale,M.metal,x,z)}
    function chair(u,w,rot=0){b(u,.44,w,.65,.15,.64,M.fabric,rot);b(u+.24*Math.cos(rot),.76,w+.24*Math.sin(-rot),.15,.58,.66,M.fabric,rot);for(const du of [-.22,.22])for(const dz of [-.22,.22])b(u+du,.21,w+dz,.035,.4,.035,M.metal)}
    function rug(sx,sz){b(0,.012,0,sx,.016,sz,M.rug)}
    function lamp(u,w){b(u,.76,w,.045,1.5,.045,M.brass);b(u,.05,w,.36,.06,.36,M.metal);b(u,1.44,w,.46,.34,.46,M.shade);b(u,1.29,w,.37,.015,.37,M.glow)}
    if(sp.kind==='guest'){
      rug(1.85,3.7);b(-.15,.2,0,1.35,.35,2.1,M.wood);b(-.15,.47,0,1.31,.23,2.02,M.linen);b(-.15,.65,-.92,1.38,.64,.12,M.fabric);b(-.15,.63,-.58,.95,.16,.4,M.linen);b(-.15,.61,.43,1.33,.055,.93,M.blanket);b(.85,.38,-.5,.44,.75,.5,M.wood);lamp(.86,-.5);table(.05,2.1,.4);chair(.1,2.8);b(-.1,.9,-2.1,.8,1.8,.46,M.wood);
    } else if(sp.kind==='dining'){
      rug(3,5.5);b(0,.76,0,1.1,.09,3.7,M.wood);for(const w of [-1.2,0,1.2]){chair(-1.05,w,Math.PI);chair(1.05,w)}for(const z of [-1.5,1.5])b(0,.37,z,.64,.72,.08,M.metal);
      for(const z of [-1.2,0,1.2]){b(0,2.13,z,.026,1.1,.026,M.metal);b(0,1.68,z,.4,.18,.4,M.brass);b(0,1.58,z,.34,.025,.34,M.glow)}
    }else if(sp.kind==='kitchen'){
      for(let i=-2;i<=2;i++){b(.6,.48,i*.68,.72,.94,.66,M.wood);b(.6,.98,i*.68,.78,.07,.67,M.stone);b(.23,.66,i*.68,.025,.03,.36,M.brass)}b(-1,.48,0,.95,.94,2.3,M.stone);b(-1,.99,0,1.03,.05,2.4,M.metal);
    }else if(sp.kind==='theater'){
      b(.9,1.3,0,.12,1.6,3.9,M.metal);b(.81,1.3,0,.014,1.4,3.65,M.screen);for(const u of [-1.6,-.3])for(const z of [-1.1,0,1.1])chair(u,z,Math.PI);
    }else if(sp.kind==='play'){
      rug(2.5,4.2);b(0,.65,0,1.5,.22,2.6,M.wood);b(0,.78,0,1.35,.03,2.45,M.felt);for(const x of [-.53,.53])for(const z of [-1,1])b(x,.3,z,.13,.6,.13,M.wood);lamp(1.3,1.8);
    }else if(['storage','service'].includes(sp.kind)){
      for(let z=-2;z<=2;z++){b(.4,1,z*.75,.7,2,.6,M.metal);for(let j=0;j<3;j++)b(0,.35+j*.6,z*.75,.15,.46,.46,M.stone)}
    }else if(sp.kind==='hall'){
      rug(2.3,3);b(0,.4,0,.8,.42,2.6,M.fabric);b(.3,.7,0,.24,.58,2.7,M.fabric);table(-1,0,.55);lamp(.4,1.7);
    }
  }
  for(const fi of FLOORS){
    const group=new THREE.Group();group.name=fi<0?'B1':fi+'F';group.userData.floor=fi;root.add(group);floors.push(group);
    const y=yFloor(fi),R=radius(y),rt=radius(y+H-.25),ri=1.54;
    push(annulus(ri,R-.09,y,.2),M.stone);
    push(annulus(ri,R-.24,y+.203,.023),fi<0?M.serviceFloor:M.woodFloor);
    push(annulus(1.54,Math.min(2.28,R-.35),y+.226,.012),M.corridor);
    // Narrow inlays supply scale without an opaque room-sized volume.
    for(let i=0;i<36;i++){
      const a=i*Math.PI/18;
      rod(V(2.32,y+.235,a),V(R-.3,y+.235,a),.008,M.floorSeam,4);
    }
    round(.52,y+H*.5,H,M.core);
    for(let s=0;s<24;s++){
      const a=(s/24)*Math.PI*2;const sy=y+(s+1)*H/24;
      push(annulus(.54,1.46,sy-.11,.105,4,a-.012,Math.PI/12+.014),M.stair);
      if(s%2===0)rod(V(1.44,sy,a),V(1.44,sy+.88,a),.015,M.brass);
    }
    const handPath=new THREE.CatmullRomCurve3(Array.from({length:73},(_,i)=>V(1.44,y+i/72*H+.88,i/72*Math.PI*2)));
    push(new THREE.TubeGeometry(handPath,72,.028,6,false),M.brass);
    for(let j=0;j<12;j++){
      const a=j*Math.PI/6;
      // Columns sit inside the roof's radius, so they cannot pierce the glass.
      rod(V(radius(y)-.34,y+.2,a),V(rt-.34,y+H-.18,a),.047,M.metal);
    }
    if(fi<0){push(annulus(R-.22,R,y,H,80),M.foundation)}
    for(const sp of SPACES.filter(s=>s.floor===fi)){
      const a=sp.az*D,span=sp.span*D,outer=rt-.24;
      const labelR=['entry'].includes(sp.kind)?R*.9:sp.kind==='stair'?1.05:Math.max(1.7,(2.28+outer)*.5);
      anchors.push({name:sp.name,floor:fi,pos:V(labelR,y+1.25,a)});
      if(!['entry','corridor','hall','observatory','stair'].includes(sp.kind)){
        // Walls stop before the exterior mullions. No intersecting room volumes.
        for(const aa of [a-span/2,a+span/2]){
          const len=Math.max(.1,outer-2.35),mid=2.35+len/2;
          box(Math.cos(aa)*mid,y+1.56,Math.sin(aa)*mid,len,2.68,.10,M.plaster,-aa);
          rod(V(2.37,y+.29,aa),V(outer,y+.29,aa),.027,M.wood);
        }
        // Two curved wall sections leave an actual doorway at the centre.
        const doorAngle=Math.min(.23,span*.2);
        push(annulus(2.28,2.38,y+.23,2.66,18,a-span/2,span/2-doorAngle),M.plaster);
        push(annulus(2.28,2.38,y+.23,2.66,18,a+doorAngle,span/2-doorAngle),M.plaster);
        for(const aa of [a-doorAngle,a+doorAngle])rod(V(2.31,y+.24,aa),V(2.31,y+2.44,aa),.024,M.wood);
        arc(2.33,y+2.44,a-doorAngle,doorAngle*2,.031,M.wood);
        placeFurniture(fi,sp,outer);
      }else if(sp.kind==='hall'){placeFurniture(fi,sp,outer)}
    }
    if(fi===11){
      for(let j=0;j<6;j++){
        const a=j*Math.PI/3+.2,r=2.24;
        round(.25,y+.88,.04,M.wood,Math.cos(a)*r,Math.sin(a)*r);
        rod(V(r,y+.22,a),V(r,y+.87,a),.03,M.metal);
      }
    }
    // Soft architectural coves are geometries, not expensive per-floor shadow lights.
    if(fi>0){arc(rt-.23,y+H-.24,0,Math.PI*2,.021,M.glow);arc(2.14,y+2.96,0,Math.PI*2,.015,M.glow)}
    flush(group);
    // A separate ceiling is hidden when an individual floor is inspected.
    const ceiling=new THREE.Mesh(annulus(1.54,rt-.13,y+H-.20,.11),M.ceiling);ceiling.userData.ceiling=true;ceiling.castShadow=true;ceiling.receiveShadow=true;group.add(ceiling);
    if(fi>0){
      const facade=new THREE.Group();facade.userData.facade=true;group.add(facade);
      const pts=[new THREE.Vector2(radius(y+.22)-.04,y+.22),new THREE.Vector2(radius(y+H-.12)-.04,y+H-.12)];
      const glazing=new THREE.Mesh(new THREE.LatheGeometry(pts,96),M.glass);glazing.renderOrder=5;facade.add(glazing);glass.push(glazing);
      for(let i=0;i<28;i++){
        const a=i*Math.PI*2/28;
        rod(V(radius(y+.15),y+.15,a),V(radius(y+H-.04),y+H-.04,a),.032,M.mullion);
        if(i%2===0)rod(V(radius(y+.15)-.02,y+.15,a),V(radius(y+H-.04)-.02,y+H-.04,a),.009,M.brass);
      }
      arc(radius(y+.1),y+.1,0,Math.PI*2,.053,M.mullion);
      arc(radius(y+H-.12),y+H-.12,0,Math.PI*2,.048,M.mullion);
      // Snow settles on the narrow horizontal rim, never on the vertical glass.
      push(annulus(radius(y)+.01,radius(y)+.15,y+.055,.036),M.snow);
      flush(facade);
    }
  }
  const roof=new THREE.Group();roof.userData.floor=11;roof.userData.roof=true;root.add(roof);
  const roofGlass=new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(2.496,35.2),new THREE.Vector2(.015,TOP)],56),M.glass);roofGlass.renderOrder=6;roof.add(roofGlass);glass.push(roofGlass);
  for(let i=0;i<28;i++){const a=i*Math.PI*2/28;rod(V(2.496,35.2,a),V(.015,TOP,a),.025,M.mullion)}
  arc(2.496,35.2,0,Math.PI*2,.047,M.mullion);flush(roof);
  const entrance=new THREE.Group();entrance.userData.floor=1;root.add(entrance);
  // The original entrance axis is +X.
  box(12.6,.11,0,3.5,.22,4.3,M.stone);box(12.9,-.04,0,4.1,.12,4.9,M.stone);
  box(12.25,2.7,0,2.4,.13,3.35,M.metal);box(12.25,2.62,0,2.15,.035,3.1,M.glow);
  for(const z of [-1.46,1.46]){rod(new THREE.Vector3(13.27,.22,z),new THREE.Vector3(13.27,2.65,z),.042,M.mullion);box(11.67,1.35,z,.08,2.5,.10,M.mullion)}
  box(11.65,1.35,0,.07,2.5,.06,M.brass);box(11.7,1.15,.22,.055,.55,.025,M.brass);box(11.7,1.15,-.22,.055,.55,.025,M.brass);
  flush(entrance);
  root.updateMatrixWorld(true);
  return {root,floors,roof,entrance,anchors,glass,metrics};
}
