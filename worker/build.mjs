import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';
import {extname} from 'node:path';

const types = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg'};
const assets = {};
function collect(dir, prefix = '') {
  for (const entry of readdirSync(dir,{withFileTypes:true})) {
    if (entry.name.startsWith('.') || entry.name === 'server') continue;
    const path = prefix + '/' + entry.name;
    if (entry.isDirectory()) collect(dir+'/'+entry.name,path);
    else if (types[extname(entry.name)]) {
      assets[path] = {type:types[extname(entry.name)],data:readFileSync(dir+'/'+entry.name).toString('base64')};
    }
  }
}
collect('dist');
mkdirSync('dist/server',{recursive:true});
const catalog = JSON.parse(readFileSync('dist/catalog.js','utf8').replace(/^window\.storeCatalog\s*=\s*/, '').trim().replace(/;$/, ''));
writeFileSync('dist/server/index.js','const assets = '+JSON.stringify(assets)+';\nconst defaultCatalog = '+JSON.stringify(catalog)+';\n'+readFileSync('worker/index.mjs','utf8'));

