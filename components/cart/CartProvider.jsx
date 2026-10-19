"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { shopConfig } from "@/src/config/shop";
import { isSupabaseConfigured } from "@/src/lib/supabase/config";
import { getSupabaseBrowserClient } from "@/src/lib/supabase/browser";

// Whose cart is it?
//   Guest       → this browser only (localStorage, GUEST_KEY).
//   Signed in   → the customer's own row in `carts` (RLS: only them), so it follows them across devices,
//                 with a per-user local copy for instant loading / if the table isn't there yet.
// On sign-in a guest cart is merged into the account's cart and cleared from the browser; on sign-out
// the shown cart empties, so the next person on this browser never sees someone else's cart.
// The cart is only a convenience copy: checkout re-reads every price and stock level on the server.
const GUEST_KEY = "maati-cart-v1";
const userKey = (userId) => `maati-cart-v1:${userId}`;
const CartContext = createContext(null);

function readStored(key) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item?.productId && item.quantity > 0) : [];
  } catch {
    return [];
  }
}

function writeStored(key, items) {
  try { window.localStorage.setItem(key, JSON.stringify(items)); } catch { /* private mode: cart lasts for this visit only */ }
}

function removeStored(key) {
  try { window.localStorage.removeItem(key); } catch { /* ignore */ }
}

const clampQuantity = (quantity, maxQuantity) =>
  Math.max(1, Math.min(Math.floor(quantity) || 1, maxQuantity ?? shopConfig.maxQuantityPerItem, shopConfig.maxQuantityPerItem));

// Account cart + guest cart: same product → add quantities (within limits); newer details win.
function mergeCarts(accountItems, guestItems) {
  const merged = accountItems.map((item) => ({ ...item }));
  for (const guest of guestItems) {
    const existing = merged.find((item) => item.productId === guest.productId);
    if (existing) Object.assign(existing, guest, { quantity: clampQuantity(existing.quantity + guest.quantity, guest.maxQuantity ?? existing.maxQuantity) });
    else merged.push({ ...guest });
  }
  return merged.slice(0, shopConfig.maxLinesPerOrder);
}

async function loadAccountCart(supabase, userId) {
  const { data, error } = await supabase.from("carts").select("items").eq("user_id", userId).maybeSingle();
  if (error) return null; // table not created yet (0006) or offline → fall back to the local copy
  return Array.isArray(data?.items) ? data.items.filter((item) => item?.productId && item.quantity > 0) : [];
}

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [ownerId, setOwnerId] = useState(undefined); // undefined = not resolved yet, null = guest
  const ownerRef = useRef(undefined);
  const pathname = usePathname();

  // Work out who is signed in (sign-in/out happen in server actions, so re-check on every page change).
  useEffect(() => {
    let cancelled = false;

    const switchTo = async (userId) => {
      if (userId === ownerRef.current) return;
      ownerRef.current = userId;

      if (!userId) {
        // Guest (or just signed out): show only the browser's guest cart.
        if (!cancelled) { setItems(readStored(GUEST_KEY)); setOwnerId(null); setHydrated(true); }
        return;
      }

      const supabase = getSupabaseBrowserClient();
      const guest = readStored(GUEST_KEY);
      const fromServer = await loadAccountCart(supabase, userId);
      const account = fromServer ?? readStored(userKey(userId));
      const merged = guest.length ? mergeCarts(account, guest) : account;
      if (guest.length) removeStored(GUEST_KEY);
      if (cancelled || ownerRef.current !== userId) return;
      setItems(merged);
      setOwnerId(userId);
      setHydrated(true);
    };

    if (!isSupabaseConfigured) {
      switchTo(null);
      return () => { cancelled = true; };
    }
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => switchTo(data.session?.user?.id ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { switchTo(session?.user?.id ?? null); });
    return () => { cancelled = true; listener.subscription.unsubscribe(); };
  }, [pathname]);

  // Keep guest tabs in sync.
  useEffect(() => {
    const onStorage = (event) => { if (event.key === GUEST_KEY && ownerRef.current === null) setItems(readStored(GUEST_KEY)); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Save: guest → browser; signed in → local copy now + the account (debounced).
  useEffect(() => {
    if (!hydrated || ownerId === undefined) return undefined;
    if (ownerId === null) {
      writeStored(GUEST_KEY, items);
      return undefined;
    }
    writeStored(userKey(ownerId), items);
    const timer = setTimeout(() => {
      getSupabaseBrowserClient().from("carts").upsert({ user_id: ownerId, items }).then(({ error }) => {
        if (error) console.warn("Saving cart to account failed (kept on this device):", error.message);
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [items, hydrated, ownerId]);

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
