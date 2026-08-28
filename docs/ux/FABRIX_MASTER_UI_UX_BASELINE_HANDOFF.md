# FABRIX — MASTER BASELINE: HANDOFF EKSEKUTIF

Dokumen penuh: `FABRIX_MASTER_UI_UX_BASELINE.md` · Data: `…BASELINE.json`

---

## 24 JAWABAN

| # | Pertanyaan | Jawaban |
|---|---|---|
| 1 | Berapa halaman aktual? | **39** — 29 shell, 10 non-shell |
| 2 | Berapa route aktual? | **39** halaman + **122** API + 29 layout |
| 3 | Berapa capability? | **122** route API · **181** modul server · **109** punya UI, **13** tidak |
| 4 | Berapa form? | **28** halaman berkontrol, **254** kontrol |
| 5 | Berapa modal/overlay? | **109** di 22 berkas (82 Dropdown, 18 ComposedModal, 7 Modal, 2 Toggletip) |
| 6 | Berapa finding? | **21** |
| 7 | Berapa P0? | **0** |
| 8 | Berapa P1? | **8** |
| 9 | Berapa P2? | **9** |
| 10 | Berapa P3? | **4** |
| 11 | Berapa class-level? | **17** |
| 12 | Berapa page-specific? | **4**, dan hanya menyentuh **3 halaman** |
| 13 | Berapa halaman READY? | **0** READY · **27** READY WITH CLASS DEPENDENCY |
| 14 | Berapa BLOCKED? | **2** halaman · **4** workstream |
| 15 | Berapa bisa paralel? | **6 dari 10** workstream |
| 16 | Dependency terbesar? | sensus **modul mana yang punya layar** — satu-satunya urutan yang benar-benar sequential |
| 17 | Business decision terbesar? | **DEC-02** (bantuan kontekstual) dan **DEC-03/04** (`window.confirm`) — memblokir dua workstream sekaligus |
| 18 | Reference yang tersedia? | 11 dari 13 ada; **belum ada**: keadaan galat halaman penuh, aksi massal |
| 19 | Apa yang sudah selesai? | shell · kepala halaman · cetakan daftar · formulir halaman penuh · modal bertahap · baris berulang · hierarki judul · kontrak validasi (2 modul) |
| 20 | Apa yang belum? | 8 kelas P1, 4 di antaranya **tanpa penjaga sama sekali** |
| 21 | Sebaiknya paralel? | STREAM **C, A, D, G, H, J** |
| 22 | Harus sequential? | sensus layar → rollout validasi modul ketiga |
| 23 | Next batch terbaik? | **STREAM C (accessibility)** — usaha S, risiko rendah, nol blocker |
| 24 | Sengaja TIDAK disentuh? | seluruh sumber, seluruh migrasi, `build_tasks`, fixture, suite penuh |

## TEMUAN STRUKTURAL YANG MENGUBAH CARA KERJA

> **26 dari 29 halaman shell tidak punya cacat miliknya sendiri.**

Seluruh sisanya kelas. Itu penjelasan terukur kenapa pola "satu halaman sampai selesai"
menghasilkan **0 dari 22** — tiap halaman menabrak kelas yang sama, dan menyelesaikannya di
satu halaman tidak menyelesaikannya di halaman lain.

**Nol P0.** Tiga kegagalan diam di jalur menulis diperiksa satu per satu: ketiganya membuat
layar **tidak berubah** saat gagal, bukan menampilkan berhasil palsu. Melaporkannya sebagai P0
akan melebih-lebihkan.

## EMPAT KELAS P1 TANPA PENJAGA

Ini yang paling berisiko mundur diam-diam:

1. Kegagalan yang tidak terlihat (32 titik)
2. Nama aksesibel tombol (3 tombol)
3. Aksi status tanpa UI
4. Route tanpa pemanggil UI

Kelas yang sudah punya penjaga — hierarki judul, validasi field, elemen mentah, responsif —
**tidak** ada di daftar ini, dan itu memang bedanya.

## BATAS AUDIT INI — dibaca sebelum angkanya dipakai

- **10 halaman non-shell** belum diukur sama sekali.
- **Tabel diukur dalam keadaan KOSONG** di sebagian halaman: tenant uji tidak berisi.
- **Satu peran** dipakai mengukur; sistem mengenal 16.
- **Kontras, urutan Tab, perangkap fokus** tidak diukur.
- **90 galat golongan A adalah BATAS ATAS** dari penyaring kata, bukan vonis per pesan.
- **348 tombol < 40px** perlu tinjauan per kasus — bukan vonis menyeluruh.

## FALSE POSITIVE YANG DITOLAK

| Dugaan | Vonis |
|---|---|
| 62 "elemen mentah" `<h2>`–`<h4>` di halaman | **DITOLAK** — judul bagian yang sah |
| `PenandaLangkah` "nol pemakai" | **DITOLAK** — pengukur mencari nama komponen yang salah; sebenarnya **4 halaman** |
| 3 kegagalan diam jalur menulis = P0 | **DITOLAK** — layar tidak berubah saat gagal, bukan berhasil palsu |
| Tombol tanpa nama di 2 halaman | **DIKONFIRMASI** — empat mekanisme penamaan diperiksa, keempatnya kosong |

## REKOMENDASI PERINTAH BERIKUTNYA

> **STREAM C — ACCESSIBILITY BATCH**: tutup `UX-AUDIT-0001` (3 tombol unggah tanpa nama
> aksesibel di `/company` dan `/profile`) **beserta penjaganya**, dan catat `UX-AUDIT-0006`
> (Carbon `Dropdown` nol `aria-invalid`) sebagai keputusan tersendiri.

Alasannya bukan karena paling mudah, melainkan karena ia satu-satunya batch yang: usaha **S**,
risiko regresi **RENDAH**, **nol** keputusan bisnis yang memblokir, menutup satu-satunya
**P1 khusus halaman** yang tersisa, dan **melahirkan penjaga untuk kelas yang belum punya** —
sehingga perbaikannya tidak bisa mundur diam-diam.

Sesudah itu **STREAM A** (kegagalan diam + penjaganya), yang juga tidak menunggu siapa pun.

## STOP

Master Baseline selesai. **Tidak ada remediation yang dimulai. Tidak ada halaman berikutnya
yang dipilih sendiri.** Menunggu handoff Anda.
