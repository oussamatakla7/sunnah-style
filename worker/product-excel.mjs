import ExcelJS from 'exceljs';

const productHeaders = ['رمز القطعة','الاسم','الفئة','الوصف','السعر بالدولار','الكمية','سعر مؤقت','الصورة'];
const variantHeaders = ['رمز القطعة','اسم اللون','درجة اللون','القياسات','صورة اللون'];
const categories = ['فساتين سهرة','فساتين يومية','أطقم رياضية','حقائب','تشكيلة الشتاء'];

export async function exportProducts(products) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('المنتجات', {views:[{rightToLeft:true,state:'frozen',ySplit:1}]});
  const variants = book.addWorksheet('الألوان والقياسات', {views:[{rightToLeft:true,state:'frozen',ySplit:1}]});
  const images = book.addWorksheet('بيانات الصور', {state:'veryHidden'});
  images.addRow(['المعرف','الجزء','البيانات']);
  const ids = new Map();
  const imageValue = value => {
    if (!value.startsWith('data:')) return value;
    if (ids.has(value)) return ids.get(value);
    const id = 'IMAGE_' + (ids.size + 1);
    ids.set(value,id);
    for (let offset = 0; offset < value.length; offset += 30000) images.addRow([id,offset / 30000,value.slice(offset,offset + 30000)]);
    return id;
  };
  sheet.addRow(productHeaders);
  variants.addRow(variantHeaders);
  for (const product of products) {
    sheet.addRow([product.sku,product.name,categories[product.category-1],product.description,product.price,
      product.quantity,product.temporary ? 'نعم' : 'لا',imageValue(product.image)]);
    for (const [color,sizes,image] of product.variants) {
      variants.addRow([product.sku,...color,(sizes || []).map(String).join('، '),imageValue(image || '')]);
    }
  }
  for (const tab of [sheet,variants]) {
    tab.getRow(1).font = {bold:true,color:{argb:'FFFFFFFF'}};
    tab.getRow(1).fill = {type:'pattern',pattern:'solid',fgColor:{argb:'FF042F29'}};
    tab.columns.forEach(column => { column.width = 24; });
    tab.autoFilter = {from:{row:1,column:1},to:{row:tab.rowCount,column:tab.columnCount}};
  }
  return book.xlsx.writeBuffer();
}

export async function importProducts(buffer, existing) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer);
  const sheet = book.getWorksheet('المنتجات');
  const variants = book.getWorksheet('الألوان والقياسات');
  if (!sheet || !variants || sheet.rowCount > 1001 || variants.rowCount > 10001) throw Error('استعملي ملف Excel المصدّر من اللوحة، بحدّ أقصى 1000 منتج.');
  const value = (row,index) => {
    const cell = row.getCell(index).value;
    if (cell == null) return '';
    if (typeof cell === 'string' || typeof cell === 'number' || typeof cell === 'boolean') return String(cell).trim();
    throw Error('الخلايا لازم تحتوي نصوص أو أرقام، بدون معادلات.');
  };
  for (const [tab,headers] of [[sheet,productHeaders],[variants,variantHeaders]]) {
    if (headers.some((header,index) => value(tab.getRow(1),index+1) !== header)) throw Error('عناوين الأعمدة غير مطابقة. استعملي الملف المصدّر.');
  }
  const imageParts = new Map();
  book.getWorksheet('بيانات الصور')?.eachRow((row,index) => {
    if (index === 1) return;
    const id = value(row,1);
    const part = Number(value(row,2));
    if (!Number.isSafeInteger(part) || part < 0 || part > 400) throw Error('بيانات الصور غير صالحة.');
    if (!imageParts.has(id)) imageParts.set(id,[]);
    imageParts.get(id)[part] = value(row,3);
  });
  const imageValue = text => {
    const image = text.startsWith('IMAGE_') ? imageParts.get(text)?.join('') : text;
    if (image === undefined || (image && !/^(https:\/\/|\/?assets\/|data:image\/(jpeg|png|webp|gif);base64,)/.test(image))) throw Error('رابط الصورة غير صالح أو بيانات الصورة ناقصة.');
    return image;
  };
  const incoming = new Map();
  sheet.eachRow((row,index) => {
    if (index === 1 || !value(row,1)) return;
    const sku = value(row,1).toUpperCase();
    const price = Number(value(row,5));
    const quantity = value(row,6) === '' ? null : Number(value(row,6));
    const category = categories.indexOf(value(row,3)) + 1 || Number(value(row,3));
    if (!/^[A-Z0-9_-]{1,80}$/.test(sku) || incoming.has(sku) || !value(row,2) || !value(row,5) ||
        ![1,2,3,4,5].includes(category) || !Number.isFinite(price) || price < 0 ||
        (quantity !== null && (!Number.isSafeInteger(quantity) || quantity < 0)) ||
        !['نعم','لا'].includes(value(row,7))) throw Error('راجعي بيانات المنتج بالسطر ' + index + '.');
    const image = imageValue(value(row,8));
    if (!image) throw Error('صورة المنتج ناقصة بالسطر ' + index + '.');
    incoming.set(sku,{sku,name:value(row,2),category,description:value(row,4),price,quantity,
      temporary:value(row,7)==='نعم',image,variants:[]});
  });
  variants.eachRow((row,index) => {
    if (index === 1 || !value(row,1)) return;
    const product = incoming.get(value(row,1).toUpperCase());
    const name = value(row,2);
    const color = value(row,3);
    const sizes = value(row,4).split(/[,،]/).map(size=>size.trim()).filter(Boolean);
    if (!product || !name || !/^#[a-f0-9]{6}$/i.test(color) ||
        sizes.some(size=>size !== 'One Size' && size !== 'قياس موحّد' && !/^[0-9٠-٩۰-۹]+$/.test(size))) throw Error('راجعي سطر اللون ' + index + '.');
    product.variants.push([[name,color],sizes.length ? sizes.map(size=>size==='قياس موحّد' ? 'One Size' : size) : null,imageValue(value(row,5))]);
  });
  if (!incoming.size || [...incoming.values()].some(product=>!product.variants.length)) throw Error('كل منتج لازم يكون إلو لون واحد على الأقل.');
  const merged = new Map(existing.map(product=>[product.sku,product]));
  for (const [sku,product] of incoming) merged.set(sku,product);
  if (merged.size > 1000) throw Error('الحدّ الأقصى 1000 منتج.');
  return {products:[...merged.values()],count:incoming.size};
}

if (typeof window !== 'undefined') window.productExcel = {exportProducts,importProducts};
