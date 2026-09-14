import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export function randomSource(seed=63231){let x=seed;return()=>{x|=0;x=x+0x6D2B79F5|0;let t=Math.imul(x^x>>>15,1|x);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

export function createLandscape(scene,M){
  const rand=randomSource(),group=new THREE.Group();group.name='冬の森';scene.add(group);
  const mesh=(g,m)=>{const o=new THREE.Mesh(g,m);o.receiveShadow=true;group.add(o);return o};
  // A genuine hole exposes B1 in section without slicing away the entire landscape.
  const g=new THREE.RingGeometry(13.1,180,160,36).rotateX(-Math.PI/2);
  const p=g.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),r=Math.hypot(x,z),fade=Math.min(1,Math.max(0,(r-13.1)/9));
    const hill=(Math.sin(x*.075+z*.025)*1.8+Math.cos(z*.057)*1.4+Math.sin(x*.23)*Math.cos(z*.17)*.25);
    p.setY(i,-.12+hill*fade);
  }g.computeVertexNormals();const ground=mesh(g,M.snow);ground.name='雪面';
  // Snow banks beside the approaching path and around the foundation.
  for(let i=0;i<18;i++){
    const a=.36+i*(Math.PI*2-.72)/18,r=13.25+rand()*2.2;
    const drift=mesh(new THREE.SphereGeometry(1,18,10),M.snow);
    drift.position.set(Math.cos(a)*r,-.17,Math.sin(a)*r);drift.scale.set(1.3+rand()*1.5,.25+rand()*.35,1.1+rand()*1.6);
  }
  // A dark, lightly frosted approach anchors the building to the terrain.
  const path=new THREE.Mesh(new THREE.PlaneGeometry(31,3.7,32,4).rotateX(-Math.PI/2),M.path);
  path.position.set(28.5,-.07,0);path.receiveShadow=true;group.add(path);
  const curbGeo=new THREE.BoxGeometry(1.16,.13,.12),curbParts=[];
  for(let j=0;j<26;j++)for(const z of [-1.98,1.98]){const c=curbGeo.clone();c.translate(14+j*1.13,.02,z);curbParts.push(c)}
  mesh(mergeGeometries(curbParts),M.stone);curbParts.forEach(g=>g.dispose());curbGeo.dispose();
  const lamps=[];
  for(let j=0;j<6;j++)for(const z of [-2.1,2.1]){
    const x=15.5+j*4.15;
    const post=mesh(new THREE.CylinderGeometry(.055,.065,.65,8),M.metal);post.position.set(x,.31,z);
    const cap=mesh(new THREE.CylinderGeometry(.105,.105,.075,12),M.glow);cap.position.set(x,.61,z);lamps.push(cap);
    const pool=new THREE.Mesh(new THREE.PlaneGeometry(2.4,2.4).rotateX(-Math.PI/2),M.pool);pool.position.set(x,-.052,z);pool.renderOrder=2;group.add(pool);lamps.push(pool);
  }
  // Jagged branch whorls give the pines layered silhouettes and dark undersides.
  function pineGeometry(snow){
    const positions=[];
    function tri(a,b,c){positions.push(...a,...b,...c)}
    for(let tier=0;tier<13;tier++){
      const h=.12+tier*.062,base=(1-h)*.27;
      const count=18;
      for(let k=0;k<count;k++){
        const a=(k/count)*Math.PI*2+tier*.72,b=((k+1)/count)*Math.PI*2+tier*.72;
        const ra=base*(.68+rand()*.52),rb=base*(.68+rand()*.52),off=snow?.008:0;
        const top=[0,h+.19+off,0],pa=[Math.cos(a)*ra,h+off-(k%2)*.045,Math.sin(a)*ra],pb=[Math.cos(b)*rb,h+off-((k+1)%2)*.045,Math.sin(b)*rb];
        if(snow){const inset=.26+rand()*.30;tri(top,pb.map((v,i)=>v*(1-inset)+top[i]*inset),pa.map((v,i)=>v*(1-inset)+top[i]*inset))}
        else{tri(top,pb,pa);tri([0,h-.035,0],pa,pb)}
      }
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();return geo;
  }
  const treePositions=[];
  for(let i=0;i<120;i++){
    const a=rand()*Math.PI*2,r=24+Math.pow(rand(),.63)*91;
    if(Math.abs(Math.sin(a)*r)<5 && Math.cos(a)>0)continue;
    const x=Math.cos(a)*r,z=Math.sin(a)*r;
    // Keep the hero's foreground uncluttered while retaining near silhouettes.
    if(x>4&&z>4&&r<37)continue;
    const y=-.12+Math.sin(x*.075+z*.025)*1.8+Math.cos(z*.057)*1.4+Math.sin(x*.23)*Math.cos(z*.17)*.25;
    treePositions.push({x,z,y,h:5.2+rand()*8.7,rot:rand()*6.28});
  }
  const dummy=new THREE.Object3D();
  for(const [geo,mat] of [[pineGeometry(false),M.needles],[pineGeometry(true),M.treeSnow],[new THREE.CylinderGeometry(.008,.024,.75,7).translate(0,.33,0),M.bark]]){
    const forest=new THREE.InstancedMesh(geo,mat,treePositions.length);forest.castShadow=true;forest.receiveShadow=true;
    treePositions.forEach((t,i)=>{dummy.position.set(t.x,t.y,t.z);dummy.rotation.set(0,t.rot,0);dummy.scale.set(t.h,t.h,t.h);dummy.updateMatrix();forest.setMatrixAt(i,dummy.matrix)});
    forest.instanceMatrix.needsUpdate=true;forest.computeBoundingSphere();group.add(forest);
  }
  // Distant ridgelines, not a flat backdrop: depth comes from height, fog and light.
  const mountainMaterials=[];
  for(let layer=0;layer<3;layer++){
    const pos=[],idx=[],n=120,r=125+layer*40;
    for(let i=0;i<=n;i++){
      const a=i/n*Math.PI*2;
      const peak=8+layer*6+Math.pow(Math.sin(a*3+layer)+Math.sin(a*7-.5)*.5,2)*5;
      pos.push(Math.cos(a)*r,-3,Math.sin(a)*r,Math.cos(a)*r,peak,Math.sin(a)*r);
      if(i<n){const j=i*2;idx.push(j,j+1,j+3,j,j+3,j+2)}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();
    const mat=new THREE.MeshBasicMaterial({color:[0x5a738c,0x72869c,0x8b9aab][layer],side:THREE.DoubleSide,fog:true});mountainMaterials.push(mat);mesh(geo,mat);
  }
  return {group,lamps,mountainMaterials,treeCount:treePositions.length};
}
