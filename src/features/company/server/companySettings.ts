import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { isCompanyLeadership } from '@/lib/roles';
import { KATALOG_SETELAN, PETA_SETELAN, validasiSetelan } from './companySettingsCatalog';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// SETELAN PERUSAHAAN (MST-26, 25 Agu 2026) — jalur tulis pertama yang pernah ada.
//
// Sebelum ini, ketujuh belas setelan hanya bisa lahir dari skrip sekali-pakai. Perusahaan
// baru yang mendaftar lewat layar berdiri tanpa satu pun setelan, dan seluruh perhitungan
// biaya SDM, HPP, serta margin membacanya. Angkanya bukan salah — ia tidak ada.

export async function getCompanySettings(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();

    const [nilaiRes, jejakRes] = await Promise.all([
      adminClient.from('company_settings').select('setting_key, setting_value').eq('company_id', appUser.company_id),
      adminClient
        .from('company_settings_history')
        .select('setting_key, old_value, new_value, effective_from, changed_by_name, changed_by_role, reason, changed_at')
        .eq('company_id', appUser.company_id)
        .order('changed_at', { ascending: false })
        .limit(50)
    ]);

    if (nilaiRes.error) return { status: 500, body: { error: nilaiRes.error.message } };
    if (jejakRes.error) return { status: 500, body: { error: jejakRes.error.message } };

    const tersimpan = new Map((nilaiRes.data ?? []).map((r) => [r.setting_key, r.setting_value]));

    // Katalog yang menentukan daftarnya, BUKAN isi database. Setelan yang belum pernah diisi
    // tetap muncul di layar dengan nilai kosong — kalau daftarnya diambil dari database,
    // perusahaan baru akan melihat halaman kosong tanpa tahu ada 17 hal yang perlu diisi.
    const setelan = KATALOG_SETELAN.map((def) => ({
      kunci: def.kunci,
      label: def.label,
      bantuan: def.bantuan,
      kelompok: def.kelompok,
      jenis: def.jenis,
      pilihan: def.pilihan ?? null,
      memengaruhi_historis: def.memengaruhiHistoris,
      nilai: tersimpan.get(def.kunci) ?? '',
      pernah_diisi: tersimpan.has(def.kunci)
    }));

    return {
      status: 200,
      body: {
        setelan,
        jejak: jejakRes.data ?? [],
        boleh_mengubah: isCompanyLeadership(appUser.role),
        belum_diisi: setelan.filter((s) => !s.pernah_diisi).length
      }
    };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

export async function updateCompanySettings(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    // Gerbang peran ditegakkan di SERVER, bukan dengan menyembunyikan tombol. Setelan ini
    // menentukan arti seluruh angka biaya perusahaan — sama seperti policy RLS
    // company_settings_write_leadership yang sudah ada di database.
    if (!isCompanyLeadership(appUser.role)) {
      return {
        status: 403,
        body: { error: 'Hanya Admin Perusahaan atau General Manager yang dapat mengubah setelan perusahaan.' }
      };
    }

    const body = await request.json();
    const perubahanMasuk = Array.isArray(body.perubahan) ? body.perubahan : [];
    const berlakuSejak = String(body.berlaku_sejak ?? '').trim();
    const alasan = body.alasan ? String(body.alasan).trim() : null;

    if (perubahanMasuk.length === 0) {
      return { status: 400, body: { error: 'Tidak ada perubahan yang dikirim.' } };
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(berlakuSejak)) {
      return { status: 400, body: { error: 'Tanggal berlaku wajib diisi dengan format tahun-bulan-tanggal.' } };
    }

    const adminClient = getAdminClient();

    const { data: nilaiLama, error: bacaError } = await adminClient
      .from('company_settings')
      .select('setting_key, setting_value')
      .eq('company_id', appUser.company_id);
    if (bacaError) return { status: 500, body: { error: bacaError.message } };

    const lama = new Map((nilaiLama ?? []).map((r) => [r.setting_key, r.setting_value ?? '']));

    // SELURUH perubahan divalidasi DULU sebelum satu pun ditulis. Menyimpan sebagian lalu
    // gagal di tengah meninggalkan setelan yang setengah berubah — dan setengah berubah pada
    // angka yang menentukan HPP lebih buruk daripada gagal seluruhnya.
    const galat: string[] = [];
    const akanDitulis: { kunci: string; nilaiBaru: string; nilaiLama: string }[] = [];

    for (const p of perubahanMasuk) {
      const kunci = String(p?.kunci ?? '').trim();
      const nilaiBaru = String(p?.nilai ?? '').trim();

      if (!PETA_SETELAN.has(kunci)) {
        galat.push(`Setelan "${kunci}" tidak dikenal.`);
        continue;
      }
      const pesan = validasiSetelan(kunci, nilaiBaru);
      if (pesan) {
        galat.push(pesan);
        continue;
      }

      const sebelumnya = lama.get(kunci) ?? '';
      if (sebelumnya === nilaiBaru) continue; // tidak berubah -- tidak perlu jejak

      akanDitulis.push({ kunci, nilaiBaru, nilaiLama: sebelumnya });
    }

    if (galat.length > 0) {
      return { status: 400, body: { error: galat[0], seluruh_galat: galat } };
    }

    if (akanDitulis.length === 0) {
      return { status: 200, body: { success: true, tersimpan: 0, pesan: 'Tidak ada nilai yang berubah.' } };
    }

    const { error: simpanError } = await adminClient.from('company_settings').upsert(
      akanDitulis.map((p) => ({
        company_id: appUser.company_id,
        setting_key: p.kunci,
        setting_value: p.nilaiBaru
      })),
      { onConflict: 'company_id,setting_key' }
    );
    if (simpanError) return { status: 500, body: { error: simpanError.message } };

    // JEJAK WAJIB. Ditulis SESUDAH nilainya tersimpan supaya tidak pernah ada jejak untuk
    // perubahan yang ternyata gagal. Kegagalan menulis jejak TIDAK dibiarkan diam: ia
    // dikembalikan sebagai peringatan, karena setelan tanpa jejak adalah keadaan yang harus
    // diketahui, bukan disembunyikan.
    const { error: jejakError } = await adminClient.from('company_settings_history').insert(
      akanDitulis.map((p) => ({
        company_id: appUser.company_id,
        setting_key: p.kunci,
        old_value: p.nilaiLama === '' ? null : p.nilaiLama,
        new_value: p.nilaiBaru,
        effective_from: berlakuSejak,
        changed_by: appUser.user_id,
        changed_by_name: appUser.name ?? null,
        changed_by_role: appUser.role ?? null,
        reason: alasan
      }))
    );

    return {
      status: 200,
      body: {
        success: true,
        tersimpan: akanDitulis.length,
        peringatan_jejak: jejakError ? `Setelan tersimpan, tapi jejak perubahan GAGAL dicatat: ${jejakError.message}` : null
      }
    };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
