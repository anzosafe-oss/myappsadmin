-- Anonimous-only membership. Existing ownership policies remain in force.
create schema if not exists anonymous_private;
revoke all on schema anonymous_private from public,anon;
grant usage on schema anonymous_private to authenticated,service_role;
create table anonymous.app_access (
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
alter table anonymous.app_access enable row level security;
revoke all on anonymous.app_access from public,anon,authenticated;
grant all on anonymous.app_access to service_role;
create unique index app_access_user_id_idx on anonymous.app_access(user_id) where user_id is not null;
-- Seed existing barber profiles only, without exporting Auth identities.
insert into anonymous.app_access(email,user_id,status) select lower(u.email),u.id,case when p.active then 'active' else 'revoked' end from anonymous.profiles p join auth.users u on u.id=p.user_id where u.email is not null;
create function anonymous_private.allowed_for(uid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select uid is not null and exists (
 select 1 from anonymous.app_access a join auth.users u on u.id=uid
 where a.status in ('active','pending') and (a.user_id=uid or (a.user_id is null and a.email=lower(u.email)))
 and u.email_confirmed_at is not null)
$$;
revoke all on function anonymous_private.allowed_for(uuid) from public,anon,authenticated;
grant execute on function anonymous_private.allowed_for(uuid) to service_role;
create function anonymous_private.allowed() returns boolean language sql stable security definer set search_path='' as $$
 select anonymous_private.allowed_for((select auth.uid()))
$$;
revoke all on function anonymous_private.allowed() from public,anon;
grant execute on function anonymous_private.allowed() to authenticated;
create function anonymous.access_status() returns boolean language sql stable security invoker set search_path='' as $$select anonymous_private.allowed()$$;
revoke all on function anonymous.access_status() from public,anon;
grant execute on function anonymous.access_status() to authenticated;
create function anonymous.access_allowed_for(uid uuid) returns boolean language sql stable security invoker set search_path='' as $$select anonymous_private.allowed_for(uid)$$;
revoke all on function anonymous.access_allowed_for(uuid) from public,anon,authenticated;
grant execute on function anonymous.access_allowed_for(uuid) to service_role;
do $$declare t text;begin
 foreach t in array array['profiles','appointments'] loop
 execute format('create policy anonymous_membership_required on anonymous.%I as restrictive for all to authenticated using ((select anonymous_private.allowed())) with check ((select anonymous_private.allowed()))',t);
 end loop;
end$$;
-- Membership transitions are protected even if called outside the admin UI.
create function anonymous_private.protect_admin() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.status='revoked' and (new.email='anzo.safe@gmail.com') then
 raise exception 'Contul administratorului este protejat';end if;
 return new;
end$$;
revoke all on function anonymous_private.protect_admin() from public,anon,authenticated;
create trigger protect_anonymous_admin before insert or update on anonymous.app_access for each row execute function anonymous_private.protect_admin();
create function anonymous_private.user_for_email(recipient text) returns uuid language sql stable security definer set search_path='' as $$select id from auth.users where lower(email)=lower(trim(recipient))$$;
revoke all on function anonymous_private.user_for_email(text) from public,anon,authenticated;
grant execute on function anonymous_private.user_for_email(text) to service_role;
create function anonymous.reserve_access_invite(recipient text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare em text:=lower(trim(recipient)); r anonymous.app_access; k uuid:=gen_random_uuid(); target uuid; begin
 if em is null or length(em)>254 or em !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Adresa de e-mail nu este validă';end if;
 target:=anonymous_private.user_for_email(em);
 if em='anzo.safe@gmail.com' then raise exception 'Contul administratorului este protejat';end if;
 insert into anonymous.app_access(email,user_id,status) values(em,target,'failed') on conflict do nothing;
 select * into r from anonymous.app_access where email=em for update;
 if r.status='active' then raise exception 'Contul are deja acces activ la Anonimous';end if;
 if r.delivery_key is not null and r.delivery_started_at>now()-interval '2 minutes' then raise exception 'Invitația este deja în curs de trimitere';end if;
 if r.sent_at>now()-interval '60 seconds' then raise exception 'Așteaptă un minut înainte de retrimitere';end if;
 update anonymous.app_access set delivery_key=k,delivery_started_at=now(),user_id=coalesce(user_id,target) where email=em;
 return jsonb_build_object('delivery_key',k,'user_id',coalesce(r.user_id,target));
end$$;
create function anonymous.finish_access_invite(recipient text,delivery uuid,recipient_id uuid,delivered boolean) returns void
language plpgsql security invoker set search_path='' as $$begin
 if delivered and (recipient_id is null or anonymous_private.user_for_email(recipient) is distinct from recipient_id) then raise exception 'Destinatarul nu a putut fi verificat';end if;
 update anonymous.app_access set
 user_id=case when delivered then recipient_id else user_id end,
 status=case when delivered then 'pending' else status end,
 sent_at=case when delivered then now() else sent_at end,
 send_count=send_count+case when delivered then 1 else 0 end,
 updated_at=now(),delivery_key=null,error=case when delivered then null else 'E-mailul nu a fost trimis. Reîncearcă.' end
 where email=lower(trim(recipient)) and delivery_key=delivery;
 if not found then raise exception 'Trimiterea nu a putut fi confirmată';end if;
 if delivered then
 insert into anonymous.profiles(user_id,display_name,alias,active) values(recipient_id,left(split_part(lower(trim(recipient)),'@',1),60),'',true) on conflict(user_id) do update set active=true;
 end if;
end$$;
create function anonymous.revoke_access(recipient text) returns void
language plpgsql security invoker set search_path='' as $$declare r anonymous.app_access;begin
 select * into r from anonymous.app_access where email=lower(trim(recipient)) for update;
 if not found then raise exception 'Contul nu aparține Anonimous';end if;
 if r.delivery_key is not null and r.delivery_started_at>now()-interval '2 minutes' then raise exception 'Așteaptă finalizarea trimiterii invitației';end if;
 update anonymous.app_access set status='revoked',updated_at=now(),delivery_key=null where email=r.email;
 update anonymous.profiles set active=false where user_id=r.user_id;
 -- Auth identities and all appointments are preserved.
end$$;
revoke all on function anonymous.reserve_access_invite(text),anonymous.finish_access_invite(text,uuid,uuid,boolean),anonymous.revoke_access(text) from public,anon,authenticated;
grant execute on function anonymous.reserve_access_invite(text),anonymous.finish_access_invite(text,uuid,uuid,boolean),anonymous.revoke_access(text) to service_role;

create function anonymous_private.visit() returns void language plpgsql security definer set search_path='' as $$begin
 if not anonymous_private.allowed() then raise exception 'Accesul la Anonimous nu este activ';end if;
 update anonymous.app_access set status='active',updated_at=now(),last_seen_at=now() where user_id=auth.uid() and status in ('pending','active');
end$$;
revoke all on function anonymous_private.visit() from public,anon;
grant execute on function anonymous_private.visit() to authenticated;
alter table anonymous.app_access add column last_seen_at timestamptz;
create function anonymous.visit() returns void language sql security invoker set search_path='' as $$select anonymous_private.visit()$$;
revoke all on function anonymous.visit() from public,anon;
grant execute on function anonymous.visit() to authenticated;


grant usage on schema anonymous to service_role;
grant select,insert,update on anonymous.profiles to service_role;
create function anonymous_private.overview() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('email',a.email,'user_id',a.user_id,'status',a.status,'created_at',a.created_at,'sent_at',a.sent_at,'send_count',a.send_count,'error',a.error,'last_seen_at',coalesce(a.last_seen_at,u.last_sign_in_at),'alias',coalesce(nullif(p.alias,''),p.display_name)) order by a.created_at desc),'[]'::jsonb)
 from anonymous.app_access a left join anonymous.profiles p on p.user_id=a.user_id left join auth.users u on u.id=a.user_id
$$;
revoke all on function anonymous_private.overview() from public,anon,authenticated;
grant execute on function anonymous_private.overview() to service_role;
create function anonymous.admin_overview() returns jsonb language sql stable security invoker set search_path='' as $$select anonymous_private.overview()$$;
revoke all on function anonymous.admin_overview() from public,anon,authenticated;
grant execute on function anonymous.admin_overview() to service_role;
