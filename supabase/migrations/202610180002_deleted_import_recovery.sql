-- PR #1 review: explicit owner-confirmed replacement of deleted projects.
begin;
create or replace function public.register_szakipiac_import_v2(p_row jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.project_import_requests%rowtype; n integer;
begin
 if (p_row->>'protocol_version')::integer is distinct from 2 or p_row->>'source_status' is distinct from 'accepted'
   or nullif(p_row->>'accepted_at','') is null or nullif(p_row->>'owner_email','') is null
   or coalesce(p_row->>'source_quote_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
  raise exception 'Hiányzó hitelesített ajánlatverzió.';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('szakipiac:' || (p_row->>'source_quote_id'),0));
 select count(*) into n from public.project_import_requests where source_app='szakipiac'
  and source_quote_id=p_row->>'source_quote_id' and (claimed_project_id is not null or claimed_at is not null or import_status in ('complete','partial','deleted'));
 if n>1 then raise exception 'Korábbi többszörös import: kézi ellenőrzés szükséges.'; end if;
 select * into r from public.project_import_requests where source_app='szakipiac'
  and source_quote_id=p_row->>'source_quote_id' and (claimed_project_id is not null or claimed_at is not null or import_status in ('complete','partial','deleted')) limit 1;
 if found then return to_jsonb(r); end if;
 insert into public.project_import_requests(token,source_app,source_quote_id,project_name,client_name,client_email,client_phone,
  client_city,client_address,quote_total_gross,payload,protocol_version,verified_owner_email,source_accepted_at,import_status)
 values(p_row->>'token','szakipiac',p_row->>'source_quote_id',p_row->>'project_name',p_row->>'client_name',p_row->>'client_email',
  p_row->>'client_phone',p_row->>'client_city',p_row->>'client_address',(p_row->>'quote_total_gross')::numeric,p_row->'payload',
  2,lower(p_row->>'owner_email'),(p_row->>'accepted_at')::timestamptz,'pending')
 on conflict(source_app,source_quote_id) where protocol_version=2 do update
  set created_at=now() -- Refresh expiry only. The verified accepted version remains unchanged.
 returning * into r;
 return to_jsonb(r);
end; $$;
revoke all on function public.register_szakipiac_import_v2(jsonb) from public, anon, authenticated;
grant execute on function public.register_szakipiac_import_v2(jsonb) to service_role;

create or replace function public.claim_szakipiac_import_v2(p_token text,p_user_id uuid,p_plan jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.project_import_requests%rowtype; previous public.project_import_requests%rowtype;
 user_email text; project_owner uuid; project_id uuid; entry_id uuid; it jsonb;
 warnings jsonb := '[]'; counts jsonb := '{}'; steps jsonb := '{}'; n integer; total integer; err text;
begin
 select lower(email) into user_email from auth.users where id=p_user_id;
 if user_email is null then raise exception 'Érvénytelen felhasználó.'; end if;
 select * into r from public.project_import_requests where token=p_token;
 if not found then return jsonb_build_object('ok',false,'error','Nem található import link.'); end if;
 perform pg_advisory_xact_lock(hashtextextended('szakipiac:' || r.source_quote_id,0));
 select * into r from public.project_import_requests where token=p_token for update;
 if r.claimed_project_id is not null then
  select user_id into project_owner from public.projects where id=r.claimed_project_id;
  if project_owner is distinct from p_user_id then raise exception 'Másik fiók projektje.'; end if;
  if r.protocol_version is distinct from 2 then
   return jsonb_build_object('ok',true,'already_claimed',true,'project_id',r.claimed_project_id,
    'status','legacy','warnings',jsonb_build_array('Korábbi import. Teljessége külön ellenőrzendő; a történeti adatokat nem módosítottuk.'),'inserted',r.inserted_counts);
  end if;
 end if;
 if r.claimed_project_id is null and r.protocol_version is distinct from 2 and r.claimed_at is not null then
  if r.claimed_by is distinct from p_user_id then raise exception 'Másik fiók korábbi projektje.'; end if;
  return jsonb_build_object('ok',false,'code','project_deleted','status','deleted','can_restore',false,
   'error','A korábbi naplóprojektet törölték. A régi importhoz nincs igazolt v2 átvétel; kézi ellenőrzés szükséges.');
 end if;
 if r.protocol_version is distinct from 2 or r.source_accepted_at is null then
  return jsonb_build_object('ok',false,'error','Régi, nem igazolt importlink. Indítsd újra az elfogadott ajánlatból.');
 end if;
 if r.verified_owner_email is distinct from user_email then raise exception 'Az ajánlat tulajdonosának Építési Napló fiókjával jelentkezz be.'; end if;
 -- A project FK becomes NULL on deletion, while import completion survives.
 -- Both a reopen and a newly requested link must expose this tombstone first.
 if r.claimed_project_id is null and (r.claimed_at is not null or r.import_status in ('complete','partial','deleted')) then
  if r.claimed_by is not null and r.claimed_by is distinct from p_user_id then
   raise exception 'A törölt projekt másik fiókhoz tartozott.';
  end if;
  if not coalesce((p_plan->>'restore_deleted')::boolean,false) then
   update public.project_import_requests set import_status='deleted' where id=r.id;
   return jsonb_build_object('ok',false,'code','project_deleted','status','deleted','can_restore',true,
    'error','A korábban importált naplóprojektet törölték. Külön megerősítéssel új projekt készíthető az elfogadott ajánlatból. A törölt napi dokumentáció nem áll vissza.');
  end if;
  -- Reset only local processing state. Core writes and the replacement pointer
  -- commit together below, or roll back together; history is not deduplicated.
  r.import_status:='pending'; r.inserted_counts:='{}'; r.completed_steps:='{}'; r.imported_entry_id:=null;
 end if;
 if r.import_status='complete' and r.claimed_project_id is not null then
  return jsonb_build_object('ok',true,'already_claimed',true,'project_id',r.claimed_project_id,'status','complete','inserted',r.inserted_counts,'warnings',r.import_warnings);
 end if;
 if r.claimed_project_id is null and r.claimed_at is null and r.created_at<now()-interval '7 days' then
  return jsonb_build_object('ok',false,'error','Az import link lejárt. Készíts új linket a SzakiPiacban.');
 end if;
 select count(*) into n from public.project_import_requests where source_app='szakipiac'
  and source_quote_id=r.source_quote_id and claimed_project_id is not null and id<>r.id;
 if n>1 then raise exception 'Korábbi többszörös import: kézi ellenőrzés szükséges.'; end if;
 select * into previous from public.project_import_requests where source_app='szakipiac'
  and source_quote_id=r.source_quote_id and claimed_project_id is not null and id<>r.id limit 1;
 if found then
  select user_id into project_owner from public.projects where id=previous.claimed_project_id;
  if project_owner is distinct from p_user_id then raise exception 'A korábbi import másik fiókhoz tartozik.'; end if;
  return jsonb_build_object('ok',true,'already_claimed',true,'project_id',previous.claimed_project_id,'status','legacy',
   'warnings',jsonb_build_array('Már létezik korábbi import. A történeti adatokat nem módosítottuk.'),'inserted',previous.inserted_counts);
 end if;
 -- A subtransaction rolls back ALL core writes on failure, while persisting retry state.
 begin
  project_id:=r.claimed_project_id; entry_id:=r.imported_entry_id;
  counts:=r.inserted_counts; steps:=r.completed_steps;
  if project_id is null then
   insert into public.projects(user_id,name,location) values(p_user_id,r.project_name,p_plan->>'location') returning id into project_id;
   insert into public.entries(user_id,project_id,phase,status,priority,responsible,note,ai_title,ai_advice,ai_json,materials_json,location_address)
   values(p_user_id,project_id,p_plan->>'phase','folyamatban','normál',r.client_name,p_plan->>'note','SzakiPiac ajánlat importálva',
    p_plan->'ai',p_plan->'ai',p_plan->'items',p_plan->>'location') returning id into entry_id;
   insert into public.project_imports(project_id,source_app,source_quote_id,client_name,client_email,client_phone,client_city,client_address,quote_total_gross,payload)
   values(project_id,'szakipiac',r.source_quote_id,r.client_name,r.client_email,r.client_phone,r.client_city,r.client_address,r.quote_total_gross,r.payload);
   counts:=jsonb_build_object('projects',1,'entries',1,'imports',1,'materials',0,'tasks',0,'diary',0);
  end if;
  if not coalesce((steps->>'materials')::boolean,false) then
   begin
    total:=0;
    for it in select value from jsonb_array_elements(p_plan->'items') where value->>'type'='anyag' or (value->>'material_total')::numeric>0 loop
     insert into public.project_materials(user_id,project_id,entry_id,name,quantity,unit,note)
     values(p_user_id,project_id,entry_id,it->>'name',(it->>'quantity')::numeric,it->>'unit',
      'SzakiPiac import – anyag összesen: ' || (it->>'material_total') || ' Ft');
     get diagnostics n=row_count; total:=total+n;
    end loop;
    counts:=jsonb_set(counts,'{materials}',to_jsonb(total)); steps:=jsonb_set(steps,'{materials}','true');
   exception when others then warnings:=warnings||jsonb_build_array('Anyagok: ' || SQLERRM); end;
  end if;
  if not coalesce((steps->>'tasks')::boolean,false) then
   begin
    total:=0;
    for it in select value from jsonb_array_elements(p_plan->'items') where value->>'type' in ('munka','egyeb') or (value->>'labor_total')::numeric>0 loop
     insert into public.tasks(user_id,project_id,source_entry_id,title,owner,deadline,priority,done)
     values(p_user_id,project_id,entry_id,(it->>'name') || ' – ' || (it->>'quantity') || ' ' || (it->>'unit') || ' – ' || (it->>'labor_total') || ' Ft',r.client_name,null,'normál',false);
     get diagnostics n=row_count; total:=total+n;
    end loop;
    counts:=jsonb_set(counts,'{tasks}',to_jsonb(total)); steps:=jsonb_set(steps,'{tasks}','true');
   exception when others then warnings:=warnings||jsonb_build_array('Feladatok: ' || SQLERRM); end;
  end if;
  if not coalesce((steps->>'diary')::boolean,false) then
   begin
    insert into public.diary_entries(user_id,project_id,description,work_type) values(p_user_id,project_id,p_plan->>'note',p_plan->>'phase');
    get diagnostics n=row_count;
    counts:=jsonb_set(counts,'{diary}',to_jsonb(n)); steps:=jsonb_set(steps,'{diary}','true');
   exception when others then warnings:=warnings||jsonb_build_array('Napló: ' || SQLERRM); end;
  end if;
  update public.project_import_requests set claimed_by=p_user_id,claimed_project_id=project_id,claimed_at=coalesce(claimed_at,now()),
   imported_entry_id=entry_id,inserted_counts=counts,completed_steps=steps,import_warnings=warnings,last_error=null,
   import_status=case when jsonb_array_length(warnings)=0 then 'complete' else 'partial' end where id=r.id;
 exception when others then
  err:=SQLERRM;
  update public.project_import_requests set import_status='failed',last_error=err,import_warnings=jsonb_build_array(err) where id=r.id;
  return jsonb_build_object('ok',false,'status','failed','retryable',true,'error','Import nem fejeződött be: '||err,'warnings',jsonb_build_array(err),'inserted',r.inserted_counts);
 end;
 return jsonb_build_object('ok',true,'project_id',project_id,'entry_id',entry_id,'status',case when jsonb_array_length(warnings)=0 then 'complete' else 'partial' end,
  'retryable',jsonb_array_length(warnings)>0,'inserted',counts,'warnings',warnings);
end; $$;
revoke all on function public.claim_szakipiac_import_v2(text,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.claim_szakipiac_import_v2(text,uuid,jsonb) to service_role;
commit;
