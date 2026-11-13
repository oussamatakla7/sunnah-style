const english = document.documentElement.lang === 'en';
const temporaryPrice = 100;
const money = amount => '$' + amount.toLocaleString('en-US');
const temporaryLabel = english ? 'Temporary price' : 'سعر مؤقّت';
const totalLabel = english ? 'Estimated total' : 'المجموع التقديري';
const translations = {
  "الكل": "All",
  "فساتين سهرة": "Evening dresses",
  "فساتين يومية": "Everyday dresses",
  "أطقم رياضية": "Sportswear sets",
  "أسود": "Black",
  "كحلي": "Navy",
  "زيتي": "Olive",
  "زيتي فاتح": "Light olive",
  "بوردو": "Burgundy",
  "بيج": "Beige",
  "بني": "Brown",
  "زهري": "Pink",
  "موف": "Mauve",
  "برتقالي": "Orange",
  "كافا": "Taupe",
  "توتي": "Berry",
  "تركواز": "Turquoise",
  "One Size": "One size",
  "ما لقينا موديلات مطابقة.": "No matching styles.",
  "الصورة قريباً": "Photo coming soon",
  "تفاصيل": "Details for",
  "شوفي التفاصيل": "View details",
  "السعر والتوفّر بيتأكدوا عبر واتساب.": "Price and availability are confirmed on WhatsApp.",
  "اللون": "Color",
  "القياس": "Size",
  "أضيفي للحقيبة": "Add to bag",
  "انضاف الموديل للحقيبة": "Added to your bag",
  "إزالة القطعة": "Remove item",
  "خفّضي الكمية": "Decrease quantity",
  "زيدي الكمية": "Increase quantity",
  "الحقيبة بعدها فاضية.": "Your bag is empty.",
  "السلام عليكم فريق سنّة ستايل، بدي أطلب هيدا الأوردر:": "Assalamu alaikum Sunnah Style team, I would like to place this order:",
  "قياس": "Size",
  "الكمية": "Quantity",
  "أرسلي طلبكِ عبر واتساب": "Send your order on WhatsApp",
  "منأكّد السعر والتوفّر معكِ على واتساب قبل الدفع.": "We confirm the price and availability on WhatsApp before payment.",
  "يُحدّد عبر واتساب": "Confirm on WhatsApp"
};
const localize = text => english ? translations[text] ?? text : text;
const englishNames = ["Plain zip dress","Designed zip dress","Orange evening dress","Evening dress with bodice detail","Evening dress without chiffon","Chiffon evening dress","Plain dress with bodice detail","Flared chiffon dress","Loose everyday dress","Bow dress","Button-front dress","Button dress with detailing","Gathered dress with sleeves","Sport skirt and jacket set"];
const categories = ['الكل', 'فساتين سهرة', 'فساتين يومية', 'أطقم رياضية'].map(localize);
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
  sku: 'SSBM' + String(number).padStart(4, '0'), category, name: english ? englishNames[number - 1] : name, variants,
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
const requestedCategory = Number(new URLSearchParams(location.search).get('category'));
let activeCategory = Number.isInteger(requestedCategory) && requestedCategory >= 1 && requestedCategory < categories.length ? requestedCategory : 0;
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
    && [product.name, product.sku, categories[product.category], ...product.variants.flatMap(([color]) => [color[0], localize(color[0])])]
      .some(value => value.toLowerCase().includes(query))
  );
  $('results').textContent = visible.length ? `${visible.length} ${english ? (visible.length === 1 ? "style" : "styles") : "موديل"}` : localize('ما لقينا موديلات مطابقة.');
  products.innerHTML = visible.map(product => `
    <article class="product">
      <div class="product-art" data-cat="${product.category - 1}"><span>${localize('الصورة قريباً')}</span></div>
      <div class="product-info">
        <small dir="ltr">${product.sku}</small>
        <h3>${product.name}</h3><p class="item-price"><bdi>${money(temporaryPrice)}</bdi> <small>${temporaryLabel}</small></p>
        <div class="swatches" aria-label="${product.variants.map(([color]) => localize(color[0])).join(english ? ', ' : '، ')}">
          ${product.variants.map(([color]) => `<i title="${localize(color[0])}" style="background:${color[1]}"></i>`).join('')}
        </div>
        <button data-product="${product.sku}" aria-label="${localize('تفاصيل')} ${product.name}">${localize('شوفي التفاصيل')}</button>
      </div>
    </article>`).join('');
}

function showProduct(product) {
  $('detail-body').innerHTML = `
    <p><bdi>${product.sku}</bdi> · ${categories[product.category]}</p>
    <h2 id="detail-title">${product.name}</h2><p class="item-price"><bdi>${money(temporaryPrice)}</bdi> <small>${temporaryLabel}</small></p>
    <p>${localize('السعر والتوفّر بيتأكدوا عبر واتساب.')}</p>
    <form id="add-form">
      <label>${localize('اللون')}<select id="color">${product.variants.map(([color], i) => `<option value="${i}">${localize(color[0])}</option>`).join('')}</select></label>
      <label>${localize('القياس')}<select id="size"></select></label>
      <button type="submit" class="button">${localize('أضيفي للحقيبة')}</button>
    </form>`;
  const color = $('color');
  const size = $('size');
  const updateSizes = () => {
    const sizes = product.variants[Number(color.value)][1] || [genericSize];
    size.replaceChildren(...sizes.map(value => new Option(localize(String(value)), String(value))));
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
    $('toast').textContent = localize('انضاف الموديل للحقيبة');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('toast').textContent = ''; }, 2600);
  });
  detail.showModal();
}

function renderCart(focusIndex, focusAction) {
  const lines = bag.map(item => {
    const product = catalog.find(product => product.sku === item.sku);
    return { ...item, name: product.name, colorName: localize(product.variants[item.color][0][0]) };
  });
  $('cart-lines').innerHTML = lines.length ? lines.map((item, index) => `
    <div class="cart-line"><div><strong>${item.name}</strong><small>${item.colorName} · <bdi>${localize(item.size)}</bdi> · <bdi>${money(temporaryPrice * item.quantity)}</bdi></small></div>
      <div class="quantity"><button data-index="${index}" data-action="minus" aria-label="${item.quantity === 1 ? localize('إزالة القطعة') : localize('خفّضي الكمية')}">−</button><span>${item.quantity}</span><button data-index="${index}" data-action="plus" aria-label="${localize('زيدي الكمية')}" ${item.quantity === 99 ? 'disabled' : ''}>+</button></div>
    </div>`).join('') : `<p>${localize('الحقيبة بعدها فاضية.')}</p>`;
  if (!lines.length) {
    $('checkout').replaceChildren();
    if (focusAction) cart.querySelector('[data-close]').focus();
    return;
  }
  const total = lines.reduce((sum, item) => sum + temporaryPrice * item.quantity, 0);
  const message = [localize('السلام عليكم فريق سنّة ستايل، بدي أطلب هيدا الأوردر:'), '', ...lines.map(item =>
    `• ${item.name} (${item.sku}) — ${localize('اللون')}: ${item.colorName} — ${localize('قياس')} ${localize(item.size)} — ${localize('الكمية')} ${item.quantity} × ${money(temporaryPrice)} = ${money(temporaryPrice * item.quantity)}`
  ), '', totalLabel + ': ' + money(total)].join('\n');
  const link = document.createElement('a');
  link.className = 'button';
  link.href = whatsapp + '?text=' + encodeURIComponent(message);
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = localize('أرسلي طلبكِ عبر واتساب');
  const note = document.createElement('p');
  note.textContent = localize('منأكّد السعر والتوفّر معكِ على واتساب قبل الدفع.');
  const summary = document.createElement('p');
  summary.className = 'cart-total';
  const amount = document.createElement('bdi');
  amount.textContent = money(total);
  summary.append(totalLabel, amount);
  $('checkout').replaceChildren(summary, note, link);
  if (focusAction) {
    const row = $('cart-lines').children[Math.min(focusIndex, lines.length - 1)];
    (row.querySelector(`[data-action="${focusAction}"]:not(:disabled)`) || row.querySelector('button')).focus();
  }
}

if (categoriesPanel) {
  categoriesPanel.innerHTML = categories.map((category, index) =>
    `<button data-category="${index}" aria-pressed="${index === activeCategory}">${category}</button>`
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
  search.value = new URLSearchParams(location.search).get('q') ?? '';
  search.addEventListener('input', renderCatalog);
  renderCatalog();
}
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
