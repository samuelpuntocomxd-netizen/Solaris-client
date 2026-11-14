const { app, BrowserWindow, ipcMain, shell } = require('electron');
const os = require('os');
const { Client } = require('minecraft-launcher-core');
const { Auth } = require('msmc');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const AdmZip = require('adm-zip');
const { autoUpdater } = require('electron-updater');
const { requiredJavaMajor, getRamProfile, applyLightweightOptions, applyBoostProfile } = require('./lib/launcher-utils');

const UA = { 'User-Agent': 'SolarisClient/0.5.0-beta.1 (open-source Minecraft launcher)' };
const USER_DATA = app.getPath('userData');
const GAME_ROOT = path.join(USER_DATA, 'game');
const VERSION_CACHE = path.join(USER_DATA, 'version-manifest.json');
const { createInstance, updateInstance, deleteInstance, readInstances, writeInstances } = require('./lib/instances');
const { provisionSolarisHud, hudStatus } = require('./lib/solaris-hud');
const cosmetics = require('./lib/cosmetics');
const INSTANCES_FILE = path.join(USER_DATA, 'instances.json');
let minecraftAccount = null;
let gameProcess = null;
let mainWindow = null;
let updaterReady = false;
// Tipos de loader en la API de CurseForge
const CF_LOADERS = { forge: 1, fabric: 4, quilt: 5, neoforge: 6 };

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 680,
    minWidth: 800,
    minHeight: 540,
    backgroundColor: '#1A1033',
    title: 'Solaris Client',
    icon: path.join(__dirname, 'assets', 'solaris-logo.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: true
    }
  });
  mainWindow = win;
  win.loadFile('index.html');
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault();
  });
  win.on('closed', () => { if (mainWindow === win) mainWindow = null; });
  return win;
}

function modsDir(instanceId = null) {
  let base = GAME_ROOT;
  if (instanceId && /^[a-f0-9-]{36}$/.test(instanceId)) base = path.join(GAME_ROOT, 'instances', instanceId);
  const dir = path.join(base, 'mods');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}


function resolveModInstanceContext(instanceId, version, loader) {
  if (!instanceId || !/^[a-f0-9-]{36}$/.test(instanceId)) throw new Error('Selecciona una instancia Solaris antes de administrar mods.');
  const inst = readInstances(INSTANCES_FILE).find(i => i.id === instanceId);
  if (!inst) throw new Error('La instancia seleccionada ya no existe.');
  if (version && version !== inst.version) throw new Error('La versión del mod no coincide con la instancia activa.');
  const effectiveLoader = inst.loader === 'vanilla' ? loader : inst.loader;
  if (!effectiveLoader || effectiveLoader === 'vanilla') throw new Error('Para instalar mods elige un loader compatible en la instancia.');
  if (inst.loader !== 'vanilla' && loader && loader !== inst.loader) throw new Error('El loader del mod no coincide con la instancia activa.');
  return { inst, version: inst.version, loader: effectiveLoader };
}
function readJavaMajor(executable) {
  const result = spawnSync(executable || 'java', ['-version'], { encoding: 'utf8', timeout: 5000, windowsHide: true });
  if (result.error || result.status !== 0) return null;
  const output = `${result.stdout || ''} ${result.stderr || ''}`;
  const match = output.match(/version \"?(\d+)(?:\.(\d+))?/i);
  if (!match) return null;
  const first = Number(match[1]);
  return first === 1 ? Number(match[2]) : first;
}


function managedJavaExecutable(major) {
  return path.join(USER_DATA, 'runtime', `java-${major}`, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
}

async function ensureManagedJava(requiredMajor, sendProgress = () => {}) {
  const managed = managedJavaExecutable(requiredMajor);
  if (readJavaMajor(managed) >= requiredMajor) return managed;

  if (process.platform !== 'win32' || process.arch !== 'x64') {
    throw new Error('La descarga automática de Java de esta beta está disponible para Windows x64.');
  }

  const runtimeRoot = path.dirname(path.dirname(managed));
  const tempRoot = path.join(USER_DATA, 'runtime', '.download');
  const zipFile = path.join(tempRoot, `java-${requiredMajor}.zip`);
  fs.mkdirSync(tempRoot, { recursive: true });
  sendProgress(`Preparando Java ${requiredMajor} automáticamente…`);

  const url = `https://api.adoptium.net/v3/binary/latest/${requiredMajor}/ga/windows/x64/jre/hotspot/normal/eclipse`;
  const response = await fetch(url, { redirect: 'follow', headers: UA });
  if (!response.ok) throw new Error(`No se pudo descargar Java ${requiredMajor} (HTTP ${response.status}).`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(zipFile, buffer);
  sendProgress(`Instalando Java ${requiredMajor} para Solaris…`);

  const staging = `${runtimeRoot}.new`;
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });
  new AdmZip(zipFile).extractAllTo(staging, true);
  const children = fs.readdirSync(staging, { withFileTypes: true });
  const nested = children.length === 1 && children[0].isDirectory() ? path.join(staging, children[0].name) : staging;
  fs.rmSync(runtimeRoot, { recursive: true, force: true });
  if (nested === staging) {
    fs.renameSync(staging, runtimeRoot);
  } else {
    fs.renameSync(nested, runtimeRoot);
    fs.rmSync(staging, { recursive: true, force: true });
  }
  fs.rmSync(zipFile, { force: true });
  if (readJavaMajor(managed) < requiredMajor) throw new Error('Java se descargó, pero Solaris no pudo validar el runtime.');
  return managed;
}

async function resolveJava(requiredMajor, customPath, sendProgress = () => {}) {
  if (customPath) {
    const customMajor = readJavaMajor(customPath);
    if (!customMajor) throw new Error('La ruta manual de Java no es válida. Déjala vacía para usar el modo automático.');
    if (customMajor < requiredMajor) throw new Error(`Minecraft necesita Java ${requiredMajor} o superior; la ruta manual usa Java ${customMajor}.`);
    return customPath;
  }
  const systemMajor = readJavaMajor('java');
  if (systemMajor && systemMajor >= requiredMajor) return 'java';
  return ensureManagedJava(requiredMajor, sendProgress);
}

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers: { ...UA, ...headers } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ---------- Perfil del equipo ---------- */
ipcMain.handle('system:info', async () => {
  const profile = getRamProfile(os.totalmem(), os.freemem());
  return { ...profile, platform: process.platform, arch: process.arch };
});

/* ---------- Versiones de Minecraft ---------- */
ipcMain.handle('versions:list', async () => {
  try {
    const cached = JSON.parse(fs.readFileSync(VERSION_CACHE, 'utf8'));
    if (Date.now() - cached.savedAt < 12 * 60 * 60 * 1000) return { ok: true, ...cached.data };
  } catch (_) { /* No hay caché válida; se consulta el manifiesto oficial. */ }

  try {
    const data = await getJson('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
    const result = {
      latest: data.latest.release,
      versions: data.versions.filter(v => v.type === 'release').map(v => v.id),
      versionEntries: data.versions.map(v => ({ id: v.id, type: v.type }))
    };
    fs.mkdirSync(USER_DATA, { recursive: true });
    fs.writeFileSync(VERSION_CACHE, JSON.stringify({ savedAt: Date.now(), data: result }));
    return { ok: true, ...result };
  } catch (err) {
    try {
      const cached = JSON.parse(fs.readFileSync(VERSION_CACHE, 'utf8'));
      return { ok: true, ...cached.data, offline: true };
    } catch (_) {
      return { ok: false, error: 'No se pudo cargar la lista de versiones. Revisa tu conexión.' };
    }
  }
});


/* ---------- Instancias: perfiles persistentes e independientes ---------- */
ipcMain.handle('instances:list', () => {
  try { return { ok: true, instances: readInstances(INSTANCES_FILE).map(instance => ({ ...instance, solarisHud: hudStatus(path.join(GAME_ROOT, 'instances', instance.id)) })) }; }
  catch (err) { return { ok: false, error: err.message }; }
});
ipcMain.handle('instances:create', (_event, data) => {
  try {
    const items = readInstances(INSTANCES_FILE);
    const instance = createInstance(items, data);
    writeInstances(INSTANCES_FILE, [...items, instance]);
    const instanceRoot = path.join(GAME_ROOT, 'instances', instance.id);
    fs.mkdirSync(instanceRoot, { recursive: true });
    provisionSolarisHud(instanceRoot, instance);
    return { ok: true, instance: { ...instance, solarisHud: hudStatus(instanceRoot) } };
  } catch (err) { return { ok: false, error: err.message }; }
});
ipcMain.handle('instances:update', (_event, data) => {
  try {
    const items = readInstances(INSTANCES_FILE);
    const updated = updateInstance(items, data);
    writeInstances(INSTANCES_FILE, items.map(i => i.id === updated.id ? updated : i));
    return { ok: true, instance: updated };
  } catch (err) { return { ok: false, error: err.message }; }
});
ipcMain.handle('instances:delete', (_event, id) => {
  try {
    const items = readInstances(INSTANCES_FILE);
    const next = deleteInstance(items, id);
    writeInstances(INSTANCES_FILE, next);
    return { ok: true };
  } catch (err) { return { ok: false, error: err.message }; }
});

/* ---------- Mods instalados ---------- */
ipcMain.handle('mods:list', async (_e, instanceId) => {
  const dir = modsDir(instanceId);
  const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.jar'));
  return { dir, files };
});

ipcMain.handle('mods:open', async (_e, instanceId) => {
  await shell.openPath(modsDir(instanceId));
});

/* ---------- Buscar mods (Modrinth y CurseForge) ---------- */
ipcMain.handle('mods:search', async (_e, { source, query, version, loader, apiKey, instanceId }) => {
  try {
    const ctx = resolveModInstanceContext(instanceId, version, loader); version = ctx.version; loader = ctx.loader;
    if (source === 'modrinth') {
      const facets = [['project_type:mod']];
      if (version) facets.push([`versions:${version}`]);
      if (loader) facets.push([`categories:${loader}`]);
      const url = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&limit=20&facets=${encodeURIComponent(JSON.stringify(facets))}`;
      const data = await getJson(url);
      return {
        ok: true,
        mods: data.hits.map(h => ({
          id: h.project_id,
          title: h.title,
          description: h.description,
          author: h.author,
          downloads: h.downloads,
          icon: h.icon_url
        }))
      };
    }

    if (source === 'curseforge') {
      if (!apiKey) return { ok: false, error: 'Falta tu clave API de CurseForge en Ajustes' };
      const params = new URLSearchParams({ gameId: '432', classId: '6', searchFilter: query, pageSize: '20', sortField: '2', sortOrder: 'desc' });
      if (version) params.set('gameVersion', version);
      if (CF_LOADERS[loader]) params.set('modLoaderType', String(CF_LOADERS[loader]));
      const data = await getJson(`https://api.curseforge.com/v1/mods/search?${params}`, { 'x-api-key': apiKey });
      return {
        ok: true,
        mods: data.data.map(m => ({
          id: String(m.id),
          title: m.name,
          description: m.summary,
          author: m.authors && m.authors[0] ? m.authors[0].name : '',
          downloads: m.downloadCount,
          icon: m.logo ? m.logo.thumbnailUrl : ''
        }))
      };
    }

    return { ok: false, error: 'Fuente desconocida' };
  } catch (err) {
    return { ok: false, error: 'No se pudo buscar mods. Revisa tu conexión o tu clave API' };
  }
});

/* ---------- Instalar un mod ---------- */
async function saveJar(url, filename, instanceId = null) {
  if (!url.startsWith('https://')) throw new Error('URL no segura');
  const safeName = path.basename(filename);
  if (!safeName.toLowerCase().endsWith('.jar')) throw new Error('Archivo no válido');
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(path.join(modsDir(instanceId), safeName), buf);
  return safeName;
}

ipcMain.handle('mods:install', async (_e, { source, id, version, loader, apiKey, instanceId }) => {
  try {
    const ctx = resolveModInstanceContext(instanceId, version, loader); version = ctx.version; loader = ctx.loader;
    if (source === 'modrinth') {
      const url = `https://api.modrinth.com/v2/project/${encodeURIComponent(id)}/version?game_versions=${encodeURIComponent(JSON.stringify([version]))}&loaders=${encodeURIComponent(JSON.stringify([loader]))}`;
      const versions = await getJson(url);
      if (!versions.length) return { ok: false, error: `No hay una versión para ${version} con ${loader}` };
      const file = versions[0].files.find(f => f.primary) || versions[0].files[0];
      const name = await saveJar(file.url, file.filename, instanceId);
      return { ok: true, message: `Instalado ${name}` };
    }

    if (source === 'curseforge') {
      const params = new URLSearchParams({ gameVersion: version });
      if (CF_LOADERS[loader]) params.set('modLoaderType', String(CF_LOADERS[loader]));
      const data = await getJson(`https://api.curseforge.com/v1/mods/${encodeURIComponent(id)}/files?${params}`, { 'x-api-key': apiKey });
      const file = data.data[0];
      if (!file) return { ok: false, error: `No hay una versión para ${version} con ${loader}` };
      if (!file.downloadUrl) return { ok: false, error: 'El autor no permite descargar este mod fuera de CurseForge' };
      const name = await saveJar(file.downloadUrl, file.fileName, instanceId);
      return { ok: true, message: `Instalado ${name}` };
    }

    return { ok: false, error: 'Fuente desconocida' };
  } catch (err) {
    return { ok: false, error: err.message || 'No se pudo instalar el mod' };
  }
});

/* ---------- Cuenta Microsoft ---------- */
ipcMain.handle('auth:login', async (event) => {
  try {
    const auth = new Auth('select_account');
    const xbox = await auth.launch('electron', { width: 520, height: 680, resizable: false });
    const minecraft = await xbox.getMinecraft();
    const entitlements = await minecraft.entitlements();
    if (!entitlements.some((item) => ['game_minecraft', 'product_minecraft'].includes(item))) {
      return { ok: false, error: 'Esta cuenta no tiene acceso a Minecraft Java Edition.' };
    }
    minecraftAccount = minecraft;
    return { ok: true, username: minecraft.profile.name };
  } catch (error) {
    console.error('Error de autenticación:', error);
    return { ok: false, error: 'No se pudo iniciar sesión. Comprueba la cuenta Microsoft y vuelve a intentarlo.' };
  }
});

/* ---------- Lanzamiento real de Minecraft ---------- */
ipcMain.handle('game:launch', async (event, opts) => {
  try {
    if (!minecraftAccount) return { ok: false, error: 'Primero inicia sesión con Microsoft.' };
    if (gameProcess && !gameProcess.killed) return { ok: false, error: 'Minecraft ya está ejecutándose.' };
    if (!/^\d+\.\d+(?:\.\d+)?$/.test(String(opts.version || ''))) return { ok: false, error: 'Selecciona una versión válida de Minecraft.' };
    if (opts.loader && opts.loader !== 'vanilla') return { ok: false, error: `La instancia ${opts.loader} está guardada, pero la instalación y ejecución de ese loader aún no están implementadas. No se iniciará como Vanilla.` };

    const ramProfile = getRamProfile(os.totalmem(), os.freemem());
    const requestedRam = Math.max(1, Math.min(32, Number(opts.ram) || ramProfile.recommended));
    if (ramProfile.maxRam < 1) return { ok: false, error: 'Hay muy poca memoria libre. Cierra programas y vuelve a intentarlo.' };
    const maxRam = Math.min(requestedRam, ramProfile.maxRam);
    const requiredJava = requiredJavaMajor(opts.version);
    if (!requiredJava) return { ok: false, error: 'No se pudo determinar la versión de Java necesaria para esta versión de Minecraft.' };

    const instanceRoot = opts.instanceId && /^[a-f0-9-]{36}$/.test(opts.instanceId) ? path.join(GAME_ROOT, 'instances', opts.instanceId) : GAME_ROOT;
    if (opts.instanceId) {
      const found = readInstances(INSTANCES_FILE).find(i => i.id === opts.instanceId);
      if (!found || found.version !== opts.version || found.loader !== (opts.loader || 'vanilla')) return { ok: false, error: 'La instancia seleccionada no es válida.' };
    }
    if (opts.performanceMode === true) {
      fs.mkdirSync(instanceRoot, { recursive: true });
      applyLightweightOptions(path.join(instanceRoot, 'options.txt'), fs);
    }

    const launcher = new Client();
    const sendProgress = (message) => {
      if (!event.sender.isDestroyed()) event.sender.send('game:progress', message);
    };
    let javaPath;
    try {
      javaPath = await resolveJava(requiredJava, opts.javaPath, sendProgress);
    } catch (javaError) {
      return { ok: false, error: javaError.message || 'Solaris no pudo preparar Java automáticamente.' };
    }
    launcher.on('debug', (line) => console.log('[Minecraft]', line));
    launcher.on('data', (line) => console.log('[Minecraft]', line));
    launcher.on('progress', (progress) => {
      if (progress && progress.type) sendProgress(`Descargando ${progress.type}…`);
    });

    sendProgress(`Preparando Minecraft ${opts.version}…`);
    const launchOptions = {
      authorization: minecraftAccount.mclc(),
      root: instanceRoot,
      version: { number: opts.version, type: 'release' },
      memory: { max: `${maxRam}G`, min: '512M' },
      javaPath,
      customArgs: ['-XX:+UseG1GC', '-XX:+ParallelRefProcEnabled', '-XX:MaxGCPauseMillis=200', '-XX:+DisableExplicitGC']
    };

    gameProcess = await launcher.launch(launchOptions);
    const statsFile = path.join(instanceRoot, 'solaris-stats.json');
    let stats = { launches: 0, minutes: 0, lastPlayed: null };
    try { stats = { ...stats, ...JSON.parse(fs.readFileSync(statsFile, 'utf8')) }; } catch (_) {}
    stats.launches += 1; stats.lastPlayed = new Date().toISOString();
    fs.mkdirSync(instanceRoot, { recursive: true }); fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
    const playStartedAt = Date.now();
    sendProgress(`Minecraft ${opts.version} se está ejecutando.`);
    gameProcess.once('error', (error) => {
      console.error('Error al ejecutar Minecraft:', error);
      sendProgress('Minecraft no pudo iniciarse. Solaris revisará los archivos del juego en el próximo intento.');
      gameProcess = null;
    });
    gameProcess.once('close', (code) => {
      try { stats.minutes += Math.max(1, Math.round((Date.now() - playStartedAt) / 60000)); fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2)); } catch (_) {}
      sendProgress(code === 0 ? 'Minecraft se cerró correctamente.' : `Minecraft se cerró con código ${code}.`);
      gameProcess = null;
    });
    return { ok: true, message: `Descarga e inicio de Minecraft ${opts.version} en proceso. RAM: ${maxRam} GB.` };
  } catch (error) {
    console.error('Error al lanzar Minecraft:', error);
    gameProcess = null;
    return { ok: false, error: error?.message || 'No se pudo iniciar Minecraft. Revisa tu conexión y los permisos de la carpeta.' };
  }
});


/* ---------- Actualizaciones de Solaris ---------- */
const UPDATER_CONFIG = path.join(__dirname, 'updater-config.json');
function readUpdaterConfig() {
  try { return JSON.parse(fs.readFileSync(UPDATER_CONFIG, 'utf8')); }
  catch (_) { return { enabled: false }; }
}
function sendUpdateStatus(status, extra = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update:status', { status, ...extra });
}
function setupUpdater() {
  const cfg = readUpdaterConfig();
  if (!cfg.enabled || !cfg.owner || !cfg.repo || String(cfg.owner).startsWith('TU_')) {
    sendUpdateStatus('not-configured');
    return;
  }
  if (!app.isPackaged) { sendUpdateStatus('development'); return; }
  try {
    autoUpdater.autoDownload = true;
    autoUpdater.allowPrerelease = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.setFeedURL({ provider: 'github', owner: cfg.owner, repo: cfg.repo, private: Boolean(cfg.private) });
    autoUpdater.on('checking-for-update', () => sendUpdateStatus('checking'));
    autoUpdater.on('update-available', (info) => sendUpdateStatus('available', { version: info.version }));
    autoUpdater.on('update-not-available', () => sendUpdateStatus('current'));
    autoUpdater.on('download-progress', (p) => sendUpdateStatus('downloading', { percent: Math.round(p.percent || 0) }));
    autoUpdater.on('update-downloaded', (info) => sendUpdateStatus('downloaded', { version: info.version }));
    autoUpdater.on('error', (error) => sendUpdateStatus('error', { message: error?.message || 'No se pudo comprobar la actualización.' }));
    updaterReady = true;
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 3500);
  } catch (error) { sendUpdateStatus('error', { message: error.message }); }
}
ipcMain.handle('update:check', async () => {
  const cfg = readUpdaterConfig();
  if (!cfg.enabled || !cfg.owner || !cfg.repo || String(cfg.owner).startsWith('TU_')) return { ok:false, error:'Configura updater-config.json con tu GitHub primero.' };
  if (!app.isPackaged) return { ok:false, error:'Las actualizaciones se comprueban en la versión instalada, no en npm start.' };
  if (!updaterReady) setupUpdater();
  try { await autoUpdater.checkForUpdates(); return { ok:true }; } catch(e) { return { ok:false, error:e.message }; }
});
ipcMain.handle('update:install', () => {
  if (!updaterReady) return { ok:false, error:'El actualizador no está configurado.' };
  setImmediate(() => autoUpdater.quitAndInstall(false, true));
  return { ok:true };
});

app.whenReady().then(() => { createWindow(); setupUpdater(); });
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* ---------- Herramientas reales de instancia (Solaris 0.4) ---------- */
function safeInstance(id) {
  if (!id || !/^[a-f0-9-]{36}$/.test(id)) return null;
  return readInstances(INSTANCES_FILE).find(i => i.id === id) || null;
}
function instanceRoot(id) {
  const inst = safeInstance(id);
  if (!inst) throw new Error('Instancia no válida.');
  const root = path.join(GAME_ROOT, 'instances', id);
  fs.mkdirSync(root, { recursive: true });
  return root;
}
ipcMain.handle('instances:open', async (_e, id) => { try { await shell.openPath(instanceRoot(id)); return {ok:true}; } catch(e){ return {ok:false,error:e.message}; } });
ipcMain.handle('library:list', (_e, { id, kind }) => {
  try {
    const root = instanceRoot(id);
    const dirs = { worlds:'saves', screenshots:'screenshots', resourcepacks:'resourcepacks', shaderpacks:'shaderpacks' };
    const rel = dirs[kind]; if (!rel) throw new Error('Biblioteca no válida.');
    const dir = path.join(root, rel); fs.mkdirSync(dir,{recursive:true});
    const items = fs.readdirSync(dir,{withFileTypes:true}).filter(x => !x.name.startsWith('.')).map(x => ({name:x.name,isDirectory:x.isDirectory()}));
    return {ok:true,dir,items};
  } catch(e){ return {ok:false,error:e.message}; }
});
ipcMain.handle('library:open', async (_e, { id, kind }) => {
  try { const dirs={root:'',worlds:'saves',screenshots:'screenshots',resourcepacks:'resourcepacks',shaderpacks:'shaderpacks'}; if(!(kind in dirs)) throw Error('Biblioteca no válida.'); const rel=dirs[kind]; const dir=path.join(instanceRoot(id),rel); fs.mkdirSync(dir,{recursive:true}); await shell.openPath(dir); return {ok:true}; } catch(e){return {ok:false,error:e.message};}
});
ipcMain.handle('boost:apply', (_e, payload) => {
  try { const id = typeof payload === 'string' ? payload : payload.id; const profile = (payload && payload.profile) || 'low'; const root=instanceRoot(id); applyBoostProfile(path.join(root,'options.txt'),fs,profile); const names={low:'Bajo rendimiento',balanced:'Equilibrado',quality:'Calidad'}; return {ok:true,message:`Solaris Boost aplicó el perfil ${names[profile]||names.low}. No promete una cifra de FPS y puedes cambiar estos ajustes desde Minecraft.`}; } catch(e){return {ok:false,error:e.message};}
});
ipcMain.handle('stats:get', (_e, id) => {
  try { const file=path.join(instanceRoot(id),'solaris-stats.json'); if(!fs.existsSync(file)) return {ok:true,launches:0,minutes:0,lastPlayed:null}; return {ok:true,...JSON.parse(fs.readFileSync(file,'utf8'))}; } catch(e){return {ok:false,error:e.message};}
});
ipcMain.handle('auth:logout', () => { minecraftAccount=null; return {ok:true}; });
ipcMain.handle('app:about', () => ({ok:true,name:'Solaris Client',version:app.getVersion(),created:'13 de noviembre de 2026',platform:'Minecraft Java · Windows 10/11 x64',license:'MIT'}));

/* ---------- Solaris Creator Hub 0.4.2 ---------- */
const COSMETICS_FILE = path.join(GAME_ROOT, 'solaris-cosmetics.json');
ipcMain.handle('cosmetics:list', () => { try{return {ok:true,items:cosmetics.read(COSMETICS_FILE)}}catch(e){return {ok:false,error:e.message}} });
ipcMain.handle('cosmetics:create', (_e,data) => { try{const items=cosmetics.read(COSMETICS_FILE); const item=cosmetics.create(items,data); items.push(item); cosmetics.write(COSMETICS_FILE,items); return {ok:true,item}}catch(e){return {ok:false,error:e.message}} });
ipcMain.handle('cosmetics:export', async (_e,id) => { try{const item=cosmetics.read(COSMETICS_FILE).find(x=>x.id===id); if(!item)throw Error('Cosmético no encontrado.'); const out=path.join(app.getPath('downloads'),`solaris-cosmetic-${id}.json`); fs.writeFileSync(out,JSON.stringify(cosmetics.exportPack(item),null,2)); return {ok:true,path:out}}catch(e){return {ok:false,error:e.message}} });
ipcMain.handle('cosmetics:publish-info', () => ({ok:true,online:false,message:'Creator Hub online aún no está conectado. Los cosméticos se guardan localmente y pueden exportarse.'}));
