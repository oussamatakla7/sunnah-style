const categories = ['الكل', 'فساتين سهرة', 'فساتين يومية', 'أطقم رياضية'];
const black = ['أسود', '#242323'];
const navy = ['كحلي', '#26364b'];
const olive = ['زيتي', '#646a47'];
const paleOlive = ['زيتي فاتح', '#9da27d'];
const burgundy = ['بوردو', '#733445'];
const beige = ['بيج', '#d8c3a3'];
const brown = ['بني', '#76523e'];
const pink = ['زهري', '#c9829c'];
const oneSize = ['One Size'];

const catalog = [
  [1, 1, 'فستان سادة بسحّاب', [[black, [38, 40, 44]], [['موف', '#866688'], [40]]]],
  [2, 1, 'فستان بسحّاب مع تصميم', [[olive, [40, 44]], [burgundy, [40, 42]]]],
  [3, 1, 'فستان سهرة برتقالي', [[['برتقالي', '#b8633c'], [40, 46]]]],
  [4, 1, 'فستان بتصميم عند الصدر', [[pink], [black, [38, 40]], [navy, [42]]]],
  [5, 1, 'فستان سهرة بلا شيفون', [[black, [42]]]],
  [6, 1, 'فستان سهرة مع شيفون', [[navy, [38, 40, 42]]]],
  [7, 1, 'فستان سادة بتصميم عند الصدر', [[black, [40]]]],
  [8, 1, 'فستان شيفون كلوش', [[black, [38, 42, 44, 46, 48, 52]], [navy, [38, 46, 48, 50, 52]], [brown, [48, 50, 52]]]],
  [9, 2, 'فستان يومي واسع', [[black, [42]], [beige, oneSize]]],
  [10, 2, 'فستان مع ربطة', [[black, [1, 2, 3]], [navy, [1, 2, 3]], [brown, [1, 2]], [burgundy, [2, 3]], [paleOlive, [2, 3]]]],
  [11, 2, 'فستان بأزرار أمامية', [[black, [1, 2]], [beige, [2, 3]], [['كافا', '#a38874'], [2, 3]], [paleOlive, [2, 3]], [['توتي', '#864f64'], [1, 2]]]],
  [12, 2, 'فستان بأزرار مع تصميم', [[black], [brown], [beige, [2, 3]], [paleOlive, [2, 3]]]],
  [13, 2, 'فستان مكشكش مع أكمام', [black, burgundy, beige, olive, ['تركواز', '#408782']].map(color => [color, [38, 40, 42, 44]])],
  [14, 3, 'طقم رياضي بتنورة وجاكيت', [brown, olive, black].map(color => [color, oneSize])],
].map(([number, category, name, variants]) => ({
  sku: 'SSBM' + String(number).padStart(4, '0'), category, name, variants,
}));

const $ = id => document.getElementById(id);
const products = $('products');
const categoriesPanel = $('categories');
const search = $('search');
const detail = $('detail');
const cart = $('cart');
const whatsapp = 'https://wa.me/96176089416';
const storageKey = 'sunnah-style-bag';
const genericSize = 'يُحدّد عبر واتساب';
let activeCategory = 0;
let toastTimer;
let bag = readBag();

function readBag() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (!Array.isArray(stored)) return [];
    return stored.filter(item => {
      const product = catalog.find(product => product.sku === item?.sku);
      const variant = product?.variants[item.color];
      return variant && (variant[1] || [genericSize]).map(String).includes(item.size)
        && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 99;
    });
  } catch {
    return [];
  }
}

function saveBag() {
  try { localStorage.setItem(storageKey, JSON.stringify(bag)); } catch {}
  $('count').textContent = bag.reduce((sum, item) => sum + item.quantity, 0);
}

function renderCatalog() {
  const query = search.value.trim().toLowerCase();
  const visible = catalog.filter(product =>
    (!activeCategory || product.category === activeCategory)
    && [product.name, product.sku, categories[product.category], ...product.variants.map(([color]) => color[0])]
      .some(value => value.toLowerCase().includes(query))
  );
  $('results').textContent = visible.length ? visible.length + ' موديل' : 'ما لقينا موديلات مطابقة.';
  products.innerHTML = visible.map(product => `
    <article class="product">
      <div class="product-art" data-cat="${product.category - 1}"><img src="assets/logo.jpg" loading="lazy" alt=""></div>
      <div class="product-info">
        <small dir="ltr">${product.sku}</small>
        <h3>${product.name}</h3>
        <div class="swatches" aria-label="${product.variants.map(([color]) => color[0]).join('، ')}">
          ${product.variants.map(([color]) => `<i title="${color[0]}" style="background:${color[1]}"></i>`).join('')}
        </div>
        <button data-product="${product.sku}" aria-label="تفاصيل ${product.name}">شوفي التفاصيل</button>
      </div>
    </article>`).join('');
}

function showProduct(product) {
  $('detail-body').innerHTML = `
    <p><bdi>${product.sku}</bdi> · ${categories[product.category]}</p>
    <h2 id="detail-title">${product.name}</h2>
    <p>السعر والتوفّر بيتأكدوا عبر واتساب.</p>
    <form id="add-form">
      <label>اللون<select id="color">${product.variants.map(([color], i) => `<option value="${i}">${color[0]}</option>`).join('')}</select></label>
      <label>القياس<select id="size"></select></label>
      <button type="submit" class="button">أضيفي للحقيبة</button>
    </form>`;
  const color = $('color');
  const size = $('size');
  const updateSizes = () => {
    const sizes = product.variants[Number(color.value)][1] || [genericSize];
    size.replaceChildren(...sizes.map(value => new Option(String(value))));
  };
  color.addEventListener('change', updateSizes);
  updateSizes();
  $('add-form').addEventListener('submit', event => {
    event.preventDefault();
    const colorIndex = Number(color.value);
    const item = bag.find(line => line.sku === product.sku && line.color === colorIndex && line.size === size.value);
    if (item) item.quantity = Math.min(99, item.quantity + 1);
    else bag.push({sku: product.sku, color: colorIndex, size: size.value, quantity: 1});
    saveBag();
    detail.close();
    $('toast').textContent = 'انضاف الموديل للحقيبة';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('toast').textContent = ''; }, 2600);
  });
  detail.showModal();
}

function renderCart(focusIndex, focusAction) {
  const lines = bag.map(item => {
    const product = catalog.find(product => product.sku === item.sku);
    return { ...item, name: product.name, colorName: product.variants[item.color][0][0] };
  });
  $('cart-lines').innerHTML = lines.length ? lines.map((item, index) => `
    <div class="cart-line"><div><strong>${item.name}</strong><small>${item.colorName} · <bdi>${item.size}</bdi></small></div>
      <div class="quantity"><button data-index="${index}" data-action="minus" aria-label="${item.quantity === 1 ? 'إزالة القطعة' : 'خفّضي الكمية'}">−</button><span>${item.quantity}</span><button data-index="${index}" data-action="plus" aria-label="زيدي الكمية" ${item.quantity === 99 ? 'disabled' : ''}>+</button></div>
    </div>`).join('') : '<p>الحقيبة بعدها فاضية.</p>';
  if (!lines.length) {
    $('checkout').replaceChildren();
    if (focusAction) cart.querySelector('[data-close]').focus();
    return;
  }
  const message = ['مرحبا Sunnah Style، بدي استفسر عن السعر والتوفّر لهيدي القطع:', '', ...lines.map(item =>
    `• ${item.name} (${item.sku}) — ${item.colorName} — قياس ${item.size} — الكمية ${item.quantity}`
  )].join('\n');
  const link = document.createElement('a');
  link.className = 'button';
  link.href = whatsapp + '?text=' + encodeURIComponent(message);
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = 'ابعتي الطلب ع واتساب';
  const note = document.createElement('p');
  note.textContent = 'المحل بيأكّد السعر والتوفّر وبيتابع الطلب معك ع واتساب.';
  $('checkout').replaceChildren(note, link);
  if (focusAction) {
    const row = $('cart-lines').children[Math.min(focusIndex, lines.length - 1)];
    (row.querySelector(`[data-action="${focusAction}"]:not(:disabled)`) || row.querySelector('button')).focus();
  }
}

categoriesPanel.innerHTML = categories.map((category, index) =>
  `<button data-category="${index}" aria-pressed="${index === 0}">${category}</button>`
).join('');
categoriesPanel.addEventListener('click', event => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  activeCategory = Number(button.dataset.category);
  for (const option of categoriesPanel.children) option.setAttribute('aria-pressed', String(option === button));
  renderCatalog();
});
products.addEventListener('click', event => {
  const button = event.target.closest('[data-product]');
  if (button) showProduct(catalog.find(product => product.sku === button.dataset.product));
});
search.addEventListener('input', renderCatalog);
$('open-cart').addEventListener('click', () => {
  renderCart();
  cart.showModal();
});
$('cart-lines').addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const index = Number(button.dataset.index);
  const action = button.dataset.action;
  bag[index].quantity += action === 'plus' ? 1 : -1;
  if (bag[index].quantity === 0) bag.splice(index, 1);
  saveBag();
  renderCart(index, action);
});
for (const dialog of [detail, cart]) dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
saveBag();
renderCatalog();

