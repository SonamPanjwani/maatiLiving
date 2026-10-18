-- Maati Living — direct UPI payments (PhonePe / Google Pay / Paytm / BHIM) checked by hand.
-- Used until Razorpay is live. Run in Supabase → SQL Editor after 0004.
--
-- Flow: customer places an order (status 'pending', payment_method 'upi_manual'), pays the shown UPI ID,
-- submits the UPI transaction id (UTR). The admin checks the money arrived and confirms it, which marks the
-- order paid and takes the items out of stock, exactly once.

alter table public.orders
  add column payment_method text not null default 'razorpay' check (payment_method in ('razorpay', 'upi_manual')),
  add column payment_reference text,          -- UPI transaction id (UTR) entered by the customer
  add column payment_submitted_at timestamptz;

create index orders_payment_method_status_idx on public.orders (payment_method, status);

-- Admin-only. Returns true when this call marked the order paid (false for non-admins, wrong
-- method/status, or if it was already confirmed) so callers know whether to send emails.
create function public.admin_confirm_manual_payment(p_order_id uuid)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    return false;
  end if;

  update public.orders
     set status = 'paid', paid_at = now()
   where id = p_order_id and payment_method = 'upi_manual' and status = 'pending'
   returning id into v_id;
  if v_id is null then
    return false;
  end if;

  update public.products p
     set stock = greatest(p.stock - oi.quantity, 0)
    from public.order_items oi
   where oi.order_id = v_id and oi.product_id = p.id;
  return true;
end;
$$;

revoke execute on function public.admin_confirm_manual_payment(uuid) from public, anon;
grant execute on function public.admin_confirm_manual_payment(uuid) to authenticated; -- is_admin() check inside

-- Restock only orders that were actually paid: an unpaid order that's cancelled never took stock out.
create or replace function public.admin_restock_order(p_order_id uuid)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    return false; -- non-admins: no-op
  end if;

  update public.orders set restocked = true
   where id = p_order_id and not restocked and status in ('cancelled', 'refunded') and paid_at is not null
   returning id into v_id;
  if v_id is null then
    return false;
  end if;

  update public.products p
     set stock = p.stock + oi.quantity
    from public.order_items oi
   where oi.order_id = v_id and oi.product_id = p.id;
  return true;
end;
$$;
