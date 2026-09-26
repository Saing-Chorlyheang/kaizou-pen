import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

const files={
 '90d2d096-5eb2-474c-a843-17aab0d5e26c':'isuk-emboss-v3',
 'ec049e7c-d2b8-4ee1-8a1f-cef8b626ef0e':'menowa-emboss',
 '372bfab2-8d3b-4fd1-8e2d-0f9989f226d2':'menowa-mod',
 '08a59381-2d25-4cd6-a306-19576c90bea4':'ivan-mod',
 '66791c9e-bcce-4721-9cb1-877fd43a8273':'menowa-st',
 '9964810e-bac9-460f-a29b-1d2353b81542':'ppm-mod'
};
const loader=new GLTFLoader(), cache=new Map();
export const hasProductModel=p=>!!files[p.id];
export function mountProductModel(container,product,{compact=false}={}){
 if(!hasProductModel(product))return ()=>{};
 let disposed=false,raf=0,visible=true,renderer,controls,ro,observer,env;
 const scene=new THREE.Scene();
 const wrap=document.createElement('div');wrap.className='product-model-view';
 const canvas=document.createElement('canvas');canvas.setAttribute('aria-label',`${product.name}: drag to rotate; arrow keys to rotate; plus and minus to zoom`);canvas.tabIndex=0;
 const hint=document.createElement('span');hint.className='product-model-hint';hint.textContent='Loading 3D…';
 wrap.append(canvas,hint);container.append(wrap);
 function cleanup(){disposed=true;cancelAnimationFrame(raf);ro?.disconnect();observer?.disconnect();controls?.dispose();env?.dispose();renderer?.dispose();renderer?.forceContextLoss();wrap.remove();}
 try{
 renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0,0);renderer.toneMapping=THREE.ACESFilmicToneMapping;
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();env=pmrem.fromScene(room,.04);scene.environment=env.texture;room.dispose();pmrem.dispose();
 const light=new THREE.DirectionalLight(0xffffff,2.4);light.position.set(1,2,3);scene.add(light,new THREE.HemisphereLight(0xffffff,0x969aa5,1.8));
 const camera=new THREE.PerspectiveCamera(30,1,.001,10);
 controls=new OrbitControls(camera,canvas);controls.enablePan=false;controls.enableDamping=true;controls.enableZoom=!compact;controls.autoRotate=false;
 const size=()=>{const w=wrap.clientWidth,h=wrap.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;const d=Math.max(.32,.29/(2*Math.tan(Math.PI/12)*camera.aspect));camera.position.set(0,.02,d);controls.minDistance=d*.65;controls.maxDistance=d*2;camera.updateProjectionMatrix();controls.update();};
 ro=new ResizeObserver(size);ro.observe(wrap);size();
 observer=new IntersectionObserver(e=>{visible=e[0].isIntersecting;});observer.observe(wrap);
 let start;
 canvas.addEventListener('pointerdown',e=>{start=[e.clientX,e.clientY];e.stopPropagation();});
 canvas.addEventListener('click',e=>{e.stopPropagation();if(compact&&start&&Math.hypot(e.clientX-start[0],e.clientY-start[1])<5)window.openPdp?.(product.id);});
 canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Enter'].includes(e.key)){e.preventDefault();e.stopPropagation();if(e.key==='Enter'&&compact)window.openPdp?.(product.id);else if(e.key==='+'||e.key==='-')camera.position.multiplyScalar(e.key==='+'?.9:1.1);else {const axis=e.key==='ArrowUp'||e.key==='ArrowDown'?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0);camera.position.applyAxisAngle(axis,e.key==='ArrowLeft'||e.key==='ArrowUp'?.15:-.15);}controls.update();}});
 const url=new URL(`models/${files[product.id]}.glb`,import.meta.url).href;
 if(!cache.has(url))cache.set(url,loader.loadAsync(url).catch(err=>{cache.delete(url);throw err;}));
 cache.get(url).then(gltf=>{if(disposed)return;const model=gltf.scene.clone(true);model.rotation.z=.24;scene.add(model);hint.textContent='Drag to rotate · 3D';wrap.dataset.loaded='true';}).catch(err=>{if(disposed)return;console.warn('Product model unavailable',err);cleanup();});
 const draw=()=>{if(disposed)return;raf=requestAnimationFrame(draw);if(visible&&!document.hidden){controls.update();renderer.render(scene,camera);}};draw();
 }catch(err){console.warn('Product 3D unavailable',err);cleanup();}
 return cleanup;
}

let cardCleanups=[];
export function mountProductCards(products){cardCleanups.forEach(fn=>fn());cardCleanups=[];for(const card of document.querySelectorAll('.product-card')){const product=products.find(p=>p.id===card.dataset.id);if(product&&hasProductModel(product))cardCleanups.push(mountProductModel(card.querySelector('.product-img'),product,{compact:true}));}}
