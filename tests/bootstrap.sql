-- Only the disposable issue8_test database. Auth helpers model signed request claims.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema extensions;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
grant usage on schema public,auth to anon,authenticated,service_role;
grant execute on function auth.uid(),auth.jwt() to anon,authenticated,service_role;
insert into auth.users(id,email) values
 ('11111111-1111-4111-8111-111111111111','owner@example.test'),
 ('22222222-2222-4222-8222-222222222222','other@example.test'),
 ('33333333-3333-4333-8333-333333333333','atika.76@windowslive.com');
