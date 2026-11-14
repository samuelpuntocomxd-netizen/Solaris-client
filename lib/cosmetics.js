const fs=require('fs'); const path=require('path'); const {randomUUID}=require('crypto');
const TYPES=['cape','wings','hat','accessory','effect'];
function cleanText(v,max){return String(v||'').trim().slice(0,max)}
function validateCosmetic(d={}){const name=cleanText(d.name,48),author=cleanText(d.author,32),type=cleanText(d.type,20),license=cleanText(d.license||'CC-BY-4.0',32),description=cleanText(d.description,240); if(!name)throw Error('El cosmético necesita nombre.'); if(!author)throw Error('Indica el autor.'); if(!TYPES.includes(type))throw Error('Tipo de cosmético no admitido.'); return {name,author,type,license,description};}
function read(file){if(!fs.existsSync(file))return[]; const v=JSON.parse(fs.readFileSync(file,'utf8')); return Array.isArray(v)?v:[]}
function write(file,items){fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,JSON.stringify(items,null,2));}
function create(items,d){const c=validateCosmetic(d); return {...c,id:randomUUID(),status:'draft',createdAt:new Date().toISOString()};}
function exportPack(item){return {format:'solaris-cosmetic',formatVersion:1,cosmetic:item};}
function importPack(pack){if(!pack||pack.format!=='solaris-cosmetic'||pack.formatVersion!==1)throw Error('Paquete Solaris no válido.'); const c=validateCosmetic(pack.cosmetic); return {...c,id:randomUUID(),status:'imported',createdAt:new Date().toISOString()};}
module.exports={TYPES,validateCosmetic,read,write,create,exportPack,importPack};
