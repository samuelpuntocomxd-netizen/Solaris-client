const fs = require('fs');
const path = require('path');

const DEFAULT_HUD = {
  schema: 1,
  enabled: true,
  locked: true,
  theme: 'solaris-yellow-blue',
  editorKey: 'RIGHT_SHIFT',
  modules: {
    fps: { enabled: true, x: 12, y: 12 },
    cps: { enabled: true, x: 12, y: 38 },
    keystrokes: { enabled: true, x: 12, y: 72 },
    ping: { enabled: true, x: 12, y: 190 },
    coordinates: { enabled: true, x: 12, y: 216 },
    armor: { enabled: true, x: 12, y: 252 },
    sprint: { enabled: true, x: 12, y: 326 },
    zoom: { enabled: true, x: 12, y: 352 },
    durability: { enabled: true, x: 12, y: 378 }
  }
};

function provisionSolarisHud(instanceRoot, instance) {
  const configDir = path.join(instanceRoot, 'config', 'solaris');
  const modsDir = path.join(instanceRoot, 'mods');
  fs.mkdirSync(configDir, { recursive: true });
  fs.mkdirSync(modsDir, { recursive: true });
  const config = {
    ...DEFAULT_HUD,
    instanceId: instance.id,
    minecraftVersion: instance.version,
    loader: instance.loader,
    generatedAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(configDir, 'hud.json'), JSON.stringify(config, null, 2));
  fs.writeFileSync(path.join(configDir, 'README.txt'), [
    'Solaris HUD es un componente obligatorio de las instancias Solaris.',
    'Esta carpeta contiene su configuracion local.',
    'El mod compilado de Solaris HUD debe estar presente en mods/ para mostrarse dentro de Minecraft.',
    'Durante la BETA, el launcher debe verificar ese archivo antes de iniciar el juego.'
  ].join('\n'));
  return config;
}

function hudStatus(instanceRoot) {
  const cfg = path.join(instanceRoot, 'config', 'solaris', 'hud.json');
  const mods = path.join(instanceRoot, 'mods');
  const jar = fs.existsSync(mods) ? fs.readdirSync(mods).find(f => /^solaris-hud.*\.jar$/i.test(f)) : null;
  return { configured: fs.existsSync(cfg), modInstalled: Boolean(jar), jar: jar || null };
}

module.exports = { DEFAULT_HUD, provisionSolarisHud, hudStatus };
