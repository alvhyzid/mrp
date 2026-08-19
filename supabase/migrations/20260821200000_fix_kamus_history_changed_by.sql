-- Migration FIXUP: kamus_terms_track_history() salah atribusi "changed_by"
-- utk histori STATUS DIKONFIRMASI -- coalesce(answered_by, confirmed_by)
-- lama SELALU memilih answered_by kalau sudah terisi (dari langkah jawab
-- sebelumnya), padahal utk histori KONFIRMASI seharusnya confirmed_by (siapa
-- yang baru saja mengonfirmasi). Ditemukan sebelum dipakai nyata, bukan lewat
-- laporan bug -- diperbaiki sebelum antrean K1 mulai dipakai.
create or replace function public.kamus_terms_track_history()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_changed_by integer;
begin
  v_changed_by := case
    when new.confirmed_by is distinct from old.confirmed_by then new.confirmed_by
    when new.answered_by is distinct from old.answered_by then new.answered_by
    else coalesce(new.answered_by, new.confirmed_by)
  end;

  if new.answer_plain is distinct from old.answer_plain then
    insert into kamus_term_history (kamus_term_id, changed_by, field_changed, old_value, new_value)
    values (new.kamus_term_id, v_changed_by, 'answer_plain', old.answer_plain, new.answer_plain);
  end if;
  if new.answer_pitfall is distinct from old.answer_pitfall then
    insert into kamus_term_history (kamus_term_id, changed_by, field_changed, old_value, new_value)
    values (new.kamus_term_id, v_changed_by, 'answer_pitfall', old.answer_pitfall, new.answer_pitfall);
  end if;
  if new.answer_range is distinct from old.answer_range then
    insert into kamus_term_history (kamus_term_id, changed_by, field_changed, old_value, new_value)
    values (new.kamus_term_id, v_changed_by, 'answer_range', old.answer_range, new.answer_range);
  end if;
  if new.status is distinct from old.status then
    insert into kamus_term_history (kamus_term_id, changed_by, field_changed, old_value, new_value)
    values (new.kamus_term_id, v_changed_by, 'status', old.status, new.status);
  end if;

  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;
