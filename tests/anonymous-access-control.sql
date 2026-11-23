begin;
-- Synthetic accounts only. No mail is sent and every fixture is rolled back.
insert into auth.users(id,email,email_confirmed_at) values
 ('10000000-0000-4000-8000-000000000001','anonymous-fixture-a@example.test',now()),
 ('10000000-0000-4000-8000-000000000002','anonymous-fixture-b@example.test',now()),
 ('10000000-0000-4000-8000-000000000003','anonymous-fixture-c@example.test',now());
insert into anonymous.app_access(email,user_id,status) values
 ('anonymous-fixture-a@example.test','10000000-0000-4000-8000-000000000001','pending'),
 ('anonymous-fixture-b@example.test','10000000-0000-4000-8000-000000000002','active');
insert into anonymous.profiles(user_id,display_name) values
 ('10000000-0000-4000-8000-000000000001','Fixture A'),
 ('10000000-0000-4000-8000-000000000002','Fixture B');
insert into anonymous.appointments(user_id,day,start_minute,duration,client,service) values('10000000-0000-4000-8000-000000000001','2099-01-01',540,45,'Fixture','Test');
select set_config('request.jwt.claims',jsonb_build_object('sub','10000000-0000-4000-8000-000000000001','role','authenticated','amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',extract(epoch from now()))))::text,true);
set local role authenticated;
do $$begin
 if not anonymous.access_status() then raise exception 'Pending verified account cannot enter';end if;
 perform anonymous.visit();
 if (select count(*) from anonymous.profiles)<>1 then raise exception 'Ownership isolation failed';end if;
 if exists(select 1 from anonymous.profiles where display_name='Fixture B') then raise exception 'Other user data is visible';end if;
 if has_function_privilege('authenticated','anonymous.revoke_access(text)','EXECUTE') or has_table_privilege('authenticated','anonymous.app_access','SELECT') then raise exception 'Admin interface exposed';end if;
end$$;
reset role;
do $$begin
 if not exists(select 1 from anonymous.app_access where email='anonymous-fixture-a@example.test' and status='active' and last_seen_at is not null) then raise exception 'First visit not activated';end if;
 begin
 insert into anonymous.app_access(email,status) values('anzo.safe@gmail.com','revoked') on conflict(email) do update set status='revoked';
 raise exception 'Owner was not protected';
 exception when others then if sqlerrm not like '%protejat%' then raise;end if;end;
end$$;
set local role service_role;
select anonymous.revoke_access('anonymous-fixture-a@example.test');
reset role;
set local role authenticated;
do $$begin
 begin insert into anonymous.appointments(user_id,day,start_minute,duration,client,service) values(auth.uid(),'2099-01-02',540,45,'Forbidden','Test');raise exception 'Revoked account can create appointments';exception when insufficient_privilege then null;end;
 if exists(select 1 from anonymous.profiles where user_id=auth.uid()) then raise exception 'Revoked profile visible';end if;
 if anonymous.access_status() then raise exception 'Revoked JWT still has access';end if;
 if exists(select 1 from anonymous.profiles) or exists(select 1 from anonymous.appointments) then raise exception 'Revoked user can read';end if;
 begin
 insert into anonymous.profiles(user_id,display_name) values(auth.uid(),'Forbidden');
 raise exception 'Revoked user can insert';
 exception when insufficient_privilege then null;end;
 begin
 perform anonymous.visit();raise exception 'Revoked user can reactivate';
 exception when others then if sqlerrm not like '%nu este activ%' then raise;end if;end;
end$$;
reset role;
set local role service_role;
do $$declare r jsonb;begin
 r:=anonymous.reserve_access_invite('anonymous-fixture-c@example.test');
 perform anonymous.finish_access_invite('anonymous-fixture-c@example.test',(r->>'delivery_key')::uuid,'10000000-0000-4000-8000-000000000003',true);
 if not exists(select 1 from anonymous.profiles where user_id='10000000-0000-4000-8000-000000000003' and active) then raise exception 'New barber profile was not created';end if;
 r:=anonymous.reserve_access_invite('anonymous-fixture-a@example.test');
 begin
 perform anonymous.reserve_access_invite('anonymous-fixture-a@example.test');raise exception 'Duplicate invite allowed';
 exception when others then if sqlerrm not like '%curs%' then raise;end if;end;
 perform anonymous.finish_access_invite('anonymous-fixture-a@example.test',(r->>'delivery_key')::uuid,null,false);
 if (select active from anonymous.profiles where user_id='10000000-0000-4000-8000-000000000001') then raise exception 'Failed delivery enabled profile';end if;
 if anonymous.access_allowed_for('10000000-0000-4000-8000-000000000001') then raise exception 'Failed delivery restored access';end if;
 r:=anonymous.reserve_access_invite('anonymous-fixture-a@example.test');
 perform anonymous.finish_access_invite('anonymous-fixture-a@example.test',(r->>'delivery_key')::uuid,'10000000-0000-4000-8000-000000000001',true);
 if not (select active from anonymous.profiles where user_id='10000000-0000-4000-8000-000000000001') then raise exception 'Profile not restored';end if;
 if not anonymous.access_allowed_for('10000000-0000-4000-8000-000000000001') then raise exception 'Successful invitation did not restore access';end if;

end$$;
reset role;
do $$begin if (select count(*) from anonymous.appointments where user_id='10000000-0000-4000-8000-000000000001')<>1 then raise exception 'Appointments changed during access transitions';end if; if not exists(select 1 from anonymous.profiles where display_name='Fixture A') then raise exception 'Revocation removed records';end if;end$$;
rollback;
select 'PASS: ownership, activation, revoked JWT, protected owner, permissions, delivery failure and restoration; fixtures rolled back' as result;
