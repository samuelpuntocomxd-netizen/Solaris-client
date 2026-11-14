const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const LOADERS = ['vanilla', 'fabric', 'forge', 'neoforge', 'quilt'];
function validate(data) {
  if (!data || typeof data !== 'object') throw Error('Datos de instancia inválidos.');
  const name = String(data.name || '').trim();
  if (!name || name.length > 48) throw Error('El nombre debe tener entre 1 y 48 caracteres.');
  const version = String(data.version || '');
  if (!/^\d+\.\d+(?:\.\d+)?$/.test(version)) throw Error('Versión de Minecraft inválida.');
  const loader = String(data.loader || 'vanilla').toLowerCase();
  if (!LOADERS.includes(loader)) throw Error('Loader no admitido.');
  const ram = Number(data.ram);
  if (!Number.isInteger(ram) || ram < 1 || ram > 32) throw Error('La RAM debe ser de 1 a 32 GB.');
  return { name, version, loader, ram };
}
function readInstances(file) {
  if (!fs.existsSync(file)) return [];
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(data)) throw Error('El archivo de instancias está dañado.');
  return data;
}
function writeInstances(file, items) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(items, null, 2), { mode: 0o600 });
  fs.renameSync(temp, file);
}
function createInstance(items, data) {
  const clean = validate(data);
  if (items.some(i => i.name.toLowerCase() === clean.name.toLowerCase())) throw Error('Ya existe una instancia con ese nombre.');
  return { id: randomUUID(), ...clean, solarisHudRequired: true, createdAt: new Date().toISOString() };
}
function updateInstance(items, data) {
  const existing = items.find(i => i.id === data.id);
  if (!existing) throw Error('No se encontró la instancia.');
  const clean = validate(data);
  if (items.some(i => i.id !== data.id && i.name.toLowerCase() === clean.name.toLowerCase())) throw Error('Ya existe una instancia con ese nombre.');
  return { ...existing, ...clean };
}
function deleteInstance(items, id) {
  if (!items.some(i => i.id === id)) throw Error('No se encontró la instancia.');
  return items.filter(i => i.id !== id);
}
module.exports = { validate, readInstances, writeInstances, createInstance, updateInstance, deleteInstance };
