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
const productPage = readFileSync('dist/shop.html','utf8')
  .replace(/<title>[^<]*<\/title>/, '<title>تفاصيل القطعة | Sunnah Style by Mona</title>')
  .replace(/<main>[\s\S]*?<\/main>/, '<main class="product-page"><a class="product-back" href="/shop">المتجر</a><div id="detail-body"></div><noscript>فعّلي JavaScript لعرض تفاصيل القطعة.</noscript></main>')
  .replace(/<dialog id="detail"[\s\S]*?<\/dialog>/, '')
  .replace('</head>', '<link rel="stylesheet" href="/assets/product-grid.css"></head>');
assets['/product.html'] = {type:types['.html'],data:Buffer.from(productPage).toString('base64')};
mkdirSync('dist/server',{recursive:true});
const catalog = JSON.parse(readFileSync('dist/catalog.js','utf8').replace(/^window\.storeCatalog\s*=\s*/, '').trim().replace(/;$/, ''));
writeFileSync('dist/server/index.js','const assets = '+JSON.stringify(assets)+';\nconst defaultCatalog = '+JSON.stringify(catalog)+';\n'+readFileSync('worker/index.mjs','utf8'));

