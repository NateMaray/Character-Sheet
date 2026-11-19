-- Let Nate's phone log sell / unsell on the sell list.
-- Run this once in the Supabase SQL editor. It does not put a key in the app.
--
-- Earlier pocket setup (the table, the 6-argument log_pocket_action, and the
-- anon grant) was applied in the dashboard and is not in this repo. This file
-- is the next change.
--
-- The phone calls log_pocket_action(p_action_id, p_kind, p_item, p_qty, p_chest, p_base_rev),
-- all text. CREATE OR REPLACE keeps that signature, so the existing grant still
-- matches. The grant is stated again at the bottom anyway.
--
-- Until this runs, sell and unsell raise 'bad kind'. The phone keeps them and
-- tries again later. They do not add or remove pocket items.

do $$
declare
  fn oid;
  fn_count int;
  src text;
  replaced text;
  constraint_name text;
begin
  if to_regclass('public.pocket_actions') is null then
    raise exception 'public.pocket_actions does not exist';
  end if;

  for constraint_name in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.pocket_actions'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%kind%'
      and pg_get_constraintdef(c.oid) ilike '%discard%'
  loop
    execute format('alter table public.pocket_actions drop constraint %I', constraint_name);
  end loop;

  alter table public.pocket_actions
    add constraint pocket_actions_kind_check
    check (kind in ('discard', 'to_chest', 'from_chest', 'sell', 'unsell'));

  select count(*) into fn_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'log_pocket_action'
    and p.pronargs = 6;

  if fn_count <> 1 then
    raise exception 'expected one public.log_pocket_action with 6 arguments, found %', fn_count;
  end if;

  select p.oid into fn
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'log_pocket_action'
    and p.pronargs = 6;

  if (
    select count(*)
    from unnest(string_to_array(pg_get_function_identity_arguments(fn), ',')) as arg
    where btrim(arg) ~ 'text$'
  ) <> 6 then
    raise exception 'log_pocket_action arguments are %, expected 6 text arguments', pg_get_function_identity_arguments(fn);
  end if;

  src := pg_get_functiondef(fn);
  -- pg_get_functiondef is already CREATE OR REPLACE with the current signature.
  -- Only the kind list changes, so the insert body and the grant target stay put.
  replaced := regexp_replace(
    src,
    'if[[:space:]]+p_kind[[:space:]]+not[[:space:]]+in[[:space:]]*\([[:space:]]*''discard''[[:space:]]*,[[:space:]]*''to_chest''[[:space:]]*,[[:space:]]*''from_chest''[[:space:]]*\)',
    'if p_kind not in (''discard'',''to_chest'',''from_chest'',''sell'',''unsell'')',
    'i'
  );

  if replaced = src then
    if src ~* '''sell''[[:space:]]*,[[:space:]]*''unsell''' then
      -- Kind check already allows sell and unsell.
      null;
    else
      raise exception 'log_pocket_action kind check was not the discard / to_chest / from_chest list';
    end if;
  else
    execute replaced;
  end if;
end $$;

grant execute on function public.log_pocket_action(text, text, text, text, text, text) to anon;

-- Check:
-- select pg_get_constraintdef(oid) from pg_constraint where conname = 'pocket_actions_kind_check';
-- select pg_get_functiondef('public.log_pocket_action(text,text,text,text,text,text)'::regprocedure);
