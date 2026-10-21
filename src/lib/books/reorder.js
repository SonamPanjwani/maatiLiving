// Reorder drafts from low stock: group low products by their preferred vendor and suggest how many to buy.
// Pure; used by the inventory page (preview) and the server action (which re-reads everything before saving).

// Buy enough to get back to twice the low-stock level (at least one piece).
export const suggestedQty = (stock, lowStockAt) => Math.max(lowStockAt * 2 - stock, 1);

// products: inventory rows ({ id, name, stock, lowStockAt, costPaise, preferredVendor: { id, name } | null }).
// links: vendor_products rows ({ vendor_id, product_id, last_cost_paise }).
// Returns { groups: [{ vendor, lines: [{ productId, name, stock, qty, unitCostPaise }], missingCost: [names] }], noVendor: [names] }.
// Cost per piece: the vendor's last price, else the product's cost price; lines with neither can't go on a draft.
export function reorderGroups(products, links) {
  const lastCost = new Map(links.map((link) => [`${link.vendor_id}:${link.product_id}`, link.last_cost_paise]));
  const groups = new Map();
  const noVendor = [];
  for (const product of products) {
    if (product.stock > product.lowStockAt) continue;
    if (!product.preferredVendor) { noVendor.push(product.name); continue; }
    const vendor = product.preferredVendor;
    const group = groups.get(vendor.id) ?? { vendor, lines: [], missingCost: [] };
    const cost = lastCost.get(`${vendor.id}:${product.id}`) ?? product.costPaise;
    if (cost > 0) group.lines.push({ productId: product.id, name: product.name, stock: product.stock, qty: suggestedQty(product.stock, product.lowStockAt), unitCostPaise: cost });
    else group.missingCost.push(product.name);
    groups.set(vendor.id, group);
  }
  return { groups: [...groups.values()].sort((a, b) => a.vendor.name.localeCompare(b.vendor.name)), noVendor };
}
