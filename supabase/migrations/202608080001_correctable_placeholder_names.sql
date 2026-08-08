-- A barcode scanned before its label could be read is saved under a generated
-- placeholder name ("Scanned product 4056489814795") so the barcode is still
-- findable next time. Only the contributing account could ever fix that name,
-- which meant a placeholder could sit wrong forever even after someone else
-- scanned the same package and read a real name off the label.
--
-- `placeholder` is a generated column, not a client-supplied flag: it is computed
-- from the stored `name` itself, so no client can lie about a row's eligibility
-- by sending a fabricated boolean. The two patterns mirror the app's only two
-- placeholder formats (`describeUnnamedProduct` in
-- src/lib/product-catalogue.ts) — if that generator's format ever changes
-- without updating this expression, existing rows just stop matching and fall
-- back to the original owner-only rule, never the other way around.
alter table public.product_catalogue
  add column placeholder boolean generated always as (
    name ~ '\(scanned\)$' or name ~ '^Scanned product [0-9]{8,14}$'
  ) stored;

-- A named product stays protected — only its contributor may correct it, same
-- as before. A still-placeholder row may be named by any signed-in account,
-- because nobody has a legitimate claim to a name nobody actually supplied yet.
-- SECURITY DEFINER so this is the one path that can touch another account's
-- row at all, and it can only ever change `name` — never nutrition, image, or
-- ownership — which a broadened table-level UPDATE grant could not guarantee.
create or replace function public.correct_product_catalogue_name(p_barcode text, p_name text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  trimmed_name text := btrim(p_name);
  corrected boolean;
begin
  if p_barcode !~ '^[0-9]{8,14}$' or char_length(trimmed_name) = 0 then
    return false;
  end if;

  update public.product_catalogue
  set name = left(trimmed_name, 240)
  where barcode = p_barcode
    and (contributed_by = auth.uid() or placeholder)
  returning true into corrected;

  return coalesce(corrected, false);
end;
$$;

revoke all on function public.correct_product_catalogue_name(text, text) from public;
grant execute on function public.correct_product_catalogue_name(text, text) to authenticated;
