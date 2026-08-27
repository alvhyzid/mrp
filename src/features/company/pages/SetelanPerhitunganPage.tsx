'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authedJson, SesiTidakValid } from '@/lib/authedFetch';
import {
  Button,
  DatePicker,
  DatePickerInput,
  InlineNotification,
  Select,
  SelectItem,
  SkeletonText,
  StructuredListBody,
  StructuredListCell,
  StructuredListHead,
  StructuredListRow,
  StructuredListWrapper,
  TextArea,
  TextInput,
  Toggletip,
  ToggletipButton,
  ToggletipContent,
  Tile
} from '@carbon/react';
import { KepalaHalaman } from '@/components/ui/kepala-halaman';
import { Information, WarningAlt } from '@carbon/icons-react';

// LAYAR PILOT CARBON PERTAMA (DS-1 pilot (b), 25 Agu 2026) — lahir Carbon-first, nol
// pekerjaan migrasi. Sekaligus menutup MST-26: sebelum ini, 17 setelan yang dibaca SELURUH
// perhitungan biaya SDM, HPP, dan margin TIDAK PUNYA SATU PUN jalur tulis di aplikasi.
//
// KENAPA BANTUAN MEMAKAI Toggletip, BUKAN Tooltip: aturan tetap proyek (CLAUDE.md, 24 Agu
// 2026) menetapkan penjelasan dibuka dengan KLIK, tidak pernah hanya dengan sentuhan kursor
// — penjelasan hover TIDAK BISA DIPAKAI SAMA SEKALI di HP dan tablet, dan justru perangkat
// itulah yang dipakai di lantai produksi. Toggletip Carbon dibuka dengan klik; Tooltip
// Carbon dibuka dengan hover. Perbedaannya bukan gaya, melainkan bisa-tidaknya dipakai.

interface Setelan {
  kunci: string;
  label: string;
  bantuan: string;
  kelompok: string;
  jenis: 'angka' | 'persen' | 'rupiah' | 'pilihan' | 'teks';
  pilihan: { nilai: string; label: string }[] | null;
  memengaruhi_historis: boolean;
  nilai: string;
  pernah_diisi: boolean;
}

interface Jejak {
  setting_key: string;
  old_value: string | null;
  new_value: string | null;
  effective_from: string;
  changed_by_name: string | null;
  changed_by_role: string | null;
  reason: string | null;
  changed_at: string;
}

function hariIni(): string {
  // Tanggal LOKAL, bukan toISOString(). toISOString() memakai UTC dan bisa mundur satu hari
  // untuk pengguna di Indonesia — kelas cacat yang sudah pernah menggigit proyek ini.
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function SetelanPerhitunganPage() {
  const router = useRouter();
  const [memuat, setMemuat] = useState(true);
  const [setelan, setSetelan] = useState<Setelan[]>([]);
  const [jejak, setJejak] = useState<Jejak[]>([]);
  const [bolehMengubah, setBolehMengubah] = useState(false);
  const [draf, setDraf] = useState<Record<string, string>>({});
  const [berlakuSejak, setBerlakuSejak] = useState(hariIni());
  const [alasan, setAlasan] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [berhasil, setBerhasil] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat(null);
    // AUD-35 — memakai authedFetch bersama. Versi pertama halaman ini memanggil fetch()
    // telanjang tanpa header Authorization; server menjawab 401 dan halaman ini mengalihkan
    // penggunanya sendiri ke layar masuk, SELAMANYA. Lihat catatan lengkap di
    // src/lib/authedFetch.ts.
    let res: { ok: boolean; status: number; body: Record<string, unknown> };
    try {
      res = await authedJson('/api/company/settings');
    } catch (e) {
      if (e instanceof SesiTidakValid) {
        router.replace('/login?redirectTo=/company/setelan');
        return;
      }
      setGalat(e instanceof Error ? e.message : String(e));
      setMemuat(false);
      return;
    }
    if (res.status === 401) {
      router.replace('/login?redirectTo=/company/setelan');
      return;
    }
    const data = res.body as Record<string, unknown>;
    if (!res.ok) {
      setGalat((data.error as string) ?? 'Gagal memuat setelan.');
      setMemuat(false);
      return;
    }
    setSetelan((data.setelan as Setelan[]) ?? []);
    setJejak((data.jejak as Jejak[]) ?? []);
    setBolehMengubah(Boolean(data.boleh_mengubah));
    setDraf(Object.fromEntries(((data.setelan as Setelan[]) ?? []).map((s) => [s.kunci, s.nilai])));
    setMemuat(false);
  }, [router]);

  useEffect(() => {
    void muat();
  }, [muat]);

  const berubah = useMemo(
    () => setelan.filter((s) => (draf[s.kunci] ?? '') !== s.nilai),
    [setelan, draf]
  );
  const adaPerubahanHistoris = berubah.some((s) => s.memengaruhi_historis);
  const belumDiisi = setelan.filter((s) => !s.pernah_diisi).length;

  const kelompokUrut = useMemo(() => {
    const urut: string[] = [];
    for (const s of setelan) if (!urut.includes(s.kelompok)) urut.push(s.kelompok);
    return urut;
  }, [setelan]);

  async function simpan() {
    setMenyimpan(true);
    setGalat(null);
    setBerhasil(null);
    let res: { ok: boolean; status: number; body: Record<string, unknown> };
    try {
      res = await authedJson('/api/company/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          perubahan: berubah.map((s) => ({ kunci: s.kunci, nilai: draf[s.kunci] ?? '' })),
          berlaku_sejak: berlakuSejak,
          alasan: alasan.trim() || null
        })
      });
    } catch (e) {
      setMenyimpan(false);
      setGalat(e instanceof Error ? e.message : String(e));
      return;
    }
    const data = res.body as Record<string, unknown>;
    setMenyimpan(false);
    if (!res.ok) {
      setGalat((data.error as string) ?? 'Gagal menyimpan.');
      return;
    }
    setBerhasil(
      data.peringatan_jejak
        ? String(data.peringatan_jejak)
        : `${data.tersimpan} setelan tersimpan, berlaku sejak ${berlakuSejak}.`
    );
    setAlasan('');
    await muat();
  }

  if (memuat) {
    return (
      <div className="halaman setelan-halaman">
        <SkeletonText heading width="20rem" />
        <SkeletonText paragraph lineCount={8} />
      </div>
    );
  }

  return (
    <div className="halaman setelan-halaman">
      <KepalaHalaman
        remah={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Settings' }, { label: 'Calculation Settings' }]}
        judul="Setelan perhitungan"
        pengantar="Angka di halaman ini dipakai menghitung biaya tenaga kerja, harga pokok produksi, dan margin. Mengubahnya mengubah arti seluruh angka biaya di sistem."
      />

      {galat && (
        <InlineNotification
          kind="error"
          title="Gagal"
          subtitle={galat}
          onCloseButtonClick={() => setGalat(null)}
          lowContrast
          className="setelan-pemberitahuan"
        />
      )}
      {berhasil && (
        <InlineNotification
          kind="success"
          title="Tersimpan"
          subtitle={berhasil}
          onCloseButtonClick={() => setBerhasil(null)}
          lowContrast
          className="setelan-pemberitahuan"
        />
      )}
      {!bolehMengubah && (
        <InlineNotification
          kind="info"
          title="Hanya melihat"
          subtitle="Hanya Admin Perusahaan atau General Manager yang dapat mengubah setelan ini. Hubungi salah satunya bila ada yang perlu diperbaiki."
          hideCloseButton
          lowContrast
          className="setelan-pemberitahuan"
        />
      )}
      {belumDiisi > 0 && (
        <InlineNotification
          kind="warning"
          title={`${belumDiisi} setelan belum pernah diisi`}
          subtitle="Perhitungan yang membutuhkannya tidak akan menghasilkan angka sampai diisi."
          hideCloseButton
          lowContrast
          className="setelan-pemberitahuan"
        />
      )}

      {kelompokUrut.map((kelompok) => (
        <Tile key={kelompok} className="setelan-tile">
          <h2 className="setelan-kelompok-judul">{kelompok}</h2>
          <div className="setelan-kisi">
            {setelan
              .filter((s) => s.kelompok === kelompok)
              .map((s) => {
                const nilai = draf[s.kunci] ?? '';
                const berubahIni = nilai !== s.nilai;
                // FF.1 — status field memakai `warn`/`warnText` bawaan Carbon, BUKAN Tag.
                // Versi pertama halaman ini memakai <Tag> untuk menandai "Belum diisi", dan
                // Tag Carbon MEMANG berbentuk pil (border-radius 1rem) menurut spesifikasinya.
                // Jadi sudut membulat yang terlihat pemilik produk bukan Carbon yang ditimpa —
                // melainkan komponen yang SALAH DIPILIH. Tag untuk menggolongkan dan menyaring;
                // status sebuah field dijawab `warn`/`warnText` yang sudah dibawa kontrolnya.
                const label = (
                  <span className="setelan-label">
                    {s.label}
                    <Toggletip align="top">
                      <ToggletipButton label={`Penjelasan ${s.label}`}>
                        <Information />
                      </ToggletipButton>
                      <ToggletipContent>
                        <p>{s.bantuan}</p>
                        {s.memengaruhi_historis && (
                          <p className="setelan-bantuan-lanjutan">
                            Setelan ini memengaruhi perhitungan yang sudah lewat, jadi perubahannya bertanggal berlaku.
                          </p>
                        )}
                      </ToggletipContent>
                    </Toggletip>
                  </span>
                );
                const statusField = !s.pernah_diisi
                  ? { warn: true, warnText: 'Belum pernah diisi' }
                  : berubahIni
                    ? { warn: true, warnText: 'Diubah, belum disimpan' }
                    : {};

                if (s.jenis === 'pilihan') {
                  return (
                    <Select
                      key={s.kunci}
                      id={s.kunci}
                      labelText={label}
                      value={nilai}
                      disabled={!bolehMengubah}
                      {...statusField}
                      onChange={(e) => setDraf((p) => ({ ...p, [s.kunci]: e.target.value }))}
                    >
                      <SelectItem value="" text="— pilih —" />
                      {(s.pilihan ?? []).map((p) => (
                        <SelectItem key={p.nilai} value={p.nilai} text={p.label} />
                      ))}
                    </Select>
                  );
                }

                return (
                  <TextInput
                    key={s.kunci}
                    id={s.kunci}
                    labelText={label}
                    value={nilai}
                    disabled={!bolehMengubah}
                    type={s.jenis === 'teks' ? 'text' : 'number'}
                    step={s.jenis === 'persen' ? '0.01' : undefined}
                    {...statusField}
                    onChange={(e) => setDraf((p) => ({ ...p, [s.kunci]: e.target.value }))}
                  />
                );
              })}
          </div>
        </Tile>
      ))}

      {bolehMengubah && berubah.length > 0 && (
        <Tile className="setelan-tile">
          <h2 className="setelan-kelompok-judul">Simpan {berubah.length} perubahan</h2>

          {adaPerubahanHistoris && (
            <InlineNotification
              kind="warning"
              title="Sebagian perubahan memengaruhi angka yang sudah lewat"
              subtitle="Tanggal berlaku menentukan sejak kapan angka baru dipakai. Isi tanggal mundur hanya bila memang berlaku surut."
              hideCloseButton
              lowContrast
              className="setelan-pemberitahuan"
            />
          )}

          <ul className="setelan-ringkas">
            {berubah.map((s) => (
              <li key={s.kunci}>
                <strong>{s.label}</strong>: {s.nilai === '' ? '(belum diisi)' : s.nilai} →{' '}
                {draf[s.kunci] === '' ? '(kosong)' : draf[s.kunci]}
                {s.memengaruhi_historis && (
                  <WarningAlt className="setelan-ikon-peringatan" />
                )}
              </li>
            ))}
          </ul>

          <div className="setelan-kisi">
            <DatePicker
              datePickerType="single"
              dateFormat="Y-m-d"
              value={berlakuSejak}
              onChange={(d: Date[]) => {
                if (d?.[0]) {
                  const t = d[0];
                  setBerlakuSejak(
                    `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
                  );
                }
              }}
            >
              <DatePickerInput
                id="berlaku-sejak"
                labelText="Berlaku sejak"
                placeholder="tahun-bulan-tanggal"
              />
            </DatePicker>

            <TextArea
              id="alasan"
              labelText="Alasan perubahan"
              helperText="Ditulis di jejak perubahan. Berbulan-bulan kemudian, ini yang menjelaskan kenapa angkanya berbeda."
              value={alasan}
              rows={2}
              onChange={(e) => setAlasan(e.target.value)}
            />
          </div>

          <div className="setelan-aksi">
            <Button onClick={() => void simpan()} disabled={menyimpan}>
              {menyimpan ? 'Menyimpan…' : 'Simpan perubahan'}
            </Button>
            <Button
              kind="ghost"
              disabled={menyimpan}
              onClick={() => setDraf(Object.fromEntries(setelan.map((s) => [s.kunci, s.nilai])))}
            >
              Batalkan perubahan
            </Button>
          </div>
        </Tile>
      )}

      <Tile>
        <h2 className="setelan-kelompok-judul">Jejak perubahan</h2>
        <p className="setelan-teks--redup setelan-pengantar-kecil">
          Setiap perubahan tercatat: siapa, kapan, dari apa ke apa, dan sejak kapan berlaku.
        </p>
        {jejak.length === 0 ? (
          <p className="setelan-teks">Belum ada perubahan yang tercatat.</p>
        ) : (
          <div className="setelan-jejak-gulir">
            <StructuredListWrapper isCondensed>
              <StructuredListHead>
                <StructuredListRow head>
                  <StructuredListCell head>Setelan</StructuredListCell>
                  <StructuredListCell head>Dari</StructuredListCell>
                  <StructuredListCell head>Jadi</StructuredListCell>
                  <StructuredListCell head>Berlaku sejak</StructuredListCell>
                  <StructuredListCell head>Oleh</StructuredListCell>
                  <StructuredListCell head>Alasan</StructuredListCell>
                </StructuredListRow>
              </StructuredListHead>
              <StructuredListBody>
                {jejak.map((j, i) => (
                  <StructuredListRow key={`${j.setting_key}-${j.changed_at}-${i}`}>
                    <StructuredListCell>{j.setting_key}</StructuredListCell>
                    <StructuredListCell>{j.old_value ?? '(belum diisi)'}</StructuredListCell>
                    <StructuredListCell>{j.new_value}</StructuredListCell>
                    <StructuredListCell>{j.effective_from}</StructuredListCell>
                    <StructuredListCell>{j.changed_by_name ?? j.changed_by_role ?? '—'}</StructuredListCell>
                    <StructuredListCell>{j.reason ?? '—'}</StructuredListCell>
                  </StructuredListRow>
                ))}
              </StructuredListBody>
            </StructuredListWrapper>
          </div>
        )}
      </Tile>
    </div>
  );
}
