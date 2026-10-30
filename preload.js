const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('studio',{
installLocalAI:()=>ipcRenderer.invoke('local:install'),
onLocalProgress:callback=>ipcRenderer.on('local:progress',(_,data)=>callback(data)),
chooseEngine:()=>ipcRenderer.invoke('local:chooseEngine'),
chooseModel:()=>ipcRenderer.invoke('local:chooseModel'),
localStatus:()=>ipcRenderer.invoke('local:status'),
chooseReference:()=>ipcRenderer.invoke('file:reference'),
generate:input=>ipcRenderer.invoke('image:generate',input),
save:(base64,name)=>ipcRenderer.invoke('file:save',base64,name)
});
