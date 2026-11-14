const $ = (id) => document.getElementById(id);
const playBtn = $('play');
const statusEl = $('status');
const usernameEl = $('username');
const versionEl = $('version');
const ramEl = $('ram');
const ramOut = $('ram-out');
const javaEl = $('java-path');
const cfKeyEl = $('cf-key');
const loginBtn = $('login');
let isLoggedIn = false;
let minecraftVersionEntries = [];
/* ---------- Menú lateral ---------- */
document.querySelectorAll('.nav').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav').forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.view').forEach((v) => {
      v.classList.toggle('active', v.id === `view-${btn.dataset.view}`);
    });
    const pageNames = { play: 'Inicio', instances: 'Instancias', news: 'Cuentas', mods: 'Mods', settings: 'Ajustes', about: 'Acerca de' };
    $('page-name').textContent = pageNames[btn.dataset.view] || 'Solaris';
    if (btn.dataset.view === 'mods') loadMods();
    if (btn.dataset.view === 'instances') loadInstances();
    if (btn.dataset.view === 'tools') refreshTools();
  });
});

document.querySelectorAll('[data-go]').forEach((btn) => btn.addEventListener('click', () => {
  const target = document.querySelector(`.nav[data-view="${btn.dataset.go}"]`);
  if (target) target.click();
}));
const homeFolder = $('home-folder');
if (homeFolder) homeFolder.addEventListener('click', async () => {
  const inst = currentInstance();
  if (!inst) { statusEl.textContent = 'Selecciona una instancia para abrir su carpeta.'; return; }
  await window.solaris.openLibrary({id: inst.id, kind: 'root'});
});

/* ---------- Jugar ---------- */
function refreshPlay() {
  playBtn.disabled = !(isLoggedIn && versionEl.value);
}

async function loadVersions() {
  const res = await window.solaris.listVersions();
  if (!res.ok) {
    statusEl.textContent = res.error;
    return;
  }
  res.versions.forEach((v) => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    versionEl.appendChild(opt);
  });
  versionEl.value = localStorage.getItem('solaris.version') || res.latest;
  versionEl.disabled = false;
  $('selected-version').textContent = versionEl.value;
  statusEl.textContent = res.offline ? 'Usando la lista guardada de versiones (sin conexión).' : 'Inicia sesión con Microsoft para jugar';
  refreshPlay();
  minecraftVersionEntries = res.versionEntries || res.versions.map(id => ({id, type:'release'}));
  loadInstanceVersions(res.versions);
  loadInstances();
}

async function performMicrosoftLogin(origin = 'launcher') {
  const gateBtn = $('gate-login');
  const gateStatus = $('gate-status');
  if (gateBtn) { gateBtn.disabled = true; gateBtn.textContent = 'Conectando con Microsoft…'; }
  if (origin === 'launcher') { loginBtn.disabled = true; loginBtn.textContent = 'Conectando con Microsoft…'; statusEl.textContent = 'Abriendo inicio de sesión seguro…'; }
  if (gateStatus) gateStatus.textContent = 'Abriendo el inicio de sesión oficial de Microsoft…';
  const res = await window.solaris.login();
  if (res.ok) {
    isLoggedIn = true; usernameEl.value = res.username;
    document.querySelectorAll('#profile-name').forEach(el => el.textContent = res.username);
    loginBtn.textContent = 'Sesión iniciada ✓';
    statusEl.textContent = `Hola, ${res.username}. Ya puedes iniciar Minecraft.`;
    document.body.classList.remove('auth-locked');
    if ($('auth-gate')) $('auth-gate').hidden = true;
  } else {
    loginBtn.textContent = 'Iniciar sesión con Microsoft';
    if (gateStatus) gateStatus.textContent = res.error;
    statusEl.textContent = res.error;
  }
  if (gateBtn) { gateBtn.disabled = false; gateBtn.textContent = 'Continuar con Microsoft'; }
  loginBtn.disabled = false; refreshPlay();
}
$('gate-login').addEventListener('click', () => performMicrosoftLogin('gate'));

loginBtn.addEventListener('click', () => performMicrosoftLogin('launcher'));

window.solaris.onGameProgress((message) => { statusEl.textContent = message; });

versionEl.addEventListener('change', () => {
  localStorage.setItem('solaris.version', versionEl.value);
  $('selected-version').textContent = versionEl.value;
  refreshPlay();
});

playBtn.addEventListener('click', async () => {
  if (!currentInstance()) { statusEl.textContent = 'Crea o selecciona una instancia Solaris para jugar con Solaris HUD.'; return; }
  playBtn.disabled = true;
  statusEl.textContent = 'Preparando el juego…';
  const res = await window.solaris.launch({
    version: versionEl.value,
    loader: currentInstance()?.loader || 'vanilla',
    instanceId: currentInstance()?.id || null,
    ram: currentInstance()?.ram || Number(ramEl.value),
    javaPath: javaEl.value.trim(),
    performanceMode: $('performance-mode').checked
  });
  statusEl.textContent = res.ok ? res.message : res.error;
  refreshPlay();
});


/* ---------- Administrador de instancias ---------- */
let instances = [];
let editingInstanceId = null;
const activeInstanceEl = $('active-instance');
function currentInstance() { return instances.find(i => i.id === activeInstanceEl.value); }
function loadInstanceVersions(versions) {
  const select = $('instance-version');
  const showAll = $('instance-show-all')?.checked;
  const current = select.value;
  const entries = showAll ? minecraftVersionEntries : minecraftVersionEntries.filter(v => v.type === 'release');
  select.replaceChildren();
  const placeholder=document.createElement('option'); placeholder.value=''; placeholder.textContent='Seleccionar versión de Minecraft'; select.appendChild(placeholder);
  (entries.length ? entries : versions.map(id=>({id,type:'release'}))).forEach(v => { const option = document.createElement('option'); option.value = v.id; option.textContent = v.type === 'release' ? v.id : `${v.id} · ${v.type}`; select.appendChild(option); });
  select.value = [...select.options].some(o=>o.value===current) ? current : (versionEl.value || '');
}
function resetInstanceForm() {
  editingInstanceId = null;
  $('instance-form').reset();
  $('instance-form-title').textContent = 'Nueva instancia';
  $('instance-save').textContent = '＋ Crear instancia';
  $('instance-loader').value = 'vanilla';
  $('instance-version').value = versionEl.value || '';
  $('instance-ram').value = ramEl.value;
  $('instance-status').textContent = '';
}
function openInstanceModal(instance = null) {
  resetInstanceForm();
  if (instance) {
    editingInstanceId=instance.id; $('instance-form-title').textContent='Editar instancia'; $('instance-save').textContent='Guardar cambios'; $('instance-name').value=instance.name; $('instance-version').value=instance.version; $('instance-ram').value=instance.ram;
    const radio=document.querySelector(`input[name="instance-loader-choice"][value="${instance.loader}"]`); if(radio) radio.checked=true; $('instance-loader').value=instance.loader;
  }
  $('instance-modal').hidden=false; setTimeout(()=>$('instance-name').focus(),0);
}
function closeInstanceModal(){ $('instance-modal').hidden=true; resetInstanceForm(); }
function chooseInstance(id) {
  activeInstanceEl.value = id;
  localStorage.setItem('solaris.activeInstance', id);
  const inst = currentInstance();
  versionEl.disabled = Boolean(inst);
  if (inst) {
    if (![...versionEl.options].some(o => o.value === inst.version)) {
      const opt = document.createElement('option'); opt.value = inst.version; opt.textContent = inst.version; versionEl.appendChild(opt);
    }
    versionEl.value = inst.version;
    $('selected-version').textContent = `${inst.version} · ${inst.loader}`;
    $('selected-ram').textContent = `${inst.ram} GB RAM`;
    statusEl.textContent = `Instancia activa: ${inst.name} · ${inst.version} · ${inst.loader}`;
    if ($('mod-loader')) { $('mod-loader').value = inst.loader === 'vanilla' ? 'fabric' : inst.loader; $('mod-loader').disabled = inst.loader !== 'vanilla'; }
  } else {
    versionEl.value = localStorage.getItem('solaris.version') || versionEl.value;
    $('selected-version').textContent = versionEl.value;
    updateRamLabel();
  }
  refreshPlay();
}
async function loadInstances() {
  const res = await window.solaris.listInstances();
  if (!res.ok) { $('instance-status').textContent = res.error; return; }
  instances = res.instances;
  const previous = activeInstanceEl.value || localStorage.getItem('solaris.activeInstance') || '';
  activeInstanceEl.replaceChildren();
  const fallback = document.createElement('option'); fallback.value = ''; fallback.textContent = 'Selecciona una instancia Solaris'; activeInstanceEl.appendChild(fallback);
  instances.forEach(i => { const option = document.createElement('option'); option.value = i.id; option.textContent = `${i.name} · ${i.loader}`; activeInstanceEl.appendChild(option); });
  chooseInstance(instances.some(i => i.id === previous) ? previous : '');
  const list = $('instance-list'); list.replaceChildren();
  if (!instances.length) { const empty = document.createElement('p'); empty.className = 'hint'; empty.textContent = 'Todavía no tienes instancias. Crea tu primera instancia arriba.'; list.appendChild(empty); }
  instances.forEach(i => {
    const card = document.createElement('article'); card.className = 'instance-card';
    const info = document.createElement('div');
    const title = document.createElement('h2'); title.textContent = i.name;
    const detail = document.createElement('p'); detail.textContent = `Minecraft ${i.version} · ${i.loader.toUpperCase()} · ${i.ram} GB RAM`;
    const hud = document.createElement('p'); hud.className = 'hint'; hud.textContent = i.solarisHud?.modInstalled ? '☀ Solaris HUD · instalado' : (i.solarisHud?.configured ? '☀ Solaris HUD · configurado · falta compilar/instalar el mod' : '☀ Solaris HUD · pendiente');
    info.append(title, detail, hud);
    const actions = document.createElement('div'); actions.className = 'instance-actions';
    const use = document.createElement('button'); use.className = 'btn'; use.textContent = 'Seleccionar'; use.addEventListener('click', () => { chooseInstance(i.id); document.querySelector('.nav[data-view="play"]').click(); });
    const edit = document.createElement('button'); edit.className = 'btn'; edit.textContent = 'Editar'; edit.addEventListener('click', () => openInstanceModal(i));
    const del = document.createElement('button'); del.className = 'btn'; del.textContent = 'Eliminar'; del.addEventListener('click', async () => { if (!confirm(`¿Eliminar la instancia "${i.name}"? Se quitará de la lista, pero no se borrarán los archivos del juego.`)) return; const result = await window.solaris.deleteInstance(i.id); $('instance-status').textContent = result.ok ? 'Instancia eliminada.' : result.error; if (result.ok) loadInstances(); });
    actions.append(use, edit, del); card.append(info, actions); list.appendChild(card);
  });
}
activeInstanceEl.addEventListener('change', () => chooseInstance(activeInstanceEl.value));
const instanceFilter = $('instance-filter');
if (instanceFilter) instanceFilter.addEventListener('input', () => {
  const q = instanceFilter.value.trim().toLowerCase();
  document.querySelectorAll('#instance-list .instance-card').forEach(card => { card.hidden = !card.textContent.toLowerCase().includes(q); });
});
$('new-instance').addEventListener('click', () => openInstanceModal());
$('instance-close').addEventListener('click', closeInstanceModal);
$('instance-cancel').addEventListener('click', closeInstanceModal);
$('instance-modal').addEventListener('click', e => { if(e.target === $('instance-modal')) closeInstanceModal(); });
$('instance-show-all').addEventListener('change', () => loadInstanceVersions(versionEl.options ? [...versionEl.options].map(o=>o.value).filter(Boolean) : []));
document.querySelectorAll('input[name="instance-loader-choice"]').forEach(r => r.addEventListener('change', () => { if(r.checked) $('instance-loader').value=r.value; }));
$('instance-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const version=$('instance-version').value; if(!version){$('instance-status').textContent='Selecciona una versión de Minecraft.';return;}
  const loader=$('instance-loader').value; const autoName=`Minecraft ${version} ${loader==='vanilla'?'Vanilla':loader[0].toUpperCase()+loader.slice(1)}`;
  const data = { name: $('instance-name').value.trim() || autoName, version, loader, ram: Number($('instance-ram').value || ramEl.value) };
  const startAfter=$('instance-start-after').checked;
  const result = editingInstanceId ? await window.solaris.updateInstance({ id: editingInstanceId, ...data }) : await window.solaris.createInstance(data);
  $('instance-status').textContent = result.ok ? 'Instancia guardada correctamente.' : result.error;
  if (result.ok) { await loadInstances(); chooseInstance(result.instance.id); closeInstanceModal(); if(startAfter){document.querySelector('.nav[data-view="play"]').click(); playBtn.click();} }
});

/* ---------- Noticias (contenido de ejemplo) ---------- */
const NEWS = [
  { date: '13 nov 2026', title: 'Bienvenido a Solaris Client', text: 'Primera versión del launcher con menú, mods y ajustes.' },
  { date: '13 nov 2026', title: 'Lanzamiento de Minecraft', text: 'Solaris prepara los archivos oficiales del juego y lo inicia con tu cuenta Microsoft.' },
  { date: '13 nov 2026', title: 'Cómo añadir mods', text: 'Abre la pestaña Mods y suelta tus archivos .jar en la carpeta.' }
];

function renderNews() {
  const box = $('news-list');
  NEWS.forEach((n) => {
    const item = document.createElement('article');
    item.className = 'item';
    const time = document.createElement('time');
    time.textContent = n.date;
    const h = document.createElement('h2');
    h.textContent = n.title;
    const p = document.createElement('p');
    p.textContent = n.text;
    item.append(time, h, p);
    box.appendChild(item);
  });
}

/* ---------- Mods ---------- */
async function loadMods() {
  const inst=currentInstance();
  if ($('mod-note')) $('mod-note').textContent = inst ? `Instancia activa: ${inst.name} · Minecraft ${inst.version} · ${inst.loader}` : 'Selecciona una instancia para administrar sus mods.';
  if ($('mod-loader') && inst && inst.loader !== 'vanilla') { $('mod-loader').value=inst.loader; $('mod-loader').disabled=true; } else if ($('mod-loader')) $('mod-loader').disabled=false;
  const { dir, files } = await window.solaris.listMods(currentInstance()?.id || null);
  $('mods-dir').textContent = dir;
  const box = $('mods-list');
  box.replaceChildren();
  if (!files.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'No hay mods todavía. Instala uno desde la búsqueda o suelta tus .jar en la carpeta';
    box.appendChild(p);
    return;
  }
  files.forEach((f) => {
    const item = document.createElement('div');
    item.className = 'item';
    const h = document.createElement('h2');
    h.textContent = f;
    item.appendChild(h);
    box.appendChild(item);
  });
}

function modContext() {
  const inst=currentInstance();
  return {
    source: $('mod-source').value,
    loader: inst && inst.loader !== 'vanilla' ? inst.loader : $('mod-loader').value,
    version: inst?.version || versionEl.value,
    apiKey: cfKeyEl.value.trim(),
    instanceId: inst?.id || null
  };
}

function renderMod(mod, ctx) {
  const row = document.createElement('article');
  row.className = 'mod';

  let icon;
  if (mod.icon) {
    icon = document.createElement('img');
    icon.src = mod.icon;
    icon.alt = '';
  } else {
    icon = document.createElement('div');
    icon.className = 'noicon';
  }

  const info = document.createElement('div');
  const h = document.createElement('h2');
  h.textContent = mod.title;
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = `${mod.author || 'Autor desconocido'} • ${Number(mod.downloads).toLocaleString('es')} descargas`;
  const p = document.createElement('p');
  p.textContent = mod.description;
  info.append(h, meta, p);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn';
  btn.textContent = 'Instalar';
  btn.addEventListener('click', async () => {
    if (!ctx.version) {
      $('mod-note').textContent = 'Elige una versión en Jugar primero';
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Instalando…';
    const res = await window.solaris.installMod({ ...modContext(), id: mod.id });
    $('mod-note').textContent = res.ok ? res.message : res.error;
    btn.textContent = res.ok ? 'Instalado' : 'Instalar';
    btn.disabled = res.ok;
    if (res.ok) loadMods();
  });

  row.append(icon, info, btn);
  return row;
}

async function searchMods() {
  const ctx = modContext();
  const note = $('mod-note');
  const box = $('mod-results');
  box.replaceChildren();
  note.textContent = 'Buscando…';
  $('mod-search').disabled = true;
  const res = await window.solaris.searchMods({ ...ctx, query: $('mod-query').value.trim() });
  $('mod-search').disabled = false;
  if (!res.ok) {
    note.textContent = res.error;
    return;
  }
  note.textContent = res.mods.length ? `${res.mods.length} resultados para ${ctx.version || 'todas las versiones'}` : 'No se encontró nada con esos filtros';
  res.mods.forEach((m) => box.appendChild(renderMod(m, ctx)));
}

$('mod-search').addEventListener('click', searchMods);
$('mod-query').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') searchMods();
});
document.querySelectorAll('.mod-category').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.mod-category').forEach(b => b.classList.toggle('active', b === btn));
  $('mod-query').value = btn.dataset.modQuery || '';
  searchMods();
}));

$('open-mods').addEventListener('click', () => window.solaris.openModsFolder(currentInstance()?.id || null));
$('refresh-mods').addEventListener('click', loadMods);

/* ---------- Ajustes ---------- */
function updateRamLabel() {
  ramOut.textContent = `${ramEl.value} GB`;
  const selectedRam = $('selected-ram');
  if (selectedRam && !currentInstance()) selectedRam.textContent = `${ramEl.value} GB RAM`;
}

ramEl.addEventListener('input', () => {
  updateRamLabel();
  localStorage.setItem('solaris.ram', ramEl.value);
});

javaEl.addEventListener('input', () => {
  localStorage.setItem('solaris.java', javaEl.value.trim());
});

cfKeyEl.addEventListener('input', () => {
  localStorage.setItem('solaris.cfkey', cfKeyEl.value.trim());
});

/* ---------- Inicio ---------- */
usernameEl.value = '';
ramEl.value = localStorage.getItem('solaris.ram') || '2';
javaEl.value = localStorage.getItem('solaris.java') || '';
cfKeyEl.value = localStorage.getItem('solaris.cfkey') || '';
const performanceMode = $('performance-mode');
performanceMode.checked = localStorage.getItem('solaris.performanceMode') === 'true';
performanceMode.addEventListener('change', () => localStorage.setItem('solaris.performanceMode', String(performanceMode.checked)));

const lightMode = $('light-mode');
lightMode.checked = localStorage.getItem('solaris.lightMode') !== 'false';
document.body.classList.toggle('light-mode', lightMode.checked);
lightMode.addEventListener('change', () => {
  document.body.classList.toggle('light-mode', lightMode.checked);
  localStorage.setItem('solaris.lightMode', String(lightMode.checked));
});
updateRamLabel();
window.solaris.getSystemInfo().then((info) => {
  if (!info) return;
  ramEl.max = String(Math.max(1, info.maxRam));
  const savedRam = Number(localStorage.getItem('solaris.ram'));
  ramEl.value = String(Math.min(Number.isFinite(savedRam) && savedRam > 0 ? savedRam : info.recommended, Number(ramEl.max)));
  $('ram-guidance').textContent = `Detectados ${info.totalGb} GB de RAM (${info.freeGb} GB libres). Recomendado: ${info.recommended} GB; máximo seguro estimado: ${info.maxRam} GB.`;
  updateRamLabel();
}).catch(() => { $('ram-guidance').textContent = 'No se pudo detectar la memoria. Usa 2 GB como punto de partida.'; });
renderNews();
loadVersions();

/* ---------- Solaris 0.4: herramientas reales por instancia ---------- */
async function refreshTools() {
  const inst = currentInstance();
  const stats = $('local-stats');
  if (!inst) { stats.textContent = 'Selecciona una instancia para usar estas herramientas.'; return; }
  const res = await window.solaris.getStats(inst.id);
  stats.textContent = res.ok ? `Inicios: ${res.launches} · Tiempo registrado: ${res.minutes} min · Última partida: ${res.lastPlayed ? new Date(res.lastPlayed).toLocaleString('es') : 'Nunca'}` : res.error;
}
$('boost-apply').addEventListener('click', async () => { const inst=currentInstance(); if(!inst){$('boost-status').textContent='Selecciona una instancia primero.';return;} const r=await window.solaris.applyBoost(inst.id, $('boost-profile').value); $('boost-status').textContent=r.ok?r.message:r.error; });
$('open-instance').addEventListener('click', async () => { const inst=currentInstance(); if(!inst)return; await window.solaris.openInstance(inst.id); });
document.querySelectorAll('.library-open').forEach(btn => btn.addEventListener('click', async () => { const inst=currentInstance(); if(!inst){$('boost-status').textContent='Selecciona una instancia primero.';return;} await window.solaris.openLibrary({id:inst.id,kind:btn.dataset.kind}); }));

/* ---------- Servidores favoritos: almacenamiento local ---------- */
function renderServers(){ const box=$('server-list'); if(!box)return; box.replaceChildren(); const servers=JSON.parse(localStorage.getItem('solaris.servers')||'[]'); servers.forEach((address,index)=>{const row=document.createElement('div');row.className='item';const label=document.createElement('span');label.textContent=address;const del=document.createElement('button');del.className='btn ghost';del.textContent='Quitar';del.addEventListener('click',()=>{servers.splice(index,1);localStorage.setItem('solaris.servers',JSON.stringify(servers));renderServers();});row.append(label,del);box.appendChild(row);});}
$('server-save').addEventListener('click',()=>{const input=$('server-address');const address=input.value.trim();if(!/^[A-Za-z0-9.-]+(?::\d{1,5})?$/.test(address))return;const servers=JSON.parse(localStorage.getItem('solaris.servers')||'[]');if(!servers.includes(address))servers.push(address);localStorage.setItem('solaris.servers',JSON.stringify(servers));input.value='';renderServers();});
renderServers();


/* ---------- Actualizador ---------- */
const updateStatusEl = $('update-status');
const updateCheckBtn = $('update-check');
const updateInstallBtn = $('update-install');
if (window.solaris.onUpdateStatus) window.solaris.onUpdateStatus((data) => {
  if (!updateStatusEl || !data) return;
  const messages = {
    'not-configured': 'Modo dueño: conecta updater-config.json a tu repositorio de GitHub para activar las actualizaciones.',
    development: 'Estás ejecutando el código editable. El updater funciona en el Installer.',
    checking: 'Buscando una nueva versión…',
    current: 'Solaris Client está actualizado.',
    available: `Nueva versión ${data.version || ''} encontrada. Descargando…`,
    downloading: `Descargando actualización… ${data.percent || 0}%`,
    downloaded: `Solaris ${data.version || ''} está listo para instalar.`,
    error: `No se pudo actualizar: ${data.message || 'error desconocido'}`
  };
  updateStatusEl.textContent = messages[data.status] || 'Estado de actualización desconocido.';
  if (updateInstallBtn) updateInstallBtn.hidden = data.status !== 'downloaded';
});
if (updateCheckBtn) updateCheckBtn.addEventListener('click', async () => {
  updateStatusEl.textContent = 'Buscando una nueva versión…';
  const r = await window.solaris.checkForUpdates();
  if (!r.ok) updateStatusEl.textContent = r.error;
});
if (updateInstallBtn) updateInstallBtn.addEventListener('click', () => window.solaris.installUpdate());
