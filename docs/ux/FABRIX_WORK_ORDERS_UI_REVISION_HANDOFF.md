# FABRIX — HANDOFF REVISI UI /work-orders (PILOT #2)

**28 Agustus 2026 · HEAD awal `b562f7c`**

> Laporan penuh: `FABRIX_WORK_ORDERS_UI_REVISION_REPORT.md`.

---

## PERUBAHAN

Tiga berkas sumber, satu berkas uji baru. **Nol halaman lain disentuh.**

| Berkas | Perubahan |
|---|---|
| `work-orders.scss` | `.wo-form` **satu kolom** (breakpoint dicabut); kelas `.wo-kosong` |
| `WorkOrdersPage.tsx` | keadaan kosong menawarkan **dua jalan keluar berbeda**; `'Siap Mulai'` → `'Siap mulai'`; pesan galat jadi Bahasa Indonesia |
| `createProductionBatch.ts` | pesan galat jadi Bahasa Indonesia |

## ALASAN

Keempatnya berdasar **aturan tertulis yang sudah berlaku**, bukan selera: cetakan §6e
(satu kolom), aturan bahasa, cetakan §4 (kosong menawarkan jalan keluar), dan aturan kapital
25 Agu.

## BUKTI

| | Sebelum | Sesudah |
|---|---|---|
| Kolom modal @672–1920 | **2** | **1** |
| Lebar per kontrol @672 | 257 px | **530 px** *(+106%)* |
| Lebar per kontrol @1440 | 321 px | **657 px** *(+105%)* |
| Tombol "Buat Work Order pertama" | tidak ada | **ada di 6 lebar** |
| Gulir menyamping, 6 lebar | nol | **nol** |

**Ongkosnya**: isi modal kini **menggulir** (828 px dalam jendela 670 px) — satu kolom memang
lebih tinggi, dan §6e memang menerima itu.

## TEST

`tests/work_orders_revisi_ui.test.ts` — **8 uji**, MERAH lebih dulu (4 gagal) lalu HIJAU.
Typecheck bersih · lint **28 = baseline**.

**Satu penjaga sempat bisa lolos hampa** dan langsung diperketat: uji keadaan kosong mencari
`<Button>` mana pun, dan tetap hijau meski tombol "buat pertama" dicabut — karena cabang
saringan punya tombolnya sendiri. Diperketat ke **dua jalan keluar yang disebut namanya**.

## KETERBATASAN

**`/work-orders` NOT COMPLETE menurut Definition of Done** — empat butir gagal, dan **tiga
di antaranya kelas lintas halaman atau tanpa aturan**.

Pola ini **sama persis dengan pilot `/routing`**. Dua pilot berturut-turut gagal pada butir
yang sama — itu bukan kebetulan melainkan sifat Definition of Done-nya.

## TEMUAN YANG DITUNDA

| # | Temuan |
|---|---|
| **T-W1** | UI jeda/batal Work Order **tidak ada** — server & route lengkap, nol pemanggil. Halaman menawarkan saringan "Dijeda"/"Batal" untuk keadaan yang tidak bisa dihasilkan siapa pun. **Kejadian keempat** dari kelas yang CLAUDE.md catat tiga kali |
| **T-W2** | Hierarki judul h1 → h4. **Lintas halaman & tanpa aturan**: BomsPage `h3`, ItemsPage & WorkOrders `h4` |
| **T-W3** | Field mati `scheduled_end` — dikirim ke server, nol kontrol. **Butuh keputusan bisnis** |
| **T-W4** | Nol `invalidText` — kelas lintas halaman (F-03) |
| **T-W5** | Tidak ada ringkasan draf — menerapkannya mengubah modal jadi bertahap |
| **T-W6** | Panel detail: kegagalan muat **diam** — terbukti lewat 404 yang tidak menghasilkan pesan apa pun |
| **T-W7** | Empat peta label disalin ke 9/8/3/2 berkas |

## TEMUAN LINTAS HALAMAN

T-W2, T-W4, dan T-W7 **tidak bisa diselesaikan per halaman**. Ketiganya perlu batch kelas
tersendiri — dan selama belum, **setiap pilot berikutnya akan gagal pada butir yang sama**.

## KOREKSI TERHADAP AUDIT SEBELUMNYA

**#3 FALSE POSITIVE.** Audit lama menyatakan `/work-orders` *"satu-satunya dari empat halaman"*
tanpa penjaga peran. Diukur: `accessDenied` ada, **sama seperti tiga halaman lain**.

## KEPEMILIKAN TASK

**Nol perubahan `build_tasks`. Nol task dibuat.** W-1…W-4 belum punya pemilik. T-W1 sisi
servernya milik `PRD-12` (selesai); sisi UI-nya **tidak dimiliki siapa pun**.

> `DS-23` · `DS-24` · `AUD-49` kosong; **11 temuan** di register menunggu ID.

## HALAMAN BERIKUTNYA

Sesuai urutan sapuan: **`/production`** (14 cacat, dua blok baris berulang sekelas DS-22),
lalu `/customers`, lalu `/ppic`.

**Tetapi pertimbangkan mendahulukan batch KELAS** (T-W2/T-W4/T-W7). Dua pilot berturut-turut
sudah gagal pada butir yang sama; halaman ketiga akan gagal pada butir yang sama lagi.
