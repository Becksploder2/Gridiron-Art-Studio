const {app,BrowserWindow,ipcMain,dialog,safeStorage}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {spawn}=require('node:child_process');
let win;
const settingsPath=()=>path.join(app.getPath('userData'),'settings.json');
async function getSettings(){try{return JSON.parse(await fs.readFile(settingsPath(),'utf8'))}catch{return {}}}
function makeWindow(){win=new BrowserWindow({width:1250,height:850,minWidth:940,minHeight:640,backgroundColor:'#101827',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});win.loadFile('index.html');win.removeMenu()}
app.whenReady().then(()=>{makeWindow();app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)makeWindow()})});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
ipcMain.handle('file:reference',async()=>{const o=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'Images',extensions:['png','jpg','jpeg','webp']}]});if(o.canceled||!o.filePaths[0])return null;const file=o.filePaths[0];const buf=await fs.readFile(file);if(buf.length>18*1024*1024)throw new Error('Reference image is too large (18 MB maximum).');const ext=path.extname(file).toLowerCase();const type=ext==='.png'?'image/png':ext==='.webp'?'image/webp':'image/jpeg';return {name:path.basename(file),mime:type,base64:buf.toString('base64')}});
ipcMain.handle('file:save',async(_,base64,name)=>{if(typeof base64!=='string'||base64.length>60_000_000)throw new Error('Invalid image');const o=await dialog.showSaveDialog(win,{defaultPath:(name||'gridiron-art')+'.png',filters:[{name:'PNG',extensions:['png']}]});if(o.canceled||!o.filePath)return null;await fs.writeFile(o.filePath,Buffer.from(base64,'base64'));return o.filePath});
const targets={Endzone:'Create ONLY standalone endzone lettering/graphics. NO grass, turf, football field, stadium, yard markings, perspective mockup, or background. Long horizontal composition, clean edges, transparent outside the design.',Logo:'Create a single professional football franchise logo or wordmark. Isolated flat artwork; NO merchandise, helmet, stadium, scene, or background. Crisp defined contours.',Helmet:'Create ONLY flat isolated helmet stripe DECAL ART suitable for placement on a helmet texture. No helmet object, no product mockup, no background. Crisp symmetrical stripe geometry.',Uniform:'Create ONLY isolated flat uniform graphics or stripe TEXTURE ART, not a person or clothing mockup. Crisp seamless stripe edges, no background.'};

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
 const instructions='Original American football graphic design, clean isolated flat sports artwork, solid high contrast colors, no photography, no stadium, no grass, no mockup. '+targets[category]+' Team/game: '+String(game||'football')+'. '+prompt+(revision?' Change requested: '+revision:'');
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
