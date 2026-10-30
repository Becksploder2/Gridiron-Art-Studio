const $=id=>document.getElementById(id);let reference=null,current=null,busy=false,requirements=[],approved=new Set();
function extractRequirements(prompt,revision=''){return (prompt+'\n'+revision).split(/(?:[\n;]+|(?<=[.!?])\s+|,\s+(?=(?:and\s+)?(?:no\s+|with\s+|without\s+|include\s+|add\s+|place\s+|use\s+|make\s+|remove\s+|exactly\s+)))/i).map(x=>x.trim()).filter(Boolean)}
function renderRequirements(){const root=$('requirementsList');root.replaceChildren();requirements.forEach((r,i)=>{const label=document.createElement('label');label.style.display='block';label.style.margin='6px 0';const cb=document.createElement('input');cb.type='checkbox';cb.checked=approved.has(i);cb.onchange=()=>{cb.checked?approved.add(i):approved.delete(i);updateApproval()};label.append(cb,document.createTextNode(' '+r));root.append(label)});updateApproval()}
function updateApproval(){const remaining=requirements.length-approved.size;$('accuracyStatus').textContent=remaining?remaining+' requirement(s) awaiting visual verification. Export is locked.':'All listed requirements manually confirmed. Export enabled.';$('saveBtn').disabled=busy||!current||remaining>0}

function exportDimensions(){const axis=$('game').value==='Axis Football 27';const category=$('category').value;return {width:axis&&category==='Endzone'?1024:1024,height:axis&&category==='Endzone'?128:1024};}
async function sizedPng(source){const {width,height}=exportDimensions();const image=new Image();image.src='data:image/png;base64,'+source.base64;await image.decode();const scan=document.createElement('canvas');scan.width=image.naturalWidth;scan.height=image.naturalHeight;const sc=scan.getContext('2d',{willReadFrequently:true});sc.drawImage(image,0,0);const pixels=sc.getImageData(0,0,scan.width,scan.height).data;let left=scan.width,top=scan.height,right=-1,bottom=-1;for(let y=0;y<scan.height;y++){for(let x=0;x<scan.width;x++){if(pixels[(y*scan.width+x)*4+3]>12){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y)}}}if(right<0){left=0;top=0;right=scan.width-1;bottom=scan.height-1;}const cropWidth=right-left+1,cropHeight=bottom-top+1;const margin=0.04;const scale=Math.min(width*(1-2*margin)/cropWidth,height*(1-2*margin)/cropHeight);const drawWidth=cropWidth*scale,drawHeight=cropHeight*scale;const output=document.createElement('canvas');output.width=width;output.height=height;const ctx=output.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(scan,left,top,cropWidth,cropHeight,(width-drawWidth)/2,(height-drawHeight)/2,drawWidth,drawHeight);return output.toDataURL('image/png').split(',')[1];}

function status(message){$('status').textContent=message}
function setBusy(value){busy=value;$('generateBtn').disabled=value;$('reviseBtn').disabled=value;$('saveBtn').disabled=value||!current||approved.size!==requirements.length;$('generateBtn').textContent=value?'Generating image…':'✦ Generate Artwork'}
$('settingsBtn').onclick=()=>$('settingsDialog').showModal();
$('referenceBtn').onclick=async()=>{try{reference=await window.studio.chooseReference();if(reference){$('referenceLabel').textContent='Reference: '+reference.name;status('Reference imported; next generation will use it.')}}catch(e){status(e.message)}};
async function generate(revise){if(busy)return;if(revise&&/\b(text|lettering|word|words|spelling|name|font|caption|typography)\b/i.test($('revision').value)){status('Text-only revisions are protected from AI regeneration. Use the Text-Only Editor to change lettering without redrawing the mascot.');$('textEditor').hidden=false;return}const prompt=$('prompt').value.trim();if(!prompt){status('Please describe the artwork first.');return}if(revise&&!current){status('Generate an image before requesting a revision.');return}setBusy(true);status('Running local AI model. This may take several minutes…');try{const next=await window.studio.generate({category:$('category').value,game:$('game').value,prompt,reference:revise?null:reference,previous:revise?current:null,revision:revise?$('revision').value.trim():''});current=next;requirements=extractRequirements(prompt,revise?$('revision').value.trim():'');approved.clear();renderRequirements();$('result').src='data:image/png;base64,'+current.base64;$('result').hidden=false;$('placeholder').hidden=true;status('Artwork generated. Review every requirement before exporting; AI accuracy is not automatically verified.')}catch(e){status('Generation failed: '+e.message)}finally{setBusy(false)}}
$('generateBtn').onclick=()=>generate(false);$('reviseBtn').onclick=()=>generate(true);
$('saveBtn').onclick=async()=>{if(!current||approved.size!==requirements.length){status('Review and confirm every requirement before export.');return}try{const png=await sizedPng(current);const dims=exportDimensions();const file=await window.studio.save(png,($('game').value+'-'+$('category').value+'-'+dims.width+'x'+dims.height).toLowerCase().replace(/[^a-z0-9-]/g,'-'));if(file)status('Saved '+dims.width+'×'+dims.height+' PNG: '+file)}catch(e){status('Save failed: '+e.message)}};

$('engineBtn').onclick=async()=>{try{const p=await window.studio.chooseEngine();if(p)$('enginePath').textContent=p}catch(e){status(e.message)}};
$('modelBtn').onclick=async()=>{try{const p=await window.studio.chooseModel();if(p)$('modelPath').textContent=p}catch(e){status(e.message)}};
$('closeSetup').onclick=()=>$('settingsDialog').close();
window.studio.localStatus().then(s=>{if(s.engine)$('enginePath').textContent=s.engine;if(s.model)$('modelPath').textContent=s.model;if(s.engine&&s.model)status('Local AI configured. Ready to generate.')}).catch(()=>{});

$('installAiBtn').onclick=async()=>{const b=$('installAiBtn');b.disabled=true;$('installProgress').textContent='Starting download...';try{const s=await window.studio.installLocalAI();$('enginePath').textContent=s.engine;$('modelPath').textContent=s.model;status('Local AI installed. Ready to generate.');$('installProgress').textContent='Installation completed.'}catch(e){$('installProgress').textContent='Installation failed: '+e.message;status('Local AI installation failed: '+e.message)}finally{b.disabled=false}};
window.studio.onLocalProgress(p=>{$('installProgress').textContent=p.stage+': '+p.detail});

$('prompt').addEventListener('input',()=>{if(current){approved.clear();requirements=extractRequirements($('prompt').value);renderRequirements()}});
$('revision').addEventListener('input',()=>{if(current){approved.clear();requirements=extractRequirements($('prompt').value,$('revision').value);renderRequirements()}});

let editImage=null,selection=null,dragStart=null;
async function startTextEditor(){
 if(!current){status('Generate or import artwork before editing text.');return}
 const image=new Image();image.src='data:image/png;base64,'+current.base64;await image.decode();editImage=image;
 const c=$('textCanvas');c.width=image.naturalWidth;c.height=image.naturalHeight;
 c.getContext('2d').drawImage(image,0,0);selection=null;$('textEditor').hidden=false;
 status('Select the lettering rectangle, then type the replacement. Only that rectangle can change.');
}
function textCoordinates(e){const r=$('textCanvas').getBoundingClientRect();return {x:Math.round((e.clientX-r.left)*$('textCanvas').width/r.width),y:Math.round((e.clientY-r.top)*$('textCanvas').height/r.height)}}
function drawTextSelection(){const c=$('textCanvas'),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(editImage,0,0);if(selection){ctx.save();ctx.strokeStyle='#00e5ff';ctx.lineWidth=3;ctx.setLineDash([8,5]);ctx.strokeRect(selection.x,selection.y,selection.w,selection.h);ctx.restore()}}
$('textCanvas').addEventListener('pointerdown',e=>{if(!editImage)return;dragStart=textCoordinates(e);$('textCanvas').setPointerCapture(e.pointerId)});
$('textCanvas').addEventListener('pointermove',e=>{if(!dragStart)return;const p=textCoordinates(e);selection={x:Math.min(dragStart.x,p.x),y:Math.min(dragStart.y,p.y),w:Math.abs(p.x-dragStart.x),h:Math.abs(p.y-dragStart.y)};drawTextSelection()});
$('textCanvas').addEventListener('pointerup',()=>{dragStart=null});
$('openTextEditor').onclick=()=>startTextEditor().catch(e=>status(e.message));
$('cancelTextEdit').onclick=()=>{$('textEditor').hidden=true;selection=null};
$('applyTextEdit').onclick=async()=>{
 const text=$('replacementText').value.trim();
 if(!editImage||!selection||selection.w<10||selection.h<10||!text){status('Select a text region and enter replacement lettering.');return}
 const c=document.createElement('canvas');c.width=editImage.naturalWidth;c.height=editImage.naturalHeight;
 const ctx=c.getContext('2d');ctx.drawImage(editImage,0,0);
 const {x,y,w,h}=selection;
 ctx.fillStyle=$('textBackground').value;ctx.fillRect(x,y,w,h);
 ctx.fillStyle=$('textColor').value;ctx.textAlign='center';ctx.textBaseline='middle';
 let size=Math.min(h*.72,110);do{ctx.font='900 '+Math.floor(size)+'px Impact,Arial,sans-serif';if(ctx.measureText(text).width<=w*.94)break;size-=2}while(size>8);
 ctx.fillText(text,x+w/2,y+h/2,w*.94);
 current={base64:c.toDataURL('image/png').split(',')[1],mime:'image/png',name:'text-edited.png'};
 $('result').src='data:image/png;base64,'+current.base64;
 $('textEditor').hidden=true;requirements=extractRequirements($('prompt').value,'Replace selected lettering with '+text);approved.clear();renderRequirements();
 status('Text changed only inside your selected rectangle. Inspect the covered background and lettering before export.');
};
