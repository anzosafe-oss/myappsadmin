begin;
do $$declare uid uuid:=gen_random_uuid();f uuid:=gen_random_uuid();lid uuid;before_auth int;before_profiles int;owner_id uuid;begin
 select user_id into owner_id from public.mylist_accounts where email='anzo.safe@gmail.com' and is_admin;
 if has_function_privilege('anon','public.mylist_admin_revoke_account(text)','EXECUTE') or not has_function_privilege('authenticated','public.mylist_admin_revoke_account(text)','EXECUTE') then raise exception 'Admin RPC exposed to clients';end if;
 insert into auth.users(id,email) values(uid,'mylist-admin-test@example.invalid');
 insert into public.mylist_families(id,owner_email,admin_id) values(f,'mylist-admin-test@example.invalid',uid);
 insert into public.mylist_accounts(email,user_id,family_id,accepted_at) values('mylist-admin-test@example.invalid',uid,f,now());
 insert into public.mylist_lists(owner_id,name,store) values(uid,'ROLLBACK TEST','custom') returning id into lid;
 before_auth:=(select count(*) from auth.users);before_profiles:=(select count(*) from public.mylist_profiles);
 perform set_config('request.jwt.claim.sub',uid::text,true);
 if not mylist_private.allowed() then raise exception 'Fixture cannot access MyList';end if;
 begin
  perform public.mylist_admin_revoke_account('mylist-admin-test@example.invalid');
  raise exception 'Non-admin permitted';
 exception when others then if sqlerrm not like '%rezervat%' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform public.mylist_admin_revoke_account('mylist-admin-test@example.invalid');
 perform set_config('request.jwt.claim.sub',uid::text,true);
 if mylist_private.allowed() then raise exception 'Withdrawn session still has MyList access';end if;
 if exists(select 1 from public.mylist_accounts where user_id=uid) then raise exception 'Authorization retained';end if;
 if not exists(select 1 from public.mylist_invitations where email='mylist-admin-test@example.invalid' and status='cancelled' and send_count=0) then raise exception 'Legacy withdrawal missing';end if;
 if not exists(select 1 from public.mylist_lists where id=lid) then raise exception 'List deleted';end if;
 if (select admin_id from public.mylist_families where id=f) is not null then raise exception 'Former administrator still assigned';end if;
 if before_auth<>(select count(*) from auth.users) or before_profiles<>(select count(*) from public.mylist_profiles) then raise exception 'Identity/profile deleted';end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 begin
  perform public.mylist_admin_revoke_account('anzo.safe@gmail.com');
  raise exception 'Owner incorrectly revoked';
 exception when others then if sqlerrm not like '%protejat%' then raise;end if;end;
end $$;
set local role authenticated;
-- The authenticated admin role has permission; missing targets fail normally.
do $$begin
 begin
  perform public.mylist_admin_revoke_account('nonexistent-mylist-test@example.invalid');
  raise exception 'Missing target incorrectly accepted';
 exception when others then if sqlerrm not like '%disponibil%' then raise;end if;end;
end $$;
reset role;
rollback;
select 'PASS: MyList withdrawal, owner protection, legacy history and data preservation; rolled back' as result;
