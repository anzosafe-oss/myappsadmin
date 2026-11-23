-- Uses the existing MyList database administrator check as well as Edge authentication.
-- Remove MyList authorization, preserving Auth, lists, items and profiles.
create or replace function mylist_private.admin_revoke_account(recipient text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.mylist_accounts%rowtype; f uuid; was_owner boolean;
begin
 if auth.uid() is null or not mylist_private.is_admin() then raise exception 'Acces rezervat administratorului MyList'; end if;
 select family_id into f from public.mylist_accounts where email=lower(trim(recipient));
 if f is null then raise exception 'Contul nu mai este disponibil'; end if;
 perform 1 from public.mylist_families where id=f for update;
 select * into a from public.mylist_accounts where email=lower(trim(recipient)) for update;
 if not found then raise exception 'Contul nu mai este disponibil'; end if;
 if a.is_admin or a.email='anzo.safe@gmail.com' then raise exception 'Administratorul principal este protejat'; end if;
 select (admin_id=a.user_id or owner_email=a.email) into was_owner from public.mylist_families where id=f;
 update public.mylist_families set admin_id=null where id=f and admin_id=a.user_id;
 update public.mylist_invitations set status='cancelled',delivery_key=null,delivery_started_at=null where email=a.email;
 -- Legacy accounts may have no invitation history. Keep a zero-send withdrawal
 -- record so they can be reviewed and removed from the admin list afterward.
 if not exists(select 1 from public.mylist_invitations where email=a.email) then
  insert into public.mylist_invitations(family_id,email,kind,status,send_count)
  values(f,a.email,case when was_owner then 'administrator' else 'family' end,'cancelled',0);
 end if;
 delete from public.mylist_members where user_id=a.user_id;
 delete from public.mylist_accounts where email=a.email;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function mylist_private.admin_revoke_account(text) from public,anon;
grant execute on function mylist_private.admin_revoke_account(text) to authenticated;
create or replace function public.mylist_admin_revoke_account(recipient text)
returns jsonb language sql security invoker set search_path = '' as $wrapper$
 select mylist_private.admin_revoke_account(recipient)
$wrapper$;
revoke all on function public.mylist_admin_revoke_account(text) from public,anon,service_role;
grant execute on function public.mylist_admin_revoke_account(text) to authenticated;
