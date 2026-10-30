const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('studio',{
saveKey:key=>ipcRenderer.invoke('settings:saveKey',key),
status:()=>ipcRenderer.invoke('settings:status'),
chooseReference:()=>ipcRenderer.invoke('file:reference'),
generate:input=>ipcRenderer.invoke('image:generate',input),
save:(base64,name)=>ipcRenderer.invoke('file:save',base64,name)
});
