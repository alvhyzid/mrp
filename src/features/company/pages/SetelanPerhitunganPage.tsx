'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  Tag,
  TextArea,
  TextInput,
  Toggletip,
  ToggletipButton,
  ToggletipContent,
  Tile
} from '@carbon/react';
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
    const res = await fetch('/api/company/settings');
    if (res.status === 401) {
      router.replace('/login?redirectTo=/company/setelan');
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      setGalat(data.error ?? 'Gagal memuat setelan.');
      setMemuat(false);
      return;
    }
    setSetelan(data.setelan ?? []);
    setJejak(data.jejak ?? []);
    setBolehMengubah(Boolean(data.boleh_mengubah));
    setDraf(Object.fromEntries((data.setelan ?? []).map((s: Setelan) => [s.kunci, s.nilai])));
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
    const res = await fetch('/api/company/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        perubahan: berubah.map((s) => ({ kunci: s.kunci, nilai: draf[s.kunci] ?? '' })),
        berlaku_sejak: berlakuSejak,
        alasan: alasan.trim() || null
      })
    });
    const data = await res.json();
    setMenyimpan(false);
    if (!res.ok) {
      setGalat(data.error ?? 'Gagal menyimpan.');
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
      <div style={{ padding: '1rem', maxWidth: '60rem' }}>
        <SkeletonText heading width="20rem" />
        <SkeletonText paragraph lineCount={8} />
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', maxWidth: '60rem' }}>
      <h1 className="cds--type-productive-heading-04" style={{ marginBottom: '0.25rem' }}>
        Setelan Perhitungan
      </h1>
      <p className="cds--type-body-01" style={{ color: 'var(--cds-text-secondary)', marginBottom: '1.5rem' }}>
        Angka-angka di halaman ini dipakai menghitung biaya tenaga kerja, harga pokok produksi, dan margin.
        Mengubahnya mengubah arti seluruh angka biaya di sistem.
      </p>

      {galat && (
        <InlineNotification
          kind="error"
          title="Gagal"
          subtitle={galat}
          onCloseButtonClick={() => setGalat(null)}
          lowContrast
          style={{ marginBottom: '1rem', maxWidth: '100%' }}
        />
      )}
      {berhasil && (
        <InlineNotification
          kind="success"
          title="Tersimpan"
          subtitle={berhasil}
          onCloseButtonClick={() => setBerhasil(null)}
          lowContrast
          style={{ marginBottom: '1rem', maxWidth: '100%' }}
        />
      )}
      {!bolehMengubah && (
        <InlineNotification
          kind="info"
          title="Hanya melihat"
          subtitle="Hanya Admin Perusahaan atau General Manager yang dapat mengubah setelan ini. Hubungi salah satunya bila ada yang perlu diperbaiki."
          hideCloseButton
          lowContrast
          style={{ marginBottom: '1rem', maxWidth: '100%' }}
        />
      )}
      {belumDiisi > 0 && (
        <InlineNotification
          kind="warning"
          title={`${belumDiisi} setelan belum pernah diisi`}
          subtitle="Perhitungan yang membutuhkannya tidak akan menghasilkan angka sampai diisi."
          hideCloseButton
          lowContrast
          style={{ marginBottom: '1rem', maxWidth: '100%' }}
        />
      )}

      {kelompokUrut.map((kelompok) => (
        <Tile key={kelompok} style={{ marginBottom: '1rem' }}>
          <h2 className="cds--type-productive-heading-03" style={{ marginBottom: '1rem' }}>
            {kelompok}
          </h2>
          <div className="setelan-kisi">
            {setelan
              .filter((s) => s.kelompok === kelompok)
              .map((s) => {
                const nilai = draf[s.kunci] ?? '';
                const berubahIni = nilai !== s.nilai;
                const label = (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    {s.label}
                    <Toggletip align="top">
                      <ToggletipButton label={`Penjelasan ${s.label}`}>
                        <Information />
                      </ToggletipButton>
                      <ToggletipContent>
                        <p>{s.bantuan}</p>
                        {s.memengaruhi_historis && (
                          <p style={{ marginTop: '0.5rem' }}>
                            Setelan ini memengaruhi perhitungan yang sudah lewat, jadi perubahannya bertanggal berlaku.
                          </p>
                        )}
                      </ToggletipContent>
                    </Toggletip>
                    {!s.pernah_diisi && <Tag type="red" size="sm">Belum diisi</Tag>}
                    {berubahIni && <Tag type="blue" size="sm">Diubah</Tag>}
                  </span>
                );

                if (s.jenis === 'pilihan') {
                  return (
                    <Select
                      key={s.kunci}
                      id={s.kunci}
                      labelText={label}
                      value={nilai}
                      disabled={!bolehMengubah}
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
                    onChange={(e) => setDraf((p) => ({ ...p, [s.kunci]: e.target.value }))}
                  />
                );
              })}
          </div>
        </Tile>
      ))}

      {bolehMengubah && berubah.length > 0 && (
        <Tile style={{ marginBottom: '1rem' }}>
          <h2 className="cds--type-productive-heading-03" style={{ marginBottom: '0.5rem' }}>
            Simpan {berubah.length} perubahan
          </h2>

          {adaPerubahanHistoris && (
            <InlineNotification
              kind="warning"
              title="Sebagian perubahan memengaruhi angka yang sudah lewat"
              subtitle="Tanggal berlaku menentukan sejak kapan angka baru dipakai. Isi tanggal mundur hanya bila memang berlaku surut."
              hideCloseButton
              lowContrast
              style={{ marginBottom: '1rem', maxWidth: '100%' }}
            />
          )}

          <ul style={{ marginBottom: '1rem' }}>
            {berubah.map((s) => (
              <li key={s.kunci} className="cds--type-body-01" style={{ marginBottom: '0.25rem' }}>
                <strong>{s.label}</strong>: {s.nilai === '' ? '(belum diisi)' : s.nilai} →{' '}
                {draf[s.kunci] === '' ? '(kosong)' : draf[s.kunci]}
                {s.memengaruhi_historis && (
                  <WarningAlt style={{ verticalAlign: 'middle', marginLeft: '0.25rem' }} />
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

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
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
        <h2 className="cds--type-productive-heading-03" style={{ marginBottom: '0.5rem' }}>
          Jejak perubahan
        </h2>
        <p className="cds--type-body-01" style={{ color: 'var(--cds-text-secondary)', marginBottom: '1rem' }}>
          Setiap perubahan tercatat: siapa, kapan, dari apa ke apa, dan sejak kapan berlaku.
        </p>
        {jejak.length === 0 ? (
          <p className="cds--type-body-01">Belum ada perubahan yang tercatat.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
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
