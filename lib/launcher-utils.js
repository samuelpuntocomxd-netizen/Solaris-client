'use strict';

function requiredJavaMajor(version) {
  const value = String(version || '');
  const match = value.match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) return null;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3] || 0);

  // Minecraft 26.1 moved to Java 25. Keep this mapping explicit until Mojang's
  // per-version javaVersion metadata is consumed by the launcher.
  if (major >= 26) return 25;
  if (major !== 1) return null;
  if (minor > 20 || (minor === 20 && patch >= 5)) return 21;
  if (minor >= 18) return 17;
  if (minor === 17) return 16;
  return 8;
}

function getRamProfile(totalBytes, freeBytes) {
  const totalGb = totalBytes / (1024 ** 3);
  const freeGb = freeBytes / (1024 ** 3);
  const reserveGb = Math.max(2, totalGb * 0.25);
  const totalLimit = Math.floor(totalGb - reserveGb);
  const freeLimit = Math.floor(freeGb - 1);
  const maxRam = Math.max(0, Math.min(8, totalLimit, freeLimit));
  const recommended = totalGb <= 4 ? 1 : totalGb <= 8 ? 2 : totalGb <= 16 ? 4 : 6;
  return {
    totalGb: Math.round(totalGb * 10) / 10,
    freeGb: Math.round(freeGb * 10) / 10,
    maxRam,
    recommended: Math.max(1, Math.min(recommended, maxRam || 1))
  };
}

function applyBoostProfile(filePath, fs, profile = 'low') {
  const profiles = {
    low: { renderDistance:'6', simulationDistance:'4', graphics:'fast', clouds:'off', particles:'2', entityShadows:'false', mipmapLevels:'0', biomeBlendRadius:'0', maxFps:'60', vsync:'false', ao:'0', entityDistanceScaling:'0.5' },
    balanced: { renderDistance:'10', simulationDistance:'6', graphics:'fast', clouds:'off', particles:'1', entityShadows:'false', mipmapLevels:'2', biomeBlendRadius:'2', maxFps:'120', vsync:'false', ao:'1', entityDistanceScaling:'0.75' },
    quality: { renderDistance:'14', simulationDistance:'8', graphics:'fancy', clouds:'fast', particles:'0', entityShadows:'true', mipmapLevels:'4', biomeBlendRadius:'3', maxFps:'120', vsync:'false', ao:'2', entityDistanceScaling:'1.0' }
  };
  const optimized = profiles[profile] || profiles.low;
  /*
    renderDistance: '6',
    simulationDistance: '4',
    graphics: 'fast',
    clouds: 'off',
    particles: '2',
    entityShadows: 'false',
    mipmapLevels: '0',
    biomeBlendRadius: '0',
    maxFps: '60',
    vsync: 'false',
    ao: '0',
    entityDistanceScaling: '0.5'
  */
  let current = '';
  try { current = fs.readFileSync(filePath, 'utf8'); } catch (_) { /* Primer inicio */ }
  const lines = new Map(current.split(/\r?\n/).filter(Boolean).map((line) => {
    const index = line.indexOf(':');
    return index < 0 ? [line, ''] : [line.slice(0, index), line.slice(index + 1)];
  }));
  for (const [key, value] of Object.entries(optimized)) lines.set(key, value);
  fs.writeFileSync(filePath, `${Array.from(lines, ([key, value]) => `${key}:${value}`).join('\n')}\n`, 'utf8');
}

function applyLightweightOptions(filePath, fs) { return applyBoostProfile(filePath, fs, 'low'); }

module.exports = { requiredJavaMajor, getRamProfile, applyLightweightOptions, applyBoostProfile };
