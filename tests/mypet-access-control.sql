begin;
-- Synthetic accounts only. No mail is sent and every fixture is rolled back.
insert into auth.users(id,email,email_confirmed_at) values
 ('10000000-0000-4000-8000-000000000001','mypet-fixture-a@example.test',now()),
 ('10000000-0000-4000-8000-000000000002','mypet-fixture-b@example.test',now());
insert into public.mypet_app_access(email,user_id,status) values
 ('mypet-fixture-a@example.test','10000000-0000-4000-8000-000000000001','pending'),
 ('mypet-fixture-b@example.test','10000000-0000-4000-8000-000000000002','active');
insert into public.pets(id,user_id,name,birth) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Fixture A','2020-01-01'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Fixture B','2020-01-01');
select set_config('request.jwt.claims',jsonb_build_object('sub','10000000-0000-4000-8000-000000000001','role','authenticated','amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',extract(epoch from now()))))::text,true);
set local role authenticated;
do $$begin
 if not public.mypet_access_status() then raise exception 'Pending verified account cannot enter';end if;
 perform public.mypet_visit();
 if (select count(*) from public.pets)<>1 then raise exception 'Ownership isolation failed';end if;
 if exists(select 1 from public.pets where name='Fixture B') then raise exception 'Other user data is visible';end if;
 if has_function_privilege('authenticated','public.mypet_revoke_access(text)','EXECUTE') or has_table_privilege('authenticated','public.mypet_app_access','SELECT') then raise exception 'Admin interface exposed';end if;
end$$;
reset role;
do $$begin
 if not exists(select 1 from public.mypet_app_access where email='mypet-fixture-a@example.test' and status='active' and last_seen_at is not null) then raise exception 'First visit not activated';end if;
 begin
 perform public.mypet_revoke_access('anzo.safe@gmail.com');
 raise exception 'Owner was not protected';
 exception when others then if sqlerrm not like '%protejat%' then raise;end if;end;
end$$;
set local role service_role;
select public.mypet_revoke_access('mypet-fixture-a@example.test');
reset role;
set local role authenticated;
do $$begin
 if public.mypet_access_status() then raise exception 'Revoked JWT still has access';end if;
 if exists(select 1 from public.pets) or exists(select 1 from public.health_records) then raise exception 'Revoked user can read';end if;
 begin
 insert into public.pets(user_id,name,birth) values(auth.uid(),'Forbidden','2020-01-01');
 raise exception 'Revoked user can insert';
 exception when insufficient_privilege then null;end;
 begin
 perform public.mypet_visit();raise exception 'Revoked user can reactivate';
 exception when others then if sqlerrm not like '%nu este activ%' then raise;end if;end;
end$$;
reset role;
set local role service_role;
do $$declare r jsonb;begin
 r:=public.mypet_reserve_access_invite('mypet-fixture-a@example.test');
 begin
 perform public.mypet_reserve_access_invite('mypet-fixture-a@example.test');raise exception 'Duplicate invite allowed';
 exception when others then if sqlerrm not like '%curs%' then raise;end if;end;
 perform public.mypet_finish_access_invite('mypet-fixture-a@example.test',(r->>'delivery_key')::uuid,null,false);
 if public.mypet_access_allowed_for('10000000-0000-4000-8000-000000000001') then raise exception 'Failed delivery restored access';end if;
 r:=public.mypet_reserve_access_invite('mypet-fixture-a@example.test');
 perform public.mypet_finish_access_invite('mypet-fixture-a@example.test',(r->>'delivery_key')::uuid,'10000000-0000-4000-8000-000000000001',true);
 if not public.mypet_access_allowed_for('10000000-0000-4000-8000-000000000001') then raise exception 'Successful invitation did not restore access';end if;

end$$;
reset role;
do $$begin if not exists(select 1 from public.pets where name='Fixture A') then raise exception 'Revocation removed records';end if;end$$;
rollback;
select 'PASS: ownership, activation, revoked JWT, protected owner, permissions, delivery failure and restoration; fixtures rolled back' as result;
