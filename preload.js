const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('solaris', {
  listVersions: () => ipcRenderer.invoke('versions:list'),
  listInstances: () => ipcRenderer.invoke('instances:list'),
  createInstance: (data) => ipcRenderer.invoke('instances:create', data),
  updateInstance: (data) => ipcRenderer.invoke('instances:update', data),
  deleteInstance: (id) => ipcRenderer.invoke('instances:delete', id),
  openInstance: (id) => ipcRenderer.invoke('instances:open', id),
  listLibrary: (opts) => ipcRenderer.invoke('library:list', opts),
  openLibrary: (opts) => ipcRenderer.invoke('library:open', opts),
  applyBoost: (id, profile = 'low') => ipcRenderer.invoke('boost:apply', { id, profile }),
  getStats: (id) => ipcRenderer.invoke('stats:get', id),
  getSystemInfo: () => ipcRenderer.invoke('system:info'),
  listMods: (id) => ipcRenderer.invoke('mods:list', id),
  openModsFolder: (id) => ipcRenderer.invoke('mods:open', id),
  searchMods: (opts) => ipcRenderer.invoke('mods:search', opts),
  installMod: (opts) => ipcRenderer.invoke('mods:install', opts),
  login: () => ipcRenderer.invoke('auth:login'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  about: () => ipcRenderer.invoke('app:about'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateStatus: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('update:status', listener);
    return () => ipcRenderer.removeListener('update:status', listener);
  },
  listCosmetics: () => ipcRenderer.invoke('cosmetics:list'),
  createCosmetic: (data) => ipcRenderer.invoke('cosmetics:create', data),
  exportCosmetic: (id) => ipcRenderer.invoke('cosmetics:export', id),
  cosmeticsPublishInfo: () => ipcRenderer.invoke('cosmetics:publish-info'),
  launch: (opts) => ipcRenderer.invoke('game:launch', opts),
  onGameProgress: (callback) => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on('game:progress', listener);
    return () => ipcRenderer.removeListener('game:progress', listener);
  }
});
