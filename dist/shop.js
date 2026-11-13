const english = document.documentElement.lang === 'en';
const sizeLabel = value => value === "One Size" ? "قياس موحّد" : String(value);
const escapeHtml = value => String(value ?? "").replace(/[&<>"\x27]/g, char => "&#" + char.charCodeAt(0) + ";");
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
  "لم نجد قطعًا مطابقة لبحثكِ.": "No matching styles.",
  "تفاصيل": "Details for",
  "عرض التفاصيل": "View details",
  "نؤكّد السعر والتوفّر عبر واتساب.": "Price and availability are confirmed on WhatsApp.",
  "اللون": "Color",
  "القياس": "Size",
  "أضيفي إلى السلة": "Add to bag",
  "أُضيفت القطعة إلى السلة": "Added to your bag",
  "إزالة القطعة": "Remove item",
  "خفّضي الكمية": "Decrease quantity",
  "زيدي الكمية": "Increase quantity",
  "سلة التسوّق فارغة.": "Your bag is empty.",
  "السلام عليكم فريق سنّة ستايل، بدي أطلب هيدا الأوردر:": "Assalamu alaikum Sunnah Style team, I would like to place this order:",
  "قياس": "Size",
  "الكمية": "Quantity",
  "إرسال الطلب عبر واتساب": "Send your order on WhatsApp",
  "نؤكّد السعر والتوفّر عبر واتساب قبل الدفع.": "We confirm the price and availability on WhatsApp before payment.",
  "يُحدّد عبر واتساب": "Confirm on WhatsApp"
};
const localize = text => english ? translations[text] ?? text : text;
const englishNames = ["Plain zip dress","Designed zip dress","Orange evening dress","Evening dress with bodice detail","Evening dress without chiffon","Chiffon evening dress","Plain dress with bodice detail","Flared chiffon dress","Loose everyday dress","Bow dress","Button-front dress","Button dress with detailing","Gathered dress with sleeves","Sport skirt and jacket set"];
const categories = ['الكل', 'فساتين سهرة', 'فساتين يومية', 'أطقم رياضية'].map(localize);
const catalog = window.storeCatalog;
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
  $('results').textContent = visible.length ? `${visible.length} ${english ? (visible.length === 1 ? "style" : "styles") : "موديل"}` : localize('لم نجد قطعًا مطابقة لبحثكِ.');
  renderProducts(products, visible);
}

function renderProducts(container, items) {
  container.innerHTML = items.map(product => `
    <article class="product">
      <div class="product-art"><img src="${escapeHtml(product.image)}" alt="" width="384" height="384" loading="lazy"></div>
      <div class="product-info">
        <small dir="ltr">${product.sku}</small>
        <h3>${escapeHtml(product.name)}</h3><p class="item-price"><bdi>${money(product.price)}</bdi> ${product.temporary ? '<small>' + temporaryLabel + '</small>' : ''}</p>
        <div class="swatches" aria-label="${product.variants.map(([color]) => localize(color[0])).join(english ? ', ' : '، ')}">
          ${product.variants.map(([color]) => `<i title="${escapeHtml(localize(color[0]))}" style="background:${color[1]}"></i>`).join('')}
        </div>
        <button data-product="${product.sku}" aria-label="${localize('تفاصيل')} ${escapeHtml(product.name)}">${localize('عرض التفاصيل')}</button>
      </div>
    </article>`).join('');
}

function showProduct(product) {
  $('detail-body').innerHTML = `
    <p><bdi>${product.sku}</bdi> · ${categories[product.category]}</p>
    <h2 id="detail-title">${escapeHtml(product.name)}</h2><img class="detail-photo" src="${escapeHtml(product.image)}" alt="" width="384" height="384"><p class="item-price"><bdi>${money(product.price)}</bdi> ${product.temporary ? '<small>' + temporaryLabel + '</small>' : ''}</p>
    <p>${localize('نؤكّد السعر والتوفّر عبر واتساب.')}</p>
    ${product.description ? "<p>" + escapeHtml(product.description) + "</p>" : ""}
    <form id="add-form">
      <fieldset class="variant-picker"><legend>اللون</legend><div class="variant-options" id="colors">${product.variants.map(([color], index) => `<label class="variant-option"><input type="radio" name="color" aria-label="${escapeHtml(localize(color[0]))}" value="${index}" ${index === 0 ? 'checked' : ''}><span><i style="background:${color[1]}"></i></span></label>`).join('')}</div></fieldset>
      <fieldset class="variant-picker"><legend>القياس</legend><div class="variant-options" id="sizes"></div></fieldset>
      <button type="submit" class="button">${localize('أضيفي إلى السلة')}</button>
    </form>`;
  const colors = $('colors');
  const sizesPanel = $('sizes');
  const photo = detail.querySelector('.detail-photo');
  const updateVariant = () => {
    const index = Number(colors.querySelector('input:checked').value);
    const [variantColor] = product.variants[index];
    photo.src = product.variants[index][2] || product.image;
    photo.alt = product.name + ' – ' + localize(variantColor[0]);
    const sizes = product.variants[Number(colors.querySelector('input:checked').value)][1] || [genericSize];
    sizesPanel.replaceChildren(...sizes.map((value, index) => {
      const label = document.createElement('label');
      label.className = 'variant-option';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'size';
      input.value = String(value);
      input.checked = index === 0;
      const text = document.createElement('span');
      text.textContent = sizeLabel(value);
      text.dir = "auto";
      label.append(input, text);
      return label;
    }));
  };
  colors.addEventListener('change', updateVariant);
  updateVariant();
  $('add-form').addEventListener('submit', event => {
    event.preventDefault();
    const colorIndex = Number(colors.querySelector('input:checked').value);
    const size = sizesPanel.querySelector('input:checked');
    const inBag = bag.filter(line => line.sku === product.sku).reduce((sum, line) => sum + line.quantity, 0);
    if (product.quantity !== null && inBag >= product.quantity) {
      alert("الكمية المطلوبة غير متوفّرة.");
      return;
    }
    const item = bag.find(line => line.sku === product.sku && line.color === colorIndex && line.size === size.value);
    if (item) item.quantity = Math.min(99, item.quantity + 1);
    else bag.push({sku: product.sku, color: colorIndex, size: size.value, quantity: 1});
    saveBag();
    detail.close();
    $('toast').textContent = localize('أُضيفت القطعة إلى السلة');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('toast').textContent = ''; }, 2600);
  });
  detail.showModal();
}

function renderCart(focusIndex, focusAction) {
  const lines = bag.map(item => {
    const product = catalog.find(product => product.sku === item.sku);
    return { ...item, price: product.price, name: product.name, colorName: localize(product.variants[item.color][0][0]) };
  });
  $('cart-lines').innerHTML = lines.length ? lines.map((item, index) => `
    <div class="cart-line"><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.colorName)} · <bdi>${sizeLabel(item.size)}</bdi> · <bdi>${money(item.price * item.quantity)}</bdi></small></div>
      <div class="quantity"><button data-index="${index}" data-action="minus" aria-label="${item.quantity === 1 ? localize('إزالة القطعة') : localize('خفّضي الكمية')}">−</button><span>${item.quantity}</span><button data-index="${index}" data-action="plus" aria-label="${localize('زيدي الكمية')}" ${item.quantity === 99 ? 'disabled' : ''}>+</button></div>
    </div>`).join('') : `<p>${localize('سلة التسوّق فارغة.')}</p>`;
  if (!lines.length) {
    $('checkout').replaceChildren();
    if (focusAction) cart.querySelector('[data-close]').focus();
    return;
  }
  const total = lines.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const message = [localize('السلام عليكم فريق سنّة ستايل، بدي أطلب هيدا الأوردر:'), '', ...lines.map(item =>
    `• ${escapeHtml(item.name)} (${item.sku}) — ${localize('اللون')}: ${escapeHtml(item.colorName)} — ${localize('قياس')} ${sizeLabel(item.size)} — ${localize('الكمية')} ${item.quantity} × ${money(item.price)} = ${money(item.price * item.quantity)}`
  ), '', totalLabel + ': ' + money(total)].join('\n');
  const link = document.createElement('a');
  link.className = 'button';
  link.href = whatsapp + '?text=' + encodeURIComponent(message);
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = localize('إرسال الطلب عبر واتساب');
  const note = document.createElement('p');
  note.textContent = localize('نؤكّد السعر والتوفّر عبر واتساب قبل الدفع.');
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
  const selected = catalog.find(item => item.sku === bag[index].sku);
  const inBag = bag.filter(item => item.sku === selected.sku).reduce((sum, item) => sum + item.quantity, 0);
  if (action === "plus" && selected.quantity !== null && inBag >= selected.quantity) {
    alert("الكمية المطلوبة غير متوفّرة.");
    return;
  }
  bag[index].quantity += action === 'plus' ? 1 : -1;
  if (bag[index].quantity === 0) bag.splice(index, 1);
  saveBag();
  renderCart(index, action);
});
for (const dialog of [detail, cart]) dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
saveBag();

const menu = document.querySelector('.mobile-menu');
const headerSearch = document.querySelector('.header-search');
const closeMenu = () => menu.setAttribute('aria-expanded', 'false');
menu.addEventListener('click', () => {
  const opening = menu.getAttribute('aria-expanded') === 'false';
  menu.setAttribute('aria-expanded', String(opening));
  if (opening) headerSearch.open = false;
});
headerSearch.addEventListener('toggle', () => { if (headerSearch.open) closeMenu(); });
$('open-cart').addEventListener('click', () => { closeMenu(); headerSearch.open = false; });
document.addEventListener('click', event => { if (!event.target.closest('.bar')) closeMenu(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menu.focus();
  }
});

window.addEventListener('load', () => {
  const fonts = document.createElement('link');
  fonts.rel = 'stylesheet';
  fonts.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Instrument+Serif&family=Noto+Naskh+Arabic:wght@500;600&display=swap';
  document.head.append(fonts);
}, { once: true });

const featuredProducts = $('featured-products');
if (featuredProducts) {
  const featuredSkus = ['SSBM0001', 'SSBM0008', 'SSBM0011', 'SSBM0014'];
  renderProducts(featuredProducts, featuredSkus.map(sku => catalog.find(product => product.sku === sku)).filter(Boolean));
}

for (const grid of [products, featuredProducts].filter(Boolean)) {
  grid.addEventListener('click', event => {
    const button = event.target.closest('[data-product]');
    if (!button) return;
    const product = catalog.find(item => item.sku === button.dataset.product);
    if (product) showProduct(product);
  });
}
