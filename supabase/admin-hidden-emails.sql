-- Admin presentation only; access registries and application records remain authoritative.
create table public.myapps_admin_hidden (
 app text not null check(app in ('mylist','mycar','mypet','anonymous')),
 email text not null check(email=lower(trim(email)) and length(email)<=254),
 hidden_at timestamptz not null default now(),
 primary key(app,email)
);
alter table public.myapps_admin_hidden enable row level security;
revoke all on public.myapps_admin_hidden from public,anon,authenticated;
grant select,insert,update,delete on public.myapps_admin_hidden to service_role;
