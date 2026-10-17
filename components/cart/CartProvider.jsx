"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { shopConfig } from "@/src/config/shop";

// Cart lives in this browser only (localStorage). It is a convenience copy: the server
// re-reads price and stock from the database before charging anything.
const STORAGE_KEY = "maati-cart-v1";
const CartContext = createContext(null);

function readStored() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item?.productId && item.quantity > 0) : [];
  } catch {
    return [];
  }
}

const clampQuantity = (quantity, maxQuantity) =>
  Math.max(1, Math.min(Math.floor(quantity) || 1, maxQuantity ?? shopConfig.maxQuantityPerItem, shopConfig.maxQuantityPerItem));

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(readStored());
    setHydrated(true);
    // Keep tabs in sync.
    const onStorage = (event) => { if (event.key === STORAGE_KEY) setItems(readStored()); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* private mode: cart lasts for this visit only */ }
  }, [items, hydrated]);

  const add = useCallback((product, quantity = 1) => {
    setItems((current) => {
      const existing = current.find((item) => item.productId === product.id);
      const maxQuantity = product.stock;
      if (existing) {
        return current.map((item) => (item.productId === product.id ? { ...item, maxQuantity, quantity: clampQuantity(item.quantity + quantity, maxQuantity) } : item));
      }
      return [...current, {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        price: product.price,
        imagePublicId: product.images?.[0]?.publicId ?? "",
        maxQuantity,
        quantity: clampQuantity(quantity, maxQuantity),
      }];
    });
  }, []);

  const setQuantity = useCallback((productId, quantity) => {
    setItems((current) => current.map((item) => (item.productId === productId ? { ...item, quantity: clampQuantity(quantity, item.maxQuantity) } : item)));
  }, []);

  const remove = useCallback((productId) => setItems((current) => current.filter((item) => item.productId !== productId)), []);
  const clear = useCallback(() => setItems([]), []);
  // Replace lines with server-refreshed data (price/stock changes, removed products).
  const replace = useCallback((nextItems) => setItems(nextItems), []);

  const value = useMemo(() => ({
    items,
    hydrated,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    add,
    setQuantity,
    remove,
    clear,
    replace,
  }), [items, hydrated, add, setQuantity, remove, clear, replace]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const cart = useContext(CartContext);
  if (!cart) throw new Error("useCart must be used inside <CartProvider>");
  return cart;
}
