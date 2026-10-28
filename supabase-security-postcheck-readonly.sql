-- Jóváhagyott alkalmazás UTÁN: csak olvasó visszaellenőrzés, nincs próba-jóváírás.
begin read only;
with admin_rpc(signature) as (values
 ('public.admin_delete_support_message(uuid)'),('public.admin_list_users()'),
 ('public.admin_set_user_plan(uuid,text)'),('public.admin_set_user_plan(uuid,text,text,integer)'),
 ('public.admin_grant_ai_credits(uuid,integer,text)'),('public.admin_set_user_admin(uuid,boolean)'),
 ('public.admin_cleanup_project_remainders_v153()'))
select jsonb_build_object(
 'captured_at',now(),
 'admin_rpc_permissions',(select jsonb_agg(jsonb_build_object('function',signature,
    'anon_execute',has_function_privilege('anon',signature,'EXECUTE'),
    'authenticated_execute',has_function_privilege('authenticated',signature,'EXECUTE'))) from admin_rpc),
 'payment_anon_execute',has_function_privilege('anon','public.grant_ai_credits_admin(uuid,integer,text,text,integer,jsonb)','EXECUTE'),
 'payment_authenticated_execute',has_function_privilege('authenticated','public.grant_ai_credits_admin(uuid,integer,text,text,integer,jsonb)','EXECUTE'),
 'payment_service_execute',has_function_privilege('service_role','public.grant_ai_credits_admin(uuid,integer,text,text,integer,jsonb)','EXECUTE'),
 'payment_function_definition',pg_get_functiondef('public.grant_ai_credits_admin(uuid,integer,text,text,integer,jsonb)'::regprocedure),
 'credit_indexes',(select jsonb_agg(jsonb_build_object('definition',pg_get_indexdef(i.indexrelid),
     'unique',i.indisunique,'valid',i.indisvalid,'ready',i.indisready))
     from pg_index i where i.indrelid='public.ai_credit_transactions'::regclass),
 'duplicate_order_groups',(select count(*) from (select paypal_order_id from public.ai_credit_transactions
     where paypal_order_id is not null group by paypal_order_id having count(*)>1) d),
 'unrestricted_notifications_policy_remaining',exists(select 1 from pg_policies where schemaname='public'
     and tablename='notifications' and policyname='Allow all for authenticated'),
 'support_insert_boundary',(select jsonb_agg(to_jsonb(p)) from pg_policies p where schemaname='public'
     and tablename='support_messages' and policyname='support insert requires owner 20261028'),
 'admin_views',(select jsonb_agg(jsonb_build_object('name',c.relname,'options',c.reloptions,'definition',pg_get_viewdef(c.oid,true)))
     from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
     and c.relkind='v' and c.relname like 'admin\_%' escape '\'),
 'profile_role_update',has_column_privilege('authenticated','public.profiles','role','UPDATE'),
 'profile_admin_update',has_column_privilege('authenticated','public.profiles','is_admin','UPDATE')
) as security_postcheck;
rollback;
