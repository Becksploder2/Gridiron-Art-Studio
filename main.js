const {app,BrowserWindow,ipcMain,dialog,safeStorage}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {spawn}=require('node:child_process');
const https=require('node:https');
const AdmZip=require('adm-zip');
let win;
const settingsPath=()=>path.join(app.getPath('userData'),'settings.json');
async function getSettings(){try{return JSON.parse(await fs.readFile(settingsPath(),'utf8'))}catch{return {}}}
function makeWindow(){win=new BrowserWindow({width:1250,height:850,minWidth:940,minHeight:640,backgroundColor:'#101827',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});win.loadFile('index.html');win.removeMenu()}
app.whenReady().then(()=>{makeWindow();app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)makeWindow()})});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
ipcMain.handle('file:reference',async()=>{const o=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'Images',extensions:['png','jpg','jpeg','webp']}]});if(o.canceled||!o.filePaths[0])return null;const file=o.filePaths[0];const buf=await fs.readFile(file);if(buf.length>18*1024*1024)throw new Error('Reference image is too large (18 MB maximum).');const ext=path.extname(file).toLowerCase();const type=ext==='.png'?'image/png':ext==='.webp'?'image/webp':'image/jpeg';return {name:path.basename(file),mime:type,base64:buf.toString('base64')}});
ipcMain.handle('file:save',async(_,base64,name)=>{if(typeof base64!=='string'||base64.length>60_000_000)throw new Error('Invalid image');const o=await dialog.showSaveDialog(win,{defaultPath:(name||'gridiron-art')+'.png',filters:[{name:'PNG',extensions:['png']}]});if(o.canceled||!o.filePath)return null;await fs.writeFile(o.filePath,Buffer.from(base64,'base64'));return o.filePath});
const targets={Endzone:'Create ONLY standalone endzone lettering/graphics. NO grass, turf, football field, stadium, yard markings, perspective mockup, or background. Long horizontal composition, clean edges, transparent outside the design.',Logo:'Create a single professional football franchise logo or wordmark. Isolated flat artwork; NO merchandise, helmet, stadium, scene, or background. Crisp defined contours.',Helmet:'Create ONLY flat isolated helmet stripe DECAL ART suitable for placement on a helmet texture. No helmet object, no product mockup, no background. Crisp symmetrical stripe geometry.',Uniform:'Create ONLY isolated flat uniform graphics or stripe TEXTURE ART, not a person or clothing mockup. Crisp seamless stripe edges, no background.'};


const aiDir=()=>path.join(app.getPath('userData'),'local-ai');
const modelUrl='https://huggingface.co/Comfy-Org/stable-diffusion-v1-5-archive/resolve/main/v1-5-pruned-emaonly-fp16.safetensors';
function progress(stage,detail){if(win&&!win.isDestroyed())win.webContents.send('local:progress',{stage,detail})}
async function download(url,destination,depth=0){
 if(depth>7)throw new Error('Too many download redirects');
 const response=await fetch(url,{redirect:'follow',headers:{'User-Agent':'Gridiron-Art-Studio/0.3'}});
 if(!response.ok||!response.body)throw new Error('Download failed ('+response.status+'): '+url);
 const total=Number(response.headers.get('content-length'))||0;
 const file=await fs.open(destination,'w');let written=0;
 try{for await(const chunk of response.body){await file.write(chunk);written+=chunk.length;if(total)progress('Downloading',Math.round(written/total*100)+'% ('+Math.round(written/1048576)+' MB)');}}
 finally{await file.close()}
 if(written<1000000)throw new Error('Downloaded file is unexpectedly small.');
}
async function findEngine(root){
 const entries=await fs.readdir(root,{withFileTypes:true});
 for(const e of entries){const p=path.join(root,e.name);if(e.isDirectory()){const result=await findEngine(p);if(result)return result}else if(e.name.toLowerCase()===(process.platform==='win32'?'sd-cli.exe':'sd-cli'))return p}
 return null;
}
let installing=false;
ipcMain.handle('local:install',async()=>{
 if(installing)throw new Error('Installation is already running.');
 if(process.platform!=='win32')throw new Error('Automatic NVIDIA CUDA setup currently supports Windows only.');
 installing=true;
 const base=aiDir(),zipPath=path.join(base,'engine.zip'),modelPath=path.join(base,'v1-5-pruned-emaonly-fp16.safetensors');
 try{
  await fs.mkdir(base,{recursive:true});
  progress('Checking','Finding NVIDIA CUDA engine release...');
  const response=await fetch('https://api.github.com/repos/leejet/stable-diffusion.cpp/releases/latest',{headers:{'User-Agent':'Gridiron-Art-Studio/0.3','Accept':'application/vnd.github+json'}});
  if(!response.ok)throw new Error('Could not check engine releases ('+response.status+').');
  const release=await response.json();
  const candidates=(release.assets||[]).filter(a=>/\.zip$/i.test(a.name)&&/-bin-win-cuda12-x64\.zip$/i.test(a.name)&&!/^cudart-/i.test(a.name));
  if(!candidates.length)throw new Error('No Windows CUDA ZIP was found in the latest engine release. Automatic setup cannot proceed.');
  const asset=candidates[0];
  progress('Downloading','Downloading NVIDIA engine...');
  await download(asset.browser_download_url,zipPath);
  progress('Installing','Extracting engine...');
  const engineDir=path.join(base,'engine');await fs.mkdir(engineDir,{recursive:true});
  const archive=new AdmZip(zipPath);
  for(const entry of archive.getEntries()){if(entry.entryName.includes('..')||path.isAbsolute(entry.entryName))throw new Error('Unsafe archive entry');}
  archive.extractAllTo(engineDir,true);
  const runtime=(release.assets||[]).find(a=>/^cudart-sd-bin-win-cu12-x64\\.zip$/i.test(a.name));
  if(runtime){const runtimeZip=path.join(base,'cuda-runtime.zip');progress('Downloading','Downloading CUDA runtime...');await download(runtime.browser_download_url,runtimeZip);new AdmZip(runtimeZip).extractAllTo(engineDir,true);await fs.rm(runtimeZip,{force:true});}
  const engine=await findEngine(engineDir);
  if(!engine){const names=await fs.readdir(engineDir);throw new Error('Engine executable missing after extraction. Archive: '+asset.name+'. Extracted entries: '+names.slice(0,12).join(', '));}
  await fs.rm(zipPath,{force:true});
  if(!(await fs.stat(modelPath).catch(()=>null))?.size|| (await fs.stat(modelPath)).size<100000000){
   progress('Downloading','Downloading Stable Diffusion 1.5 model (several GB)...');
   await download(modelUrl,modelPath);
  }
  const s=await getSettings();s.engine=engine;s.model=modelPath;await fs.writeFile(settingsPath(),JSON.stringify(s));
  progress('Ready','Engine and model installed.');
  return {engine,model:modelPath};
 }catch(e){await fs.rm(zipPath,{force:true}).catch(()=>{});throw e}finally{installing=false}
});

ipcMain.handle('local:chooseEngine',async()=>{const r=await dialog.showOpenDialog(win,{title:'Select stable-diffusion.cpp executable',properties:['openFile']});if(r.canceled)return null;const s=await getSettings();s.engine=r.filePaths[0];await fs.writeFile(settingsPath(),JSON.stringify(s));return s.engine});
ipcMain.handle('local:chooseModel',async()=>{const r=await dialog.showOpenDialog(win,{title:'Select Stable Diffusion model',properties:['openFile'],filters:[{name:'Models',extensions:['safetensors','gguf','ckpt','bin']}]});if(r.canceled)return null;const s=await getSettings();s.model=r.filePaths[0];await fs.writeFile(settingsPath(),JSON.stringify(s));return s.model});
ipcMain.handle('local:status',async()=>{const s=await getSettings();return {engine:s.engine||'',model:s.model||''}});
ipcMain.handle('image:generate',async(_,input)=>{
 const {category,game,prompt,reference,previous,revision}=input||{};
 if(!targets[category])throw new Error('Choose a valid studio.');
 if(typeof prompt!=='string'||!prompt.trim())throw new Error('Describe the artwork first.');
 const s=await getSettings();
 if(!s.engine||!s.model)throw new Error('Choose a local AI engine and model in Local AI Setup first.');
 for(const p of [s.engine,s.model])await fs.access(p);
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'gridiron-ai-'));
 const output=path.join(dir,'art.png');
 const source=previous||reference;
 const instructions='Follow EVERY requirement in the user description. Do not omit any objects, colors, text, quantities, positioning or exclusions. If the model cannot satisfy a requirement, the result must be reviewed before export. Original American football graphic design, clean isolated flat sports artwork, solid high contrast colors, no photography, no stadium, no grass, no mockup. '+targets[category]+' Team/game: '+String(game||'football')+'. '+prompt+(revision?' Change requested: '+revision:'');
 const args=['--model',s.model,'--prompt',instructions,'--output',output,'--width',512,'--height',512,'--steps','20','--cfg-scale','7','--seed','-1'];
 try{
  if(source?.base64){
   const init=path.join(dir,'reference.png');
   await fs.writeFile(init,Buffer.from(source.base64,'base64'));
   args.push('--init-img',init,'--strength','0.55');
  }
  await new Promise((resolve,reject)=>{
   const child=spawn(s.engine,args,{windowsHide:true,stdio:['ignore','ignore','pipe']});
   let err='',settled=false;
   const timer=setTimeout(()=>{child.kill();if(!settled){settled=true;reject(new Error('Local generation timed out after 10 minutes.'))}},600000);
   child.stderr.on('data',chunk=>{err=(err+chunk.toString()).slice(-4000)});
   child.on('error',e=>{clearTimeout(timer);if(!settled){settled=true;reject(e)}});
   child.on('close',code=>{clearTimeout(timer);if(settled)return;settled=true;code===0?resolve():reject(new Error('Local AI engine exited with code '+code+'. '+err.slice(-700)))});
  });
  const png=await fs.readFile(output);
  return {base64:png.toString('base64'),mime:'image/png',name:'local-art.png'};
 }finally{await fs.rm(dir,{recursive:true,force:true}).catch(()=>{})}
});
