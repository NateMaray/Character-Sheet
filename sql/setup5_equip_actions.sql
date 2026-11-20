-- Let Nate's phone log equip, unequip, and saved looks.
-- Run this once in the Supabase SQL editor. It does not put a key in the app.
-- Do not run it from the app. Until it runs, those kinds raise 'bad kind'.
-- The phone keeps the local change and shows "Not synced".
--
-- The phone still calls the 6-argument function:
--   log_pocket_action(p_action_id, p_kind, p_item, p_qty, p_chest, p_base_rev)
-- For equip / unequip, p_chest is the doll slot (Head, Body, Main hand, …).
-- For save_look / delete_look / wear_look / rename_look, p_chest is JSON text:
--   a piece array, or {"from":"Old name"} for rename_look.
-- A BEFORE INSERT trigger copies that into slot or detail and clears chest,
-- so chest stays a chest name for discard / to_chest / from_chest / sell / unsell.
--
-- After this runs, a stored row looks like:
--   equip:     kind, item, qty, chest '', slot 'Main hand', detail ''
--   save_look: kind, item (look name), qty '', chest '', slot '', detail '<json>'

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

  alter table public.pocket_actions add column if not exists slot text not null default '';
  alter table public.pocket_actions add column if not exists detail text not null default '';

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
    check (kind in (
      'discard', 'to_chest', 'from_chest', 'sell', 'unsell',
      'equip', 'unequip',
      'save_look', 'delete_look', 'wear_look', 'rename_look'
    ));

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
  replaced := regexp_replace(
    src,
    '''discard''[[:space:]]*,[[:space:]]*''to_chest''[[:space:]]*,[[:space:]]*''from_chest''[[:space:]]*,[[:space:]]*''sell''[[:space:]]*,[[:space:]]*''unsell''',
    '''discard'',''to_chest'',''from_chest'',''sell'',''unsell'',''equip'',''unequip'',''save_look'',''delete_look'',''wear_look'',''rename_look''',
    'i'
  );

  if replaced = src and src !~* '''save_look''' then
    replaced := regexp_replace(
      src,
      '''discard''[[:space:]]*,[[:space:]]*''to_chest''[[:space:]]*,[[:space:]]*''from_chest''',
      '''discard'',''to_chest'',''from_chest'',''sell'',''unsell'',''equip'',''unequip'',''save_look'',''delete_look'',''wear_look'',''rename_look''',
      'i'
    );
  end if;

  if replaced = src then
    if src ~* '''save_look''' and src ~* '''rename_look''' then
      null;
    else
      raise exception 'log_pocket_action kind check was not the discard / to_chest / from_chest list';
    end if;
  else
    execute replaced;
  end if;
end $$;

create or replace function public.pocket_actions_split_equip_detail()
returns trigger
language plpgsql
as $$
begin
  if new.kind in ('equip', 'unequip') then
    if coalesce(new.slot, '') = '' and coalesce(new.chest, '') <> '' then
      new.slot := new.chest;
    end if;
    new.chest := '';
  elsif new.kind in ('save_look', 'delete_look', 'wear_look', 'rename_look') then
    if coalesce(new.detail, '') = '' and coalesce(new.chest, '') <> '' then
      new.detail := new.chest;
    end if;
    new.chest := '';
  end if;
  return new;
end $$;

drop trigger if exists pocket_actions_split_equip_detail on public.pocket_actions;

create trigger pocket_actions_split_equip_detail
  before insert on public.pocket_actions
  for each row
  execute function public.pocket_actions_split_equip_detail();

grant execute on function public.log_pocket_action(text, text, text, text, text, text) to anon;

-- Check:
-- select pg_get_constraintdef(oid) from pg_constraint where conname = 'pocket_actions_kind_check';
-- select pg_get_functiondef('public.log_pocket_action(text,text,text,text,text,text)'::regprocedure);
-- select column_name, data_type from information_schema.columns where table_name = 'pocket_actions' and column_name in ('slot', 'detail');
