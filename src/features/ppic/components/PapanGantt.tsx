'use client';

import React, { useMemo, useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Button, Tag } from '@carbon/react';
import { ChevronDown, ChevronRight, UserAvatar } from '@carbon/icons-react';

// GAYANYA ADA DI papan-gantt.scss DI FOLDER INI, tetapi DIIMPOR DARI
// app/(shell)/ppic/layout.tsx — sama seperti seluruh stylesheet lain di proyek ini.
// Jangan menambahkan `import './papan-gantt.scss'` di sini: itu akan membuat gayanya
// masuk lewat dua jalur.
//
// ============================================================================
// PAPAN GANTT PPIC — dibangun menurut spesifikasi Carbon:
// https://carbondesignsystem.com/data-visualization/gantt-charts/
//
// Halaman itu menyatakan sendiri: "The charts below are not included in the
// carbon-charts library." Jadi ini MEMBANGUN menurut spesifikasi, bukan memasang
// komponen — dan paket @carbon/charts memang tidak terpasang di proyek ini.
//
// Anatomi yang diikuti, dari tiga gambar resminya:
//   KIRI  ("Card component")  — chevron mekar, nama tugas tebal, rentang tanggal,
//                               deretan Tag untuk sub-tugas dengan "+N", foto pelaksana.
//   KANAN ("Task component")  — batang berlatar warna muda, foto di kiri, nama di
//                               tengah, persen di kanan, GARIS PROGRES di bawah batang,
//                               BELAH KETUPAT untuk tonggak waktu, dan GARIS SIKU
//                               penghubung antar sub-tugas saat dimekarkan.
//   SUMBU  — nama bulan, lalu nama hari, AKHIR PEKAN DIREDUPKAN.
//
// PEMETAAN KE DATA KITA (keputusan pemilik produk 26 Agu 2026: "HARUSNYA MULTI LINE,
// WO 1 / - BATCH A / - BATCH B"):
//   Task    -> Work Order        Subtask -> Batch produksi
//   Batang anak -> satu tahap routing    Warna   -> Work Center (mesin mana)
//   Persen  -> tahap selesai / tahap seluruhnya, dari work_order_step_progress
//   Tonggak -> jadwal RENCANA (kosong) vs waktu NYATA (padat)
//
// YANG SENGAJA TIDAK ADA, dan alasannya:
//   - Menu titik-tiga per baris. Gambar Carbon memuatnya, tapi dari halaman ini tidak
//     ada satu pun tindakan yang berlaku untuk sebuah Work Order. Menu yang isinya
//     tidak melakukan apa-apa sudah tiga kali jadi cacat di proyek ini.
//   - Tab "Project 1 / Project 2". Tidak ada konsep proyek; Sales Order dipakai sebagai
//     SARINGAN, bukan sebagai tab — sebab Work Order boleh tidak punya SO sama sekali
//     (produksi untuk stok), dan tab per SO akan menyembunyikannya.
// ============================================================================

export type BlokGantt = {
  work_center_id: number;
  date: string;
  production_batch_id: number;
  batch_number: string;
  batch_status: string;
  item_code: string | null;
  item_name: string | null;
  routing_step_id: number;
  step_name: string;
  sequence_no: number;
  duration_minutes: number;
  day_offset: number;
  minute_of_day: number;
  work_order_id: number;
  progress_status: string | null;
};

export type PelaksanaGantt = { employee_id: number; name: string; avatar_url: string | null; step_id: number | null };

export type WorkOrderGantt = {
  work_order_id: number;
  item_code: string | null;
  item_name: string | null;
  planned_qty: number | null;
  status: string;
  priority: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start_at: string | null;
  actual_completed_at: string | null;
  so_number: string | null;
  progress_pct: number | null;
  total_steps: number;
  completed_steps: number;
  assignees: PelaksanaGantt[];
};

export type BatchGantt = {
  production_batch_id: number;
  work_order_id: number;
  batch_number: string;
  status: string;
  planned_date: string | null;
  planned_qty: number;
  uom: string;
};

export type WorkCenterGantt = { work_center_id: number; name: string; code: string | null };

const MENIT_SEHARI = 1440;
const NAMA_HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function tanggalKeTeks(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()} ${NAMA_BULAN[d.getMonth()].slice(0, 3)}`;
}

function jamKeTeks(menit: number): string {
  const j = Math.floor(menit / 60) % 24;
  const m = Math.round(menit % 60);
  return `${String(j).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function durasiKeTeks(menit: number): string {
  if (menit < 60) return `${Math.round(menit)} menit`;
  const jam = menit / 60;
  return `${jam % 1 === 0 ? jam : jam.toFixed(1)} jam`;
}

// Warna = Work Center. Nomornya dari URUTAN work center, bukan dari id-nya: id bisa
// meloncat (mis. 3, 17, 41) dan modulo terhadap id akan memberi dua mesin bertetangga
// warna yang sama tanpa alasan yang bisa dijelaskan.
function nomorWarna(indeks: number): number {
  return (indeks % 8) + 1;
}

type Gaya = React.CSSProperties & Record<string, string | number>;

function KolomJatuh({ id, tanggal, batchId, akhirPekan }: { id: string; tanggal: string; batchId: number | null; akhirPekan: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { date: tanggal, production_batch_id: batchId } });
  return (
    <div
      ref={setNodeRef}
      className={`gantt__kolom${akhirPekan ? ' gantt__kolom--pekan' : ''}${isOver ? ' gantt__kolom--sasaran' : ''}`}
    />
  );
}

function LapisanKolom({ hari, batchId, bisaJatuh }: { hari: string[]; batchId: number | null; bisaJatuh: boolean }) {
  return (
    <div className="gantt__kolom-lapis">
      {hari.map((h) => {
        const hariKe = new Date(`${h}T00:00:00`).getDay();
        const pekan = hariKe === 0 || hariKe === 6;
        if (!bisaJatuh || batchId === null) return <div key={h} className={`gantt__kolom${pekan ? ' gantt__kolom--pekan' : ''}`} />;
        return <KolomJatuh key={h} id={`jatuh-${batchId}-${h}`} tanggal={h} batchId={batchId} akhirPekan={pekan} />;
      })}
    </div>
  );
}

function DeretFoto({ orang }: { orang: PelaksanaGantt[] }) {
  if (orang.length === 0) return null;
  const tampil = orang.slice(0, 3);
  const sisa = orang.length - tampil.length;
  return (
    <div className="gantt__pelaksana">
      {tampil.map((o) => (
        <span key={o.employee_id} className="gantt__foto" title={o.name}>
          {/* Foto kosong JATUH KE IKON, bukan ke inisial nama — aturan unggah gambar
              proyek ini: inisial terlihat seperti data padahal cuma tebakan. */}
          {o.avatar_url ? <img src={o.avatar_url} alt={o.name} /> : <UserAvatar size={16} aria-label={o.name} />}
        </span>
      ))}
      {sisa > 0 ? <span className="gantt__foto-sisa">+{sisa}</span> : null}
    </div>
  );
}

function BatangTahap({
  blok,
  kiriPersen,
  lebarPersen,
  warna,
  bisaSeret,
  pelaksana,
  onBukaDetail
}: {
  blok: BlokGantt;
  kiriPersen: number;
  lebarPersen: number;
  warna: number;
  bisaSeret: boolean;
  pelaksana: PelaksanaGantt[];
  onBukaDetail: (blok: BlokGantt) => void;
}) {
  const seret = bisaSeret && blok.batch_status === 'planned';
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `block-${blok.production_batch_id}-${blok.sequence_no}-${blok.date}`,
    data: {
      type: 'block',
      production_batch_id: blok.production_batch_id,
      batch_number: blok.batch_number,
      work_center_id: blok.work_center_id,
      day_offset: blok.day_offset
    },
    disabled: !seret
  });

  const gaya: Gaya = { '--gantt-kiri': `${kiriPersen}%`, '--gantt-lebar': `${lebarPersen}%`, '--gantt-atas': '0.5rem' };
  // Nama tahap hanya ditulis DI DALAM batang bila memang muat. Di bawah kira-kira 12%
  // lebar jalur, batang menyusut ke lebar sentuh minimum (44px) dan tidak memuat satu kata
  // pun. Nama tahapnya TIDAK hilang — ia dibaca di panel KIRI sebagai deretan Tag, persis
  // seperti gambar Carbon yang menaruh nama sub-tugas di kartu kiri, bukan di batangnya.
  //
  // Versi sebelumnya menaruh nama di SEBELAH KANAN batang dan ditinggalkan setelah dilihat:
  // batang berdempetan membuat label saling menimpa ("Filadonatak2ja3 jam").
  const muatTeks = lebarPersen >= 12;
  const selesai = blok.progress_status === 'completed';
  const judul = [
    `${blok.batch_number} · ${blok.step_name}`,
    `Mulai ${jamKeTeks(blok.minute_of_day)}, durasi aktif ${durasiKeTeks(blok.duration_minutes)}`,
    blok.progress_status === null ? 'Kemajuan belum tercatat' : `Kemajuan: ${blok.progress_status}`,
    seret ? 'Klik untuk detail, seret untuk jadwalkan ulang' : 'Klik untuk detail'
  ].join('\n');

  return (
    <>
      {/* pengawas-elemen:mulai — batang Gantt. Carbon TIDAK menyediakan komponen batang
          jadwal (dinyatakan di halaman spesifikasinya sendiri), dan Button Carbon membawa
          tinggi, padding, serta warna sendiri yang justru harus ditimpa seluruhnya di sini.
          Elemen <button> mentah dipakai supaya batangnya tetap bisa ditekan keyboard. */}
      <button
        type="button"
        ref={setNodeRef}
        {...(seret ? listeners : {})}
        {...(seret ? attributes : {})}
        onClick={() => onBukaDetail(blok)}
        title={judul}
        style={gaya}
        className={`gantt__batang gantt__batang--w${warna}${seret ? ' gantt__batang--seret' : ''}${isDragging ? ' gantt__batang--diseret' : ''}`}
      >
        {/* pengawas-elemen:selesai */}
        {pelaksana.length > 0 ? (
          <span className="gantt__foto gantt__batang-foto" title={pelaksana[0].name}>
            {pelaksana[0].avatar_url ? <img src={pelaksana[0].avatar_url} alt={pelaksana[0].name} /> : <UserAvatar size={16} aria-label={pelaksana[0].name} />}
          </span>
        ) : null}
        {muatTeks ? (
          <>
            <span className="gantt__batang-nama">{blok.step_name}</span>
            <span className="gantt__batang-persen">{durasiKeTeks(blok.duration_minutes)}</span>
          </>
        ) : null}
      </button>

      <span className="gantt__progres" style={gaya} aria-hidden="true">
        <span
          className={`gantt__progres-isi gantt__progres-isi--w${warna}`}
          style={{ '--gantt-progres': selesai ? '100%' : blok.progress_status === 'in_progress' ? '50%' : '0%' } as Gaya}
        />
      </span>
    </>
  );
}

export default function PapanGantt({
  hari,
  blok,
  workOrders,
  batches,
  workCenters,
  bisaSeret,
  onBukaDetail
}: {
  hari: string[];
  blok: BlokGantt[];
  workOrders: WorkOrderGantt[];
  batches: BatchGantt[];
  workCenters: WorkCenterGantt[];
  bisaSeret: boolean;
  onBukaDetail: (blok: BlokGantt) => void;
}) {
  const [mekar, setMekar] = useState<Set<number>>(() => new Set());

  const indeksHari = useMemo(() => new Map(hari.map((h, i) => [h, i])), [hari]);
  const totalMenit = hari.length * MENIT_SEHARI;
  const warnaWcById = useMemo(() => new Map(workCenters.map((wc, i) => [wc.work_center_id, nomorWarna(i)])), [workCenters]);
  const namaWcById = useMemo(() => new Map(workCenters.map((wc) => [wc.work_center_id, wc.code ?? wc.name])), [workCenters]);

  // Menit absolut dari awal rentang yang dilihat. Inilah satu-satunya tempat posisi
  // dihitung: sisanya cuma membagi dengan totalMenit. Dua rumus posisi yang terpisah
  // akan menyimpang diam-diam begitu salah satunya diperbaiki.
  const menitMulai = (b: BlokGantt): number => (indeksHari.get(b.date) ?? 0) * MENIT_SEHARI + b.minute_of_day;

  const blokPerBatch = useMemo(() => {
    const peta = new Map<number, BlokGantt[]>();
    for (const b of blok) {
      const daftar = peta.get(b.production_batch_id) ?? [];
      daftar.push(b);
      peta.set(b.production_batch_id, daftar);
    }
    for (const daftar of peta.values()) daftar.sort((a, b) => menitMulai(a) - menitMulai(b));
    return peta;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blok, indeksHari]);

  const batchPerWo = useMemo(() => {
    const peta = new Map<number, BatchGantt[]>();
    for (const b of batches) {
      const daftar = peta.get(b.work_order_id) ?? [];
      daftar.push(b);
      peta.set(b.work_order_id, daftar);
    }
    for (const daftar of peta.values()) daftar.sort((a, b) => (a.planned_date ?? '').localeCompare(b.planned_date ?? ''));
    return peta;
  }, [batches]);

  const woTerurut = useMemo(() => {
    const mulaiWo = new Map<number, number>();
    for (const b of blok) {
      const m = menitMulai(b);
      const kini = mulaiWo.get(b.work_order_id);
      if (kini === undefined || m < kini) mulaiWo.set(b.work_order_id, m);
    }
    return [...workOrders].sort((a, b) => (mulaiWo.get(a.work_order_id) ?? 0) - (mulaiWo.get(b.work_order_id) ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrders, blok, indeksHari]);

  // Garis "sekarang" hanya digambar bila hari ini memang ada di rentang yang dilihat.
  const posisiKini = useMemo(() => {
    const kini = new Date();
    const iso = `${kini.getFullYear()}-${String(kini.getMonth() + 1).padStart(2, '0')}-${String(kini.getDate()).padStart(2, '0')}`;
    const idx = indeksHari.get(iso);
    if (idx === undefined) return null;
    return ((idx * MENIT_SEHARI + kini.getHours() * 60 + kini.getMinutes()) / totalMenit) * 100;
  }, [indeksHari, totalMenit]);

  const gayaPapan: Gaya = { '--gantt-kolom': hari.length, '--gantt-lebar-kolom': hari.length > 10 ? '4rem' : '11rem' };

  const kiniIso = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const posisiWaktu = (iso: string | null): number | null => {
    if (!iso) return null;
    const d = new Date(iso);
    const tgl = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const idx = indeksHari.get(tgl);
    if (idx === undefined) return null;
    return ((idx * MENIT_SEHARI + d.getHours() * 60 + d.getMinutes()) / totalMenit) * 100;
  };

  const tonggak = (wo: WorkOrderGantt) =>
    [
      { posisi: posisiWaktu(wo.scheduled_start), nyata: false, judul: 'Rencana mulai' },
      { posisi: posisiWaktu(wo.scheduled_end), nyata: false, judul: 'Rencana selesai' },
      { posisi: posisiWaktu(wo.actual_start_at), nyata: true, judul: 'Mulai sungguhan' },
      { posisi: posisiWaktu(wo.actual_completed_at), nyata: true, judul: 'Selesai sungguhan' }
    ].filter((t): t is { posisi: number; nyata: boolean; judul: string } => t.posisi !== null);

  if (woTerurut.length === 0) {
    return (
      <div className="gantt">
        <p className="gantt__kosong">Belum ada batch terjadwal di rentang ini.</p>
      </div>
    );
  }

  return (
    <>
      <div className="gantt">
        <div className="gantt__isi" style={gayaPapan}>
          <div className="gantt__baris gantt__kepala">
            <div className="gantt__sel-kiri">
              <span className="gantt__judul-papan">Work order</span>
              <span className="gantt__subjudul-papan">batch di bawahnya</span>
            </div>
            <div className="gantt__jalur">
              <div className="gantt__periode">
                {NAMA_BULAN[new Date(`${hari[0]}T00:00:00`).getMonth()]} {new Date(`${hari[0]}T00:00:00`).getFullYear()}
              </div>
              <div className="gantt__hari-baris">
                {hari.map((h) => {
                  const d = new Date(`${h}T00:00:00`);
                  const pekan = d.getDay() === 0 || d.getDay() === 6;
                  const iniHariIni = h === kiniIso;
                  return (
                    <span key={h} className={`gantt__hari${pekan ? ' gantt__hari--pekan' : ''}${iniHariIni ? ' gantt__hari--kini' : ''}`}>
                      {NAMA_HARI[d.getDay()]} {d.getDate()}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {woTerurut.map((wo) => {
            const daftarBatch = batchPerWo.get(wo.work_order_id) ?? [];
            const blokWo = blok.filter((b) => b.work_order_id === wo.work_order_id);
            const mulai = blokWo.length ? Math.min(...blokWo.map(menitMulai)) : 0;
            const selesai = blokWo.length ? Math.max(...blokWo.map((b) => menitMulai(b) + b.duration_minutes)) : 0;
            const terbuka = mekar.has(wo.work_order_id);
            const gayaBatangWo: Gaya = {
              '--gantt-kiri': `${(mulai / totalMenit) * 100}%`,
              '--gantt-lebar': `${Math.max(((selesai - mulai) / totalMenit) * 100, 0.5)}%`,
              '--gantt-atas': '0.75rem'
            };

            return (
              <React.Fragment key={wo.work_order_id}>
                <div className={`gantt__baris${terbuka ? ' gantt__baris--mekar' : ''}`}>
                  <div className="gantt__sel-kiri">
                    <div className="gantt__kepala-kartu">
                      <Button
                        kind="ghost"
                        size="sm"
                        hasIconOnly
                        className="gantt__chevron"
                        renderIcon={terbuka ? ChevronDown : ChevronRight}
                        iconDescription={terbuka ? 'Tutup daftar batch' : 'Buka daftar batch'}
                        onClick={() =>
                          setMekar((prev) => {
                            const baru = new Set(prev);
                            if (baru.has(wo.work_order_id)) baru.delete(wo.work_order_id);
                            else baru.add(wo.work_order_id);
                            return baru;
                          })
                        }
                      />
                      <div>
                        <div className="gantt__nama">{wo.item_code ?? wo.item_name ?? `Work order ${wo.work_order_id}`}</div>
                        <div className="gantt__rentang">
                          {blokWo.length ? `${tanggalKeTeks(hari[Math.floor(mulai / MENIT_SEHARI)])}–${tanggalKeTeks(hari[Math.min(hari.length - 1, Math.floor((selesai - 1) / MENIT_SEHARI))])}` : '—'}
                          {wo.so_number ? ` · ${wo.so_number}` : ''}
                        </div>
                        <div className="gantt__tag-baris">
                          {daftarBatch.slice(0, 3).map((b) => (
                            <Tag key={b.production_batch_id} size="sm" type="blue">
                              {b.batch_number}
                            </Tag>
                          ))}
                          {daftarBatch.length > 3 ? (
                            <Tag size="sm" type="gray">
                              +{daftarBatch.length - 3}
                            </Tag>
                          ) : null}
                        </div>
                        <DeretFoto orang={wo.assignees} />
                      </div>
                    </div>
                  </div>
                  <div className="gantt__jalur">
                    <LapisanKolom hari={hari} batchId={null} bisaJatuh={false} />
                    {posisiKini !== null ? <span className="gantt__garis-kini" style={{ insetInlineStart: `${posisiKini}%` }} /> : null}
                    {blokWo.length ? (
                      <>
                        {/* pengawas-elemen:mulai — batang ringkasan Work Order. Sama seperti batang
                            tahap: Carbon tidak menyediakan komponennya, dan Button Carbon justru
                            harus ditimpa seluruhnya. Tetap <button> supaya bisa ditekan keyboard. */}
                        <button
                          type="button"
                          className="gantt__batang gantt__batang--ringkasan"
                          style={gayaBatangWo}
                          title={`${wo.item_name ?? ''} · ${wo.completed_steps}/${wo.total_steps} tahap selesai`}
                          onClick={() =>
                            setMekar((prev) => {
                              const baru = new Set(prev);
                              if (baru.has(wo.work_order_id)) baru.delete(wo.work_order_id);
                              else baru.add(wo.work_order_id);
                              return baru;
                            })
                          }
                        >
                          {/* pengawas-elemen:selesai */}
                          <span className="gantt__batang-nama">{wo.item_name ?? `WO ${wo.work_order_id}`}</span>
                          <span className="gantt__batang-persen">{wo.progress_pct === null ? 'belum diukur' : `${wo.progress_pct}%`}</span>
                        </button>
                        <span className="gantt__progres" style={gayaBatangWo} aria-hidden="true">
                          <span className="gantt__progres-isi gantt__progres-isi--w1" style={{ '--gantt-progres': `${wo.progress_pct ?? 0}%` } as Gaya} />
                        </span>
                        {tonggak(wo).map((t) => (
                          <span
                            key={t.judul}
                            title={t.judul}
                            className={`gantt__tonggak ${t.nyata ? 'gantt__tonggak--nyata' : 'gantt__tonggak--rencana'}`}
                            style={{ '--gantt-kiri': `${t.posisi}%`, '--gantt-atas': '0.75rem' } as Gaya}
                          />
                        ))}
                      </>
                    ) : null}
                  </div>
                </div>

                {terbuka
                  ? daftarBatch.map((b) => {
                      const daftarBlok = blokPerBatch.get(b.production_batch_id) ?? [];
                      return (
                        <div className="gantt__baris gantt__baris--mekar" key={b.production_batch_id}>
                          <div className="gantt__sel-kiri gantt__sel-kiri--anak">
                            <div className="gantt__nama gantt__nama--anak">{b.batch_number}</div>
                            <div className="gantt__rentang">
                              {b.planned_date ? tanggalKeTeks(b.planned_date) : 'belum dijadwalkan'} · {b.planned_qty} {b.uom}
                            </div>
                            <div className="gantt__tag-baris">
                              <Tag size="sm" type={b.status === 'in_progress' ? 'green' : 'cool-gray'}>
                                {b.status === 'in_progress' ? 'Berjalan' : 'Direncanakan'}
                              </Tag>
                            </div>
                            {/* Nama tahap ada DI SINI, sesuai anatomi "Card component" Carbon:
                                deretan sub-tugas dibaca di kartu kiri. Titik berwarna di
                                depannya menyambungkan tiap tahap ke batangnya di kanan. */}
                            <div className="gantt__tag-baris">
                              {daftarBlok.map((bl) => (
                                <span key={`tag-${bl.routing_step_id}-${bl.date}`} className="gantt__tahap-butir" title={`${bl.step_name} · ${namaWcById.get(bl.work_center_id) ?? ''}`}>
                                  <span className={`gantt__titik gantt__titik--w${warnaWcById.get(bl.work_center_id) ?? 1}`} />
                                  {bl.step_name}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="gantt__jalur">
                            <LapisanKolom hari={hari} batchId={b.production_batch_id} bisaJatuh={bisaSeret && b.status === 'planned'} />
                            {daftarBlok.map((bl, i) => {
                              const mulaiBl = menitMulai(bl);
                              const kiri = (mulaiBl / totalMenit) * 100;
                              const lebar = Math.max((bl.duration_minutes / totalMenit) * 100, 0.4);
                              const berikut = daftarBlok[i + 1];
                              const akhirBl = mulaiBl + bl.duration_minutes;
                              const jarak = berikut ? menitMulai(berikut) - akhirBl : 0;
                              return (
                                <React.Fragment key={`${bl.routing_step_id}-${bl.date}-${bl.sequence_no}`}>
                                  <BatangTahap
                                    blok={bl}
                                    kiriPersen={kiri}
                                    lebarPersen={lebar}
                                    warna={warnaWcById.get(bl.work_center_id) ?? 1}
                                    bisaSeret={bisaSeret}
                                    pelaksana={wo.assignees.filter((o) => o.step_id === null || o.step_id === bl.routing_step_id)}
                                    onBukaDetail={onBukaDetail}
                                  />
                                  {berikut && jarak > 0 ? (
                                    <span
                                      className="gantt__penghubung"
                                      aria-hidden="true"
                                      style={{ '--gantt-kiri': `${(akhirBl / totalMenit) * 100}%`, '--gantt-lebar': `${(jarak / totalMenit) * 100}%`, '--gantt-atas': '1.75rem' } as Gaya}
                                    />
                                  ) : null}
                                </React.Fragment>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  : null}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="gantt__legenda">
        {workCenters.map((wc, i) => (
          <span key={wc.work_center_id} className="gantt__legenda-butir">
            <span className={`gantt__titik gantt__titik--w${nomorWarna(i)}`} />
            {namaWcById.get(wc.work_center_id)}
          </span>
        ))}
        <span className="gantt__legenda-butir">
          <span className="gantt__tonggak gantt__tonggak--nyata gantt__legenda-tonggak" /> sudah terjadi
        </span>
        <span className="gantt__legenda-butir">
          <span className="gantt__tonggak gantt__tonggak--rencana gantt__legenda-tonggak" /> masih rencana
        </span>
      </div>
    </>
  );
}
