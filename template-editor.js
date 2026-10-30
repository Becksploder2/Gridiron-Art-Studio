const $t=id=>document.getElementById(id);
const cv=$t('templateCanvas'),ctx=cv.getContext('2d',{willReadFrequently:true});
let baseImage=null,logoImage=null,logo={x:420,y:270,w:180,h:180},drag=null,original=null;
function loadImage(data){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=data})}
async function chooseImage(target){const file=await window.studio.chooseReference();if(!file)return;const im=await loadImage('data:'+file.mime+';base64,'+file.base64);if(target==='template'){baseImage=im;original=null;$t('templateName').textContent=file.name;resetTemplate()}else{logoImage=im;logo.w=180;logo.h=180*im.height/im.width;logo.x=420;logo.y=270;renderTemplate()}}
function resetTemplate(){if(!baseImage)return;ctx.clearRect(0,0,1024,1024);ctx.drawImage(baseImage,0,0,1024,1024);original=ctx.getImageData(0,0,1024,1024);renderTemplate()}
function colorRgb(hex){const v=parseInt(hex.slice(1),16);return [(v>>16)&255,(v>>8)&255,v&255]}
function applyColors(){if(!original)return;const pixels=new ImageData(new Uint8ClampedArray(original.data),1024,1024);const data=pixels.data,source=colorRgb($t('sourceColor').value),target=colorRgb($t('targetColor').value),tol=Number($t('tolerance').value);for(let i=0;i<data.length;i+=4){const dr=data[i]-source[0],dg=data[i+1]-source[1],db=data[i+2]-source[2],dist=Math.sqrt(dr*dr+dg*dg+db*db);if(dist<=tol){const blend=Math.min(1,(tol-dist+10)/25);for(let c=0;c<3;c++)data[i+c]=Math.round(data[i+c]*(1-blend)+target[c]*blend)}}ctx.putImageData(pixels,0,0);const copy=document.createElement('canvas');copy.width=1024;copy.height=1024;copy.getContext('2d').drawImage(cv,0,0);baseImage=copy;renderTemplate()}
function renderTemplate(){if(!baseImage)return;ctx.clearRect(0,0,1024,1024);ctx.drawImage(baseImage,0,0,1024,1024);if(logoImage){ctx.drawImage(logoImage,logo.x,logo.y,logo.w,logo.h)}}
function canvasPoint(e){const r=cv.getBoundingClientRect();return{x:(e.clientX-r.left)*1024/r.width,y:(e.clientY-r.top)*1024/r.height}}
cv.addEventListener('pointerdown',e=>{if(!logoImage)return;const p=canvasPoint(e);if(p.x>=logo.x&&p.x<=logo.x+logo.w&&p.y>=logo.y&&p.y<=logo.y+logo.h){drag={dx:p.x-logo.x,dy:p.y-logo.y};cv.setPointerCapture(e.pointerId)}});
cv.addEventListener('pointermove',e=>{if(!drag)return;const p=canvasPoint(e);logo.x=Math.round(p.x-drag.dx);logo.y=Math.round(p.y-drag.dy);renderTemplate()});
cv.addEventListener('pointerup',()=>drag=null);
$t('logoScale').oninput=e=>{if(!logoImage)return;const cx=logo.x+logo.w/2,cy=logo.y+logo.h/2;logo.w=Number(e.target.value);logo.h=logo.w*logoImage.height/logoImage.width;logo.x=cx-logo.w/2;logo.y=cy-logo.h/2;renderTemplate()};
$t('openTemplate').onclick=()=>chooseImage('template');
$t('openLogo').onclick=()=>chooseImage('logo');
$t('recolorTemplate').onclick=()=>{if(!baseImage){$t('templateStatus').textContent='Upload a uniform texture first.';return}applyColors();$t('templateStatus').textContent='Color applied. Original UV layout preserved.'};
$t('resetTemplate').onclick=()=>{if(original){ctx.putImageData(original,0,0);const c=document.createElement('canvas');c.width=1024;c.height=1024;c.getContext('2d').drawImage(cv,0,0);baseImage=c;renderTemplate()}};
$t('exportTemplate').onclick=async()=>{if(!baseImage)return;$t('templateStatus').textContent='Saving PNG…';renderTemplate();const png=cv.toDataURL('image/png').split(',')[1];const file=await window.studio.save(png,'axis-uniform-1024x1024');$t('templateStatus').textContent=file?'Saved 1024 × 1024 PNG: '+file:'Save canceled'};
