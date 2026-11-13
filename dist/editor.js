const $ = id => document.getElementById(id);
let products;
let pages;
let revision;
let currentSku = '';
let image = '';
let activePage;
const frame = $('preview');
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
for (const button of document.querySelectorAll('[data-tab]')) {
  button.onclick = () => {
    $('pages').hidden = button.dataset.tab !== 'pages';
    $('products').hidden = button.dataset.tab !== 'products';
  };
}
const nodes = () => [...frame.contentDocument.querySelectorAll(
  'header, main > section, footer, main h1, main h2, main p:not(:empty), main .button, main img, main .campaign, main .location-map'
)];
function listElements(selected) {
  const items = nodes();
  $('element').replaceChildren(...items.map((node, index) => {
    const label = {HEADER:'الهيدر',FOOTER:'الفوتر',SECTION:'قسم',IMG:'صورة',IFRAME:'الخريطة'}[node.tagName];
    return new Option(label || (node.classList.contains('campaign') ? 'صورة الغلاف' : node.textContent.trim().slice(0, 60)), index);
  }));
  if (selected) $('element').value = items.indexOf(selected);
  loadElement();
}
const selectedNode = () => nodes()[Number($('element').value)];
function loadElement() {
  const node = selectedNode();
  if (!node) return;
  const isSection = node.matches('header,section,footer');
  const isCover = node.classList.contains('campaign');
  $('content').disabled = isSection || isCover;
  $('content').value = isSection || isCover ? '' : node.matches('img,iframe') ? node.getAttribute('src') : node.textContent.trim();
  $('page-image').disabled = !isCover && !node.matches('img');
  const style = frame.contentWindow.getComputedStyle(node);
  const hex = value => '#' + (value.match(/\d+/g) || []).slice(0,3).map(n => Number(n).toString(16).padStart(2,'0')).join('');
  $('ink').value = hex(style.color);
  $('fill').value = hex(style.backgroundColor);
  $('font').value = '';
  $('padding').value = '';
  delete $('ink').dataset.changed;
  delete $('fill').dataset.changed;
}
for (const id of ['ink','fill']) $(id).oninput = () => { $(id).dataset.changed = '1'; };
function pageSource() {
  return '<!doctype html>\n' + frame.contentDocument.documentElement.outerHTML;
}
function savePage() {
  pages[activePage] = pageSource();
  status('تعديلات بانتظار الحفظ.');
}
async function openPage() {
  const page = $('page').value;
  try {
    const response = pages[page] ? null : await fetch(page + '.html');
    if (response && !response.ok) throw Error();
    const html = pages[page] || await response.text();
    if ($('page').value !== page) return;
    activePage = page;
    frame.srcdoc = html;
  } catch { status('تعذّر تحميل الصفحة للمعاينة.'); }
}
frame.onload = () => {
  listElements();
  frame.contentDocument.addEventListener('click', event => {
    if (event.target.closest('a,button,summary')) event.preventDefault();
    const node = nodes().findLast(item => item.contains(event.target));
    if (node) listElements(node);
  });
};
$('element').onchange = loadElement;
$('page').onchange = openPage;
$('apply').onclick = () => {
  const node = selectedNode();
  if (!node) return;
  if (!$('content').disabled) {
    const value = $('content').value;
    if (node.matches('img,iframe')) {
      if (node.matches('iframe') && !/^https:\/\/(?:maps\.google\.com|www\.google\.com)\//.test(value)) {
        status('أدخلي رابط خريطة Google صالحًا.');
        return;
      }
      if (node.matches('img') && !/^(https:\/\/|assets\/|data:image\/jpeg;base64,)/.test(value)) {
        status('أدخلي رابط صورة صالحًا.');
        return;
      }
      node.setAttribute('src', value);
    } else node.textContent = value;
  }
  if ($('ink').dataset.changed) node.style.color = $('ink').value;
  if ($('fill').dataset.changed) node.style.backgroundColor = $('fill').value;
  if ($('font').value) node.style.fontSize = $('font').value + 'px';
  if ($('padding').value) node.style.padding = $('padding').value + 'px';
  savePage();
};
$('page-image').onchange = event => {
  const node = selectedNode();
  const page = activePage;
  upload(event.target.files[0], data => {
    if (!node?.isConnected || page !== activePage) return;
    if (node.matches('img')) node.setAttribute('src', data);
    else node.style.backgroundImage = 'url("' + data + '")';
    savePage();
    loadElement();
  });
};
for (const direction of ['up','down']) $(direction).onclick = () => {
  const section = selectedNode()?.closest('main > section');
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
function listProducts(sku) {
  $('product').replaceChildren(new Option('منتج جديد',''), ...products.map(p => new Option(p.name + ' · ' + p.sku,p.sku)));
  $('product').value = sku;
  loadProduct(sku);
}
$('product').onchange = () => loadProduct($('product').value);
$('new').onclick = () => listProducts('');
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
  listProducts(sku);
};
$('delete').onclick = () => {
  if (!currentSku || !confirm('حذف القطعة من المسودة؟')) return;
  products = products.filter(p => p.sku !== currentSku);
  status('تعديلات بانتظار الحفظ.');
  listProducts(products[0]?.sku || '');
};

async function loadState() {
  const response = await fetch('/api/admin/state');
  if (!response.ok) throw Error();
  const state = await response.json();
  revision = state.revision;
  pages = state.draft.pages;
  products = state.draft.products ?? window.storeCatalog;
  listProducts(products[0]?.sku || '');
  await openPage();
  $('save').disabled = $('publish').disabled = false;
}
async function commit(action) {
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
    status(action === 'publish' ? 'نُشرت التعديلات على المتجر.' : 'حُفظت المسودة.');
  } catch { status('تعذّر حفظ التعديلات. تحقّقي من تسجيل الدخول وحاولي مجددًا.'); }
  finally { $('save').disabled = $('publish').disabled = false; }
}
$('save').onclick = () => commit('save');
$('publish').onclick = () => commit('publish');
loadState().catch(() => status('تعذّر تحميل المسودة. أعيدي فتح اللوحة.'));