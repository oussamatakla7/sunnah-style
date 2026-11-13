const $ = id => document.getElementById(id);
let products;
let pages;
let revision;
let currentSku = '';
let image = '';
let activePage;
let publishedPages = [];
const basePages = {index:['الرئيسية','/'],shop:['المتجر','/shop'],contact:['تواصلي معنا','/contact']};
const parsePage = html => new DOMParser().parseFromString(html, 'text/html');
const sectionSelector = 'main > section, main > div, main > article';
const layoutSelector = part => part === 'header' ? 'body > header.bar' : 'body > footer';
const isLayout = () => activePage?.startsWith('layout-');
const pageName = key => basePages[key]?.[0] || parsePage(pages[key]).title.split(' | Sunnah Style')[0];
let openRequest = 0;
let loadedPage;
let originalLayout;
const frame = $('preview');
const builder = frame.closest('.builder');
const mobileTabs = document.createElement('div');
mobileTabs.className = 'mobile-builder-tabs';
builder.before(mobileTabs);
function mobilePane(pane) {
  builder.dataset.pane = pane;
  for (const button of mobileTabs.children) button.setAttribute('aria-pressed', String(button.dataset.pane === pane));
}
for (const [pane, label] of [['preview','المعاينة'],['tools','أدوات التعديل']]) {
  const button = document.createElement('button');
  button.textContent = label;
  button.dataset.pane = pane;
  button.onclick = () => mobilePane(pane);
  mobileTabs.append(button);
}
mobilePane('preview');
function labelCells(row, labels) {
  labels.forEach((label, index) => { row.cells[index].dataset.label = label; });
}
const status = message => { $('status').textContent = message; };
function upload(file, callback) {
  if (!file || !/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
    status('اختاري صورة JPEG أو PNG أو WebP أو GIF.');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      callback(canvas.toDataURL('image/jpeg', .82));
    };
    img.onerror = () => status('تعذّر قراءة الصورة.');
    img.src = reader.result;
  };
  reader.onerror = () => status('تعذّر قراءة الصورة.');
  reader.readAsDataURL(file);
}

let view = 'pages';
let productsOnly = false;
const userTab = document.createElement('button');
userTab.type = 'button';
userTab.dataset.tab = 'users';
userTab.textContent = '♙ المستخدمون';
userTab.hidden = true;
document.querySelector('.side').append(userTab);
function showView(next) {
  if (productsOnly && !next.startsWith('product')) return;
  if (view === 'page-editor' && next !== view && !applyInspector()) return;
  view = next;
  for (const id of ['pages','products','layout','menu-editor','page-editor','product-editor','users']) $(id).hidden = id !== next;
  for (const button of document.querySelectorAll('.side [data-tab]')) {
    if (button.dataset.tab === (next === 'users' ? 'users' : next.startsWith('product') ? 'products' : next === 'menu-editor' || next === 'layout' || (next === 'page-editor' && $('page').value.startsWith('layout-')) ? 'layout' : 'pages')) button.setAttribute('aria-current','page');
    else button.removeAttribute('aria-current');
  }
  const target = {'page-editor':'page-actions','product-editor':'product-actions',products:'list-actions',layout:'layout-actions','menu-editor':'menu-actions'}[next];
  $('actions').hidden = !target;
  if (target) $(target).append($('actions'));
  if (next === 'users') refreshUsers();
}
for (const button of document.querySelectorAll('[data-tab]')) button.onclick = () => showView(button.dataset.tab);
function editPage(key, title) {
  if (!pages) return;
  $('page').value = key;
  $('page-title').textContent = title;
  $('editor-back').textContent = key.startsWith('layout-') ? 'الهيدر والفوتر' : 'الصفحات';
  showView('page-editor');
  mobilePane(key.startsWith('/pages/') && !parsePage(pages[key]).querySelector('main').children.length ? 'tools' : 'preview');
  openPage();
}
$('editor-back').onclick = () => showView(isLayout() ? 'layout' : 'pages');
function listPages() {
  $('page-rows').replaceChildren(...[...Object.keys(basePages), ...Object.keys(pages).filter(key => key.startsWith('/pages/'))].map(key => {
    const row = document.createElement('tr');
    row.insertCell().textContent = pageName(key);
    const link = row.insertCell();
    if (basePages[key] || publishedPages.includes(key)) {
      const a = document.createElement('a');
      Object.assign(a, {href:basePages[key]?.[1] || key, target:'_blank', rel:'noopener', textContent:'عرض الصفحة'});
      link.append(a);
    } else link.textContent = key + ' · مسودّة';
    const edit = document.createElement('button');
    edit.textContent = 'تعديل بصري';
    edit.onclick = () => editPage(key, pageName(key));
    row.insertCell().append(edit);
    labelCells(row, ['','الرابط','']);
    return row;
  }));
}
$('new-page').onclick = () => { $('new-page-form').hidden = false; $('new-title').focus(); };
$('cancel-page').onclick = () => { $('new-page-form').hidden = true; };
async function sourceFor(key) {
  if (pages[key]) return pages[key];
  const response = await fetch('/' + key + '.html');
  if (!response.ok) throw Error();
  return response.text();
}
$('new-page-form').onsubmit = async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const name = $('new-title').value.trim();
  const key = '/pages/' + $('new-slug').value;
  if (!name || Object.hasOwn(pages, key)) return status('أدخلي اسمًا ورابطًا غير مستخدم.');
  const submit = form.querySelector('button');
  submit.disabled = true;
  try {
    const doc = parsePage(await sourceFor('contact'));
    doc.title = name + ' | Sunnah Style';
    doc.querySelector('meta[name=description]')?.remove();
    doc.querySelector('main').replaceChildren();
    doc.querySelectorAll('[aria-current=page]').forEach(node => node.removeAttribute('aria-current'));
    const base = doc.createElement('base');
    base.href = '/';
    doc.head.prepend(base);
    pages[key] = '<!doctype html>\n' + doc.documentElement.outerHTML;
    form.reset();
    form.hidden = true;
    listPages();
    editPage(key, name);
    status('أضيفت الصفحة. اختاري العناصر لبنائها ثم احفظي المسودّة أو انشريها.');
  } catch { status('تعذّر إنشاء الصفحة.'); }
  finally { submit.disabled = false; }
};
for (const button of document.querySelectorAll('[data-layout]')) button.onclick = () =>
  editPage('layout-' + button.dataset.layout, button.textContent);
for (const button of document.querySelectorAll('[data-width]')) button.onclick = () => {
  frame.dataset.width = button.dataset.width;
  for (const choice of document.querySelectorAll('[data-width]')) choice.setAttribute('aria-pressed', String(choice === button));
};

const nodes = () => {
  const doc = frame.contentDocument;
  const root = isLayout() ? doc.querySelector(layoutSelector(activePage.slice(7))) : doc.querySelector('main');
  if (!root) return [];
  const targets = 'h1,h2,h3,h4,p,a:not(:has(img,svg)),img,iframe,hr,[data-builder-widget],.campaign';
  return [...(isLayout() ? [root] : root.querySelectorAll(sectionSelector)), ...root.querySelectorAll(targets)];
};
let highlighted;
let hoverNode;
function mark(node, style) {
  if (!node) return;
  node.style.setProperty('outline', style);
  node.style.setProperty('outline-offset','-2px');
}
const originalOutlines = new WeakMap();
function outline(node, color) {
  if (!node) return;
  if (!originalOutlines.has(node)) originalOutlines.set(node, node.getAttribute('style'));
  mark(node, '2px solid ' + color);
}
function restoreOutline(node) {
  if (!node || !originalOutlines.has(node)) return;
  const old = originalOutlines.get(node);
  if (old === null) node.removeAttribute('style');
  else node.setAttribute('style',old);
  originalOutlines.delete(node);
}
function clearOutlines() {
  restoreOutline(hoverNode);
  restoreOutline(highlighted);
}
function highlight() {
  clearOutlines();
  hoverNode = null;
  highlighted = selectedNode();
  outline(highlighted, '#a02562');
}
function listElements(selected) {
  if (!applyInspector(false)) return;
  const items = nodes();
  $('element').replaceChildren(...items.map((node, index) => {
    const label = {HR:'فاصل',HEADER:'الهيدر',FOOTER:'الفوتر',SECTION:'قسم',IMG:'صورة',IFRAME:'الخريطة'}[node.tagName];
    return new Option(label || (node.classList.contains('campaign') ? 'صورة الغلاف' : node.textContent.trim().slice(0, 60) || 'عنصر'), index);
  }));
  if (selected) $('element').value = items.indexOf(selected);
  loadElement();
}
const selectedNode = () => nodes()[$('element').selectedIndex];
let inspectorNode;
const inspectorChanges = new Set();
for (const id of ['content','element-link','ink','fill','font','padding']) {
  $(id).addEventListener('input', () => {
    inspectorChanges.add(id);
    status('في تعديلات بانتظار الحفظ أو النشر.');
  });
}
function loadElement() {
  inspectorChanges.clear();
  const node = selectedNode();
  inspectorNode = node;
  highlight();
  $('apply').disabled = !node;
  $('section-tools').hidden = isLayout() || !node;
  if (!node) return;
  const isSection = node.matches('header,footer,' + sectionSelector + ',hr,[data-builder-widget=space]');
  const isCover = node.classList.contains('campaign');
  $('content').disabled = isSection || isCover || node.matches('a:has(*), p:has(*)');
  $('content').value = isSection || isCover ? '' : node.matches('img,iframe') ? node.getAttribute('src') : node.textContent.trim();
  $('element-link-field').hidden = !node.matches('a');
  $('element-link').value = node.getAttribute('href') || '';
  $('page-image').disabled = !isCover && !node.matches('img');
  const style = frame.contentWindow.getComputedStyle(node);
  const hex = value => '#' + (value.match(/\d+/g) || []).slice(0,3).map(n => Number(n).toString(16).padStart(2,'0')).join('');
  $('ink').value = hex(style.color);
  $('fill').value = hex(style.backgroundColor);
  $('font').value = parseFloat(node.style.fontSize) || '';
  $('padding').value = parseFloat(node.style.padding) || '';
  $('page-image').value = '';
  delete $('ink').dataset.changed;
  delete $('fill').dataset.changed;
}
for (const id of ['ink','fill']) $(id).oninput = () => { $(id).dataset.changed = '1'; };
function savePage() {
  clearOutlines();
  const doc = frame.contentDocument;
  const copy = doc.documentElement.cloneNode(true);
  delete copy.dataset.editorRequest;
  copy.querySelectorAll('[data-editor-only]').forEach(node => node.remove());
  if (!isLayout() && originalLayout) {
    for (const part of ['header','footer']) {
      const original = originalLayout.querySelector(layoutSelector(part));
      if (original) copy.querySelector(layoutSelector(part))?.replaceWith(original.cloneNode(true));
    }
  }
  const target = isLayout() ? copy.querySelector(layoutSelector(activePage.slice(7))) : copy;
  pages[activePage] = '<!doctype html>\n' + target.outerHTML;
  outline(highlighted, '#a02562');
  status('تعديلات بانتظار الحفظ.');
}
async function openPage() {
  const page = $('page').value;
  const request = ++openRequest;
  activePage = page;
  loadedPage = null;
  originalLayout = null;
  $('widget-panel').hidden = true;
  $('apply').disabled = true;
  try {
    let html;
    let original;
    if (page.startsWith('layout-') || Object.keys(pages).some(key => key.startsWith('layout-'))) {
      const doc = parsePage(await sourceFor(page.startsWith('layout-') ? 'index' : page));
      original = doc.cloneNode(true);
      for (const part of ['header','footer']) {
        const fragment = pages['layout-' + part];
        if (!fragment) continue;
        const template = doc.createElement('template');
        template.innerHTML = fragment.slice('<!doctype html>'.length);
        doc.querySelector(layoutSelector(part))?.replaceWith(template.content);
      }
      if (page.startsWith('layout-')) {
        doc.body.replaceChildren(doc.querySelector(layoutSelector(page.slice(7))));
      }
      html = '<!doctype html>\n' + doc.documentElement.outerHTML;
    } else html = await sourceFor(page);
    if (request === openRequest) {
      originalLayout = original;
      const doc = parsePage(html);
      doc.documentElement.dataset.editorRequest = String(request);
      frame.srcdoc = '<!doctype html>\n' + doc.documentElement.outerHTML;
    }
  } catch { if (request === openRequest) status('تعذّر تحميل الصفحة للمعاينة.'); }
}
function addHandles() {
  const doc = frame.contentDocument;
  doc.querySelectorAll('[data-editor-handle]').forEach(node => node.remove());
  for (const section of doc.querySelectorAll(sectionSelector)) {
    const handle = doc.createElement('button');
    handle.type = 'button';
    handle.textContent = 'تعديل القسم';
    handle.dataset.editorOnly = '';
    handle.dataset.editorHandle = '';
    Object.assign(handle.style, {display:'block', margin:'0', padding:'3px 8px', border:'0', font:'12px system-ui', color:'white', background:'#96265c', position:'absolute', zIndex:'3'});
    handle.onclick = event => {
      event.stopPropagation();
      listElements(section);
      if (matchMedia('(max-width:700px)').matches) mobilePane('tools');
    };
    section.prepend(handle);
  }
}
frame.onload = () => {
  const doc = frame.contentDocument;
  if (!activePage || doc?.documentElement.dataset.editorRequest !== String(openRequest)) return;
  loadedPage = activePage;
  clearOutlines();
  highlighted = hoverNode = null;
  $('widget-panel').hidden = isLayout();
  if (!isLayout()) addHandles();
  listElements();
  doc.addEventListener('click', event => {
    if (event.target.closest('a,button,summary')) event.preventDefault();
    const node = nodes().filter(item => item.contains(event.target)).reduce((closest, item) =>
      !closest || closest.contains(item) ? item : closest, null);
    if (node) {
      listElements(node);
      if (matchMedia('(max-width:700px)').matches) mobilePane('tools');
    }
  });
  doc.addEventListener('submit', event => event.preventDefault());
  doc.addEventListener('dragover', event => {
    if (!isLayout() && event.target.closest('main')) event.preventDefault();
  });
  doc.addEventListener('drop', event => {
    if (isLayout() || !event.target.closest('main')) return;
    event.preventDefault();
    const type = event.dataTransfer.getData('text/plain').split(':');
    if (type[0] === 'sunnah-widget' && ['section','h2','p','img','a','hr','space'].includes(type[1])) {
      insertWidget(type[1], event.target.closest('[data-builder-widget], ' + sectionSelector));
    }
  });
};
function insertWidget(type, target = selectedNode()) {
  if (!applyInspector(false)) return;
  const doc = frame.contentDocument;
  const main = doc.querySelector('main');
  if (!main || isLayout() || loadedPage !== activePage) return;
  let section = target?.closest(sectionSelector);
  if (!section || type === 'section') {
    const next = doc.createElement('section');
    next.dataset.builderWidget = 'section';
    next.style.cssText = 'padding:32px max(5vw, 16px);min-height:70px';
    if (section) section.after(next);
    else main.append(next);
    section = next;
  }
  let node = section;
  if (type !== 'section') {
    node = doc.createElement(type === 'space' ? 'div' : type);
    node.dataset.builderWidget = type;
    const content = {h2:'عنوان جديد',p:'اكتبي النص هنا',a:'تسوّقي الآن'};
    if (content[type]) node.textContent = content[type];
    if (type === 'a') { node.className = 'button'; node.href = '/shop'; }
    if (type === 'img') { node.src = '/assets/logo.jpg'; node.alt = ''; node.style.cssText = 'max-width:100%;height:auto'; }
    if (type === 'space') node.style.padding = '24px';
    if (target?.matches('[data-builder-widget]:not(section)') && target.parentElement === section) target.after(node);
    else section.append(node);
  }
  addHandles();
  listElements(node);
  savePage();
}
for (const button of document.querySelectorAll('[data-widget]')) {
  button.onclick = () => insertWidget(button.dataset.widget);
  button.draggable = true;
  button.ondragstart = event => event.dataTransfer.setData('text/plain', 'sunnah-widget:' + button.dataset.widget);
}
for (const id of ['duplicate-node','remove-node']) $(id).onclick = () => {
  if (!applyInspector(false)) return;
  const node = selectedNode();
  if (!node || isLayout() || !node.closest('main')) return;
  clearOutlines();
  if (id === 'remove-node') {
    if (!confirm('حذف هذا العنصر من الصفحة؟')) { highlight(); return; }
    node.remove();
    listElements();
  } else {
    const copy = node.cloneNode(true);
    copy.removeAttribute('id');
    copy.querySelectorAll('[id]').forEach(child => child.removeAttribute('id'));
    node.after(copy);
    addHandles();
    listElements(copy);
  }
  savePage();
};
$('element').onchange = () => {
  const next = selectedNode();
  if (applyInspector(false)) listElements(next);
  else $('element').selectedIndex = nodes().indexOf(inspectorNode);
};
$('page').onchange = openPage;
function applyInspector(refresh = true) {
  if (!inspectorChanges.size) return true;
  const node = inspectorNode;
  if (!node || loadedPage !== activePage) return false;
  let href;
  if (inspectorChanges.has('element-link')) {
    href = $('element-link').value.trim();
    try {
      if (!href || !['https:', 'http:', 'tel:', 'mailto:'].includes(new URL(href, location.origin).protocol)) throw Error();
    } catch { status('أدخلي رابطًا صالحًا.'); return false; }
  }
  for (const id of ['font','padding']) {
    if (inspectorChanges.has(id) && !$(id).reportValidity()) return false;
  }
  if (inspectorChanges.has('content') && !$('content').disabled) {
    const value = $('content').value;
    if (node.matches('img,iframe')) {
      if (node.matches('iframe') && !/^https:\/\/(?:maps\.google\.com|www\.google\.com)\//.test(value)) {
        status('أدخلي رابط خريطة Google صالحًا.');
        return false;
      }
      if (node.matches('img') && !/^(https:\/\/|\/?assets\/|data:image\/jpeg;base64,)/.test(value)) {
        status('أدخلي رابط صورة صالحًا.');
        return false;
      }
      node.setAttribute('src', value);
    } else node.textContent = value;
  }
  if (href !== undefined) node.setAttribute('href', href);
  clearOutlines();
  if ($('ink').dataset.changed) node.style.color = $('ink').value;
  if ($('fill').dataset.changed) node.style.backgroundColor = $('fill').value;
  if (inspectorChanges.has('font')) node.style.fontSize = $('font').value ? $('font').value + 'px' : '';
  if (inspectorChanges.has('padding')) node.style.padding = $('padding').value ? $('padding').value + 'px' : '';
  inspectorChanges.clear();
  savePage();
  if (refresh) listElements(node);
  return true;
}
$('apply').onclick = () => applyInspector();
$('page-image').onchange = event => {
  if (!applyInspector(false)) return;
  const node = selectedNode();
  const page = activePage;
  upload(event.target.files[0], data => {
    if (!node?.isConnected || page !== activePage) return;
    clearOutlines();
    if (node.matches('img')) node.setAttribute('src', data);
    else node.style.backgroundImage = 'url("' + data + '")';
    savePage();
    loadElement();
  });
};
for (const direction of ['up','down']) $(direction).onclick = () => {
  if (!applyInspector(false)) return;
  const section = selectedNode()?.closest(sectionSelector);
  const sibling = direction === 'up' ? section?.previousElementSibling : section?.nextElementSibling;
  if (!sibling) return;
  if (direction === 'up') sibling.before(section);
  else sibling.after(section);
  listElements(section);
  savePage();
};

function addVariant(variant = [['','#242323'],null,'']) {
  const row = document.createElement('div');
  row.className = 'variant';
  row.innerHTML = '<div class="row"><label>اسم اللون<input class="color-name" required></label><label>درجة اللون<input class="color-value" type="color"></label><label>القياسات (مثال: 38، 40، 42)<input class="size-values"></label></div><label>صورة هذا اللون<input class="color-file" type="file" accept="image/*"></label><img alt=""><button type="button">إزالة اللون</button>';
  const field = key => row.querySelector('.'+key);
  field('color-name').value = variant[0][0];
  field('color-value').value = variant[0][1];
  field('size-values').value = (variant[1] || []).map(v => v === 'One Size' ? 'قياس موحّد' : v).join('، ');
  const thumb = row.querySelector('img');
  if (variant[2]) thumb.setAttribute('src', variant[2]);
  field('color-file').onchange = event => upload(event.target.files[0], data => thumb.src = data);
  row.querySelector('button').onclick = () => row.remove();
  $('variants').append(row);
}
function loadProduct(sku) {
  currentSku = sku;
  const item = products.find(p => p.sku === sku);
  for (const id of ['sku','name','description','price','quantity']) $(id).value = item?.[id] ?? '';
  $('sku').readOnly = Boolean(item);
  $('category').value = item?.category ?? 1;
  $('temporary').checked = Boolean(item?.temporary);
  image = item?.image || '';
  $('thumb').hidden = !image;
  if (image) $('thumb').src = image;
  $('image').value = '';
  $('variants').replaceChildren();
  (item?.variants || [[['','#242323'],null,'']]).forEach(addVariant);
  $('delete').disabled = !item;
}

function listProducts() {
  if (!products) return;
  const query = $('product-search').value.trim().toLowerCase();
  const visible = products.filter(item => (item.name + ' ' + item.sku).toLowerCase().includes(query));
  $('product-count').textContent = visible.length + ' من ' + products.length;
  $('product-rows').replaceChildren(...visible.map(item => {
    const row = document.createElement('tr');
    const photo = document.createElement('img');
    photo.className = 'table-photo';
    photo.src = item.image;
    photo.alt = '';
    photo.loading = 'lazy';
    row.insertCell().append(photo);
    for (const value of [item.name,item.sku,$('category').options[item.category-1]?.text,'$'+item.price,item.quantity ?? '—']) row.insertCell().textContent = value;
    const edit = document.createElement('button');
    edit.textContent = 'تعديل';
    edit.setAttribute('aria-label','تعديل '+item.name);
    edit.onclick = () => openProduct(item.sku);
    row.insertCell().append(edit);
    labelCells(row, ['','','الرمز','الفئة','السعر','الكمية','']);
    return row;
  }));
}
function openProduct(sku) {
  if (!products) return;
  loadProduct(sku);
  $('product-title').textContent = sku ? 'تعديل المنتج' : 'إضافة منتج';
  showView('product-editor');
}
$('product-search').oninput = listProducts;
$('new').onclick = () => openProduct('');

$('add-color').onclick = () => addVariant();
$('image').onchange = event => upload(event.target.files[0], data => {
  image = data;
  $('thumb').src = data;
  $('thumb').hidden = false;
});
$('product-form').onsubmit = event => {
  event.preventDefault();
  const sku = $('sku').value.trim().toUpperCase();
  if (sku !== currentSku && products.some(p => p.sku === sku)) return status('رمز القطعة مستخدم.');
  if (!image || !$('variants').children.length) return status('أضيفي صورة ولونًا واحدًا على الأقل.');
  const variants = [...$('variants').children].map(row => {
    const val = key => row.querySelector('.'+key).value.trim();
    const sizes = val('size-values').split(/[,،]/).map(v => v.trim()).filter(Boolean).map(v => v === 'قياس موحّد' ? 'One Size' : v);
    return [[val('color-name'),val('color-value')],sizes.length ? sizes : null,row.querySelector('img').getAttribute('src') || ''];
  });
  if (variants.some(([,sizes]) => sizes?.some(size => size !== 'One Size' && !/^[0-9٠-٩۰-۹]+$/.test(size)))) return status('اكتبي القياسات بالأرقام أو «قياس موحّد».');
  const product = {sku,name:$('name').value.trim(),category:Number($('category').value),description:$('description').value.trim(),price:Number($('price').value),quantity:$('quantity').value === '' ? null : Number($('quantity').value),temporary:$('temporary').checked,image,variants};
  if (!product.name || variants.some(([color]) => !color[0])) return status('أدخلي اسم القطعة وأسماء الألوان.');
  const index = products.findIndex(p => p.sku === currentSku);
  if (index < 0) products.push(product);
  else products[index] = product;
  status('تعديلات بانتظار الحفظ.');
  listProducts();
  loadProduct(sku);
  return true;
};
$('delete').onclick = () => {
  if (!currentSku || !confirm('حذف القطعة من المسودة؟')) return;
  products = products.filter(p => p.sku !== currentSku);
  showView('products');
  status('تعديلات بانتظار الحفظ.');
  listProducts();
};

let menuHeader;
let accountList;
let editingAccount;
function editAccount(account) {
  editingAccount = account;
  $('account-name').value = account?.username || '';
  $('account-name').readOnly = Boolean(account);
  $('account-role').value = account?.role || 'products';
  $('account-role').disabled = account?.username === 'admin' || account?.username === accountList.current;
  $('account-password').value = '';
  $('account-password').required = !account;
  $('password-hint').textContent = account ? 'اتركي كلمة المرور فارغة لتبقى كما هي.' : 'اختاري كلمة مرور من 8 أحرف على الأقل.';
  $('user-form').hidden = false;
  $(account ? 'account-password' : 'account-name').focus();
}
$('new-user').onclick = () => { if (accountList) editAccount(null); };
$('cancel-user').onclick = () => { $('user-form').hidden = true; $('account-password').value = ''; };
async function refreshUsers() {
  try {
    const response = await fetch('/api/admin/users');
    if (!response.ok) throw Error();
    accountList = await response.json();
    $('user-rows').replaceChildren(...accountList.users.map(account => {
      const row = document.createElement('tr');
      row.insertCell().textContent = account.username;
      row.insertCell().textContent = account.role === 'admin' ? 'إدارة كاملة' : 'إدارة المنتجات فقط';
      const cell = row.insertCell();
      const edit = document.createElement('button');
      edit.textContent = 'تعديل';
      edit.onclick = () => editAccount(account);
      cell.append(edit);
      if (account.username !== 'admin' && account.username !== accountList.current) {
        const remove = document.createElement('button');
        remove.textContent = 'حذف';
        remove.className = 'danger';
        remove.onclick = async () => {
          if (confirm('حذف حساب ' + account.username + '؟')) await changeAccount({action:'delete', username:account.username});
        };
        cell.append(remove);
      }
      labelCells(row, ['','الصلاحية','']);
      return row;
    }));
  } catch { status('تعذّر تحميل المستخدمين.'); }
}
async function changeAccount(input) {
  try {
    const response = await fetch('/api/admin/users', {
      method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)
    });
    if (response.status === 409) return status('اسم المستخدم مستخدم أو تغيّرت القائمة. حدّثيها وحاولي مجدّدًا.');
    if (!response.ok) return status('تعذّر تعديل الحساب. تحقّقي من البيانات والصلاحية.');
    $('user-form').reset();
    $('user-form').hidden = true;
    if (input.username === accountList.current && input.password) {
      location.assign('/admin-login');
      return;
    }
    status(input.action === 'delete' ? 'حُذف الحساب.' : 'حُفظ الحساب.');
    await refreshUsers();
  } catch { status('تعذّر حفظ الحساب.'); }
}
$('user-form').onsubmit = async event => {
  event.preventDefault();
  $('save-user').disabled = true;
  try {
    await changeAccount({action:editingAccount ? 'update' : 'create',username:$('account-name').value,
      role:$('account-role').value,password:$('account-password').value});
  } finally { $('save-user').disabled = false; }
};
function appendMenuRow(text = '', href = '') {
  const row = document.createElement('div');
  row.className = 'menu-row';
  row.innerHTML = '<label>اسم الرابط<input required maxlength="100"></label><label>وجهة الرابط<input dir="ltr" required></label><button aria-label="رفع الرابط">↑</button><button aria-label="خفض الرابط">↓</button><button class="danger">حذف</button>';
  const [name, url] = row.querySelectorAll('input');
  name.value = text;
  url.value = href;
  const [up,down,remove] = row.querySelectorAll('button');
  up.onclick = () => row.previousElementSibling?.before(row);
  down.onclick = () => row.nextElementSibling?.after(row);
  remove.onclick = () => row.remove();
  $('menu-rows').append(row);
}
$('add-menu-link').onclick = () => appendMenuRow();
$('edit-menu').onclick = async () => {
  if (!pages) return;
  try {
    const html = pages['layout-header'] || await sourceFor('index');
    menuHeader = parsePage(html).querySelector(layoutSelector('header'));
    menuHeader.querySelectorAll('[aria-current]').forEach(node => node.removeAttribute('aria-current'));
    $('menu-rows').replaceChildren();
    for (const a of menuHeader.querySelectorAll('#page-nav a')) appendMenuRow(a.textContent, a.getAttribute('href'));
    showView('menu-editor');
  } catch { status('تعذّر تحميل القائمة.'); }
};
function saveMenu() {
  const rows = [...$('menu-rows').children];
  const links = [];
  for (const row of rows) {
    const [name,url] = [...row.querySelectorAll('input')].map(input => input.value.trim());
    try {
      if (!name || !url || !['http:','https:','mailto:','tel:'].includes(new URL(url, location.origin).protocol)) throw Error();
    } catch { status('أدخلي اسمًا ووجهة صالحة لكل رابط.'); return false; }
    const link = menuHeader.ownerDocument.createElement('a');
    link.textContent = name;
    link.setAttribute('href', url);
    links.push(link);
  }
  menuHeader.querySelector('#page-nav').replaceChildren(...links);
  pages['layout-header'] = '<!doctype html>\n' + menuHeader.outerHTML;
  return true;
}

async function loadState() {
  const response = await fetch('/api/admin/state');
  if (!response.ok) throw Error();
  const state = await response.json();
  revision = state.revision;
  productsOnly = state.role === 'products';
  if (productsOnly) {
    for (const button of document.querySelectorAll('.side [data-tab]:not([data-tab=products])')) button.hidden = true;
    showView('products');
  } else {
    userTab.hidden = false;
    showView('pages');
  }
  pages = state.draft.pages;
  products = state.draft.products ?? window.storeCatalog;
  publishedPages = state.publishedPages || [];
  if (!productsOnly) listPages();
  listProducts();
  $('new-page').disabled = false;
  $('save').disabled = $('publish').disabled = false;
}
async function commit(action) {
  if (view === 'page-editor' && !applyInspector()) return;
  if (view === 'menu-editor' && !saveMenu()) return;
  if (view === 'product-editor' && (!$('product-form').reportValidity() || !$('product-form').onsubmit(new Event('submit')))) return;
  $('save').disabled = $('publish').disabled = true;
  try {
    const response = await fetch('/api/admin/state', {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({action, revision, content: {pages, products}})
    });
    if (response.status === 409) {
      status('تعدّلت المسودة من جلسة أخرى. حدّثي الصفحة قبل الحفظ.');
      return;
    }
    if (response.status === 413) {
      status('حجم التعديلات كبير. صغّري الصور وحاولي مجددًا.');
      return;
    }
    if (!response.ok) throw Error();
    revision = (await response.json()).revision;
    if (action === 'publish' && !productsOnly) { publishedPages = Object.keys(pages); listPages(); }
    status(action === 'publish' ? 'نُشرت التعديلات على المتجر.' : 'حُفظت المسودة.');
  } catch { status('تعذّر حفظ التعديلات. تحقّقي من تسجيل الدخول وحاولي مجددًا.'); }
  finally { $('save').disabled = $('publish').disabled = false; }
}
$('save').onclick = () => commit('save');
$('publish').onclick = () => commit('publish');
loadState().catch(() => status('تعذّر تحميل المسودة. أعيدي فتح اللوحة.'));
