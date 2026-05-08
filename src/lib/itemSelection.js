export const normalizeItemCode = (value = "") => String(value || "").trim().toUpperCase();

export const getItemCode = (item = {}) => item.material_code || item.product_code || "";

export const getItemName = (item = {}) => item.material_name || item.product_name || "";

export const itemMatchesSearch = (item = {}, search = "") => {
  const query = String(search || "").trim().toLowerCase();
  if (!query) return true;
  return [getItemCode(item), getItemName(item), item.description, item.specifications]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query));
};

export const itemToSelectOption = (item = {}) => {
  const code = getItemCode(item);
  const name = getItemName(item);
  return {
    value: code,
    label: `${code} - ${name}`.trim()
  };
};

export const materialToSalesLinePatch = (material = {}) => {
  const code = getItemCode(material);
  const name = getItemName(material);
  const price = Number(material.unit_price ?? material.sales_price ?? material.unit_cost ?? 0) || 0;

  return {
    product_code: code,
    product_name: name,
    material_code: code,
    material_name: name,
    description: material.description || material.specifications || material.material_type || "",
    unit_of_measure: material.unit_of_measure || "piece",
    unit_price: price,
    vat_rate: Number(material.vat_rate ?? 15) || 0
  };
};

export const validateDuplicateItemCode = (items = [], candidateCode, currentItemId = null) => {
  const code = normalizeItemCode(candidateCode);
  if (!code) return false;

  return items.some((item) =>
    normalizeItemCode(getItemCode(item)) === code &&
    (!currentItemId || item.id !== currentItemId)
  );
};
