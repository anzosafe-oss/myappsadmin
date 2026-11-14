-- MyPet-only membership. Existing ownership policies remain in force.
create schema if not exists mypet_private;
revoke all on schema mypet_private from public,anon;
grant usage on schema mypet_private to authenticated,service_role;
create table public.mypet_app_access (
 email text primary key check(email=lower(trim(email)) and length(email)<=254),
 user_id uuid references auth.users(id) on delete set null,
 status text not null check(status in ('active','pending','revoked','failed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 sent_at timestamptz,
 send_count integer not null default 0,
 error text,
 delivery_key uuid,
 delivery_started_at timestamptz
);
alter table public.mypet_app_access enable row level security;
revoke all on public.mypet_app_access from public,anon,authenticated;
grant all on public.mypet_app_access to service_role;
create unique index app_access_user_id_idx on public.mypet_app_access(user_id) where user_id is not null;
-- MyPet has a dedicated Auth project. Preserve all existing accounts without exporting their identities.
insert into public.mypet_app_access(email,user_id,status) select lower(email),id,case when email_confirmed_at is not null then 'active' else 'pending' end from auth.users where email is not null;
create function mypet_private.allowed_for(uid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select uid is not null and exists (
 select 1 from public.mypet_app_access a join auth.users u on u.id=uid
 where a.status in ('active','pending') and (a.user_id=uid or (a.user_id is null and a.email=lower(u.email)))
 and u.email_confirmed_at is not null)
$$;
revoke all on function mypet_private.allowed_for(uuid) from public,anon,authenticated;
grant execute on function mypet_private.allowed_for(uuid) to service_role;
create function mypet_private.allowed() returns boolean language sql stable security definer set search_path='' as $$
 select mypet_private.allowed_for((select auth.uid()))
$$;
revoke all on function mypet_private.allowed() from public,anon;
grant execute on function mypet_private.allowed() to authenticated;
create function public.mypet_access_status() returns boolean language sql stable security invoker set search_path='' as $$select mypet_private.allowed()$$;
revoke all on function public.mypet_access_status() from public,anon;
grant execute on function public.mypet_access_status() to authenticated;
create function public.mypet_access_allowed_for(uid uuid) returns boolean language sql stable security invoker set search_path='' as $$select mypet_private.allowed_for(uid)$$;
revoke all on function public.mypet_access_allowed_for(uuid) from public,anon,authenticated;
grant execute on function public.mypet_access_allowed_for(uuid) to service_role;
do $$declare t text;begin
 foreach t in array array['pets','health_records'] loop
 execute format('create policy mypet_membership_required on public.%I as restrictive for all to authenticated using ((select mypet_private.allowed())) with check ((select mypet_private.allowed()))',t);
 end loop;
end$$;
-- Membership transitions are protected even if called outside the admin UI.
create function mypet_private.protect_admin() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.status='revoked' and (new.email='anzo.safe@gmail.com') then
 raise exception 'Contul administratorului este protejat';end if;
 return new;
end$$;
revoke all on function mypet_private.protect_admin() from public,anon,authenticated;
create trigger protect_mypet_admin before insert or update on public.mypet_app_access for each row execute function mypet_private.protect_admin();
create function mypet_private.user_for_email(recipient text) returns uuid language sql stable security definer set search_path='' as $$select id from auth.users where lower(email)=lower(trim(recipient))$$;
revoke all on function mypet_private.user_for_email(text) from public,anon,authenticated;
grant execute on function mypet_private.user_for_email(text) to service_role;
create function public.mypet_reserve_access_invite(recipient text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare em text:=lower(trim(recipient)); r public.mypet_app_access; k uuid:=gen_random_uuid(); target uuid; begin
 if em is null or length(em)>254 or em !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Adresa de e-mail nu este validă';end if;
 target:=mypet_private.user_for_email(em);
 if em='anzo.safe@gmail.com' then raise exception 'Contul administratorului este protejat';end if;
 insert into public.mypet_app_access(email,user_id,status) values(em,target,'failed') on conflict do nothing;
 select * into r from public.mypet_app_access where email=em for update;
 if r.status='active' then raise exception 'Contul are deja acces activ la MyPet';end if;
 if r.delivery_key is not null and r.delivery_started_at>now()-interval '2 minutes' then raise exception 'Invitația este deja în curs de trimitere';end if;
 if r.sent_at>now()-interval '60 seconds' then raise exception 'Așteaptă un minut înainte de retrimitere';end if;
 update public.mypet_app_access set delivery_key=k,delivery_started_at=now(),user_id=coalesce(user_id,target) where email=em;
 return jsonb_build_object('delivery_key',k,'user_id',coalesce(r.user_id,target));
end$$;
create function public.mypet_finish_access_invite(recipient text,delivery uuid,recipient_id uuid,delivered boolean) returns void
language plpgsql security invoker set search_path='' as $$begin
 if delivered and (recipient_id is null or mypet_private.user_for_email(recipient) is distinct from recipient_id) then raise exception 'Destinatarul nu a putut fi verificat';end if;
 update public.mypet_app_access set
 user_id=case when delivered then recipient_id else user_id end,
 status=case when delivered then 'pending' else status end,
 sent_at=case when delivered then now() else sent_at end,
 send_count=send_count+case when delivered then 1 else 0 end,
 updated_at=now(),delivery_key=null,error=case when delivered then null else 'E-mailul nu a fost trimis. Reîncearcă.' end
 where email=lower(trim(recipient)) and delivery_key=delivery;
 if not found then raise exception 'Trimiterea nu a putut fi confirmată';end if;
end$$;
create function public.mypet_revoke_access(recipient text) returns void
language plpgsql security invoker set search_path='' as $$declare r public.mypet_app_access;begin
 select * into r from public.mypet_app_access where email=lower(trim(recipient)) for update;
 if not found then raise exception 'Contul nu aparține MyPet';end if;
 if r.delivery_key is not null and r.delivery_started_at>now()-interval '2 minutes' then raise exception 'Așteaptă finalizarea trimiterii invitației';end if;
 update public.mypet_app_access set status='revoked',updated_at=now(),delivery_key=null where email=r.email;
 -- Global Auth sessions, other apps and all vehicle records are preserved.
end$$;
revoke all on function public.mypet_reserve_access_invite(text),public.mypet_finish_access_invite(text,uuid,uuid,boolean),public.mypet_revoke_access(text) from public,anon,authenticated;
grant execute on function public.mypet_reserve_access_invite(text),public.mypet_finish_access_invite(text,uuid,uuid,boolean),public.mypet_revoke_access(text) to service_role;

create function mypet_private.visit() returns void language plpgsql security definer set search_path='' as $$begin
 if not mypet_private.allowed() then raise exception 'Accesul la MyPet nu este activ';end if;
 update public.mypet_app_access set status='active',updated_at=now(),last_seen_at=now() where user_id=auth.uid() and status in ('pending','active');
end$$;
revoke all on function mypet_private.visit() from public,anon;
grant execute on function mypet_private.visit() to authenticated;
alter table public.mypet_app_access add column last_seen_at timestamptz;
create function public.mypet_visit() returns void language sql security invoker set search_path='' as $$select mypet_private.visit()$$;
revoke all on function public.mypet_visit() from public,anon;
grant execute on function public.mypet_visit() to authenticated;

-- TRUNCATE bypasses RLS; clients only need ordinary per-row CRUD.
revoke truncate,references,trigger on public.pets from authenticated;
-- The existing reminder dispatcher reads health records server-side.
grant select on public.health_records to service_role;
-- Event triggers run as their owner and need no client EXECUTE permission.
revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
