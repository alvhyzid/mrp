<!-- Dipindahkan dari SALES_CRM_DECISION_PROPOSALS.md pada 29 Agu 2026 atas permintaan
     §30 perintah eksekusi, yang meminta berkas bernama sendiri per keputusan.
     ISINYA DIPINDAHKAN, bukan disalin -- supaya tidak lahir dua sumber untuk satu keputusan. -->

# Peran Sales (§17)

## Evidence
`src/lib/roles.ts` memuat **16 peran**, tidak satu pun bernama `sales`. Pemetaan departemen
kanonik `canApproveDepartment()` mengenal **tiga**: `finance` → `finance_manager`,
`ppic` → `ppic_manager`, `manager` → leadership.

Yang mengerjakan pekerjaan Sales hari ini: `CUSTOMER_PO_QUICK_CREATE_ROLES` =
leadership + `admin_staff`. Jadi **`admin_staff` adalah peran yang secara faktual
menjalankan fungsi Sales** untuk PO klien.

**Diukur di data nyata:** 7 akun ada, seluruhnya berakhiran `@debug.mrp`, **nol akun
manusia sungguhan** — jadi tidak ada bukti pemakaian yang bisa menjawab pertanyaan ini
dari kebiasaan.

## Pilihan
**A.** `admin_staff` memang peran Sales → cukup petakan `sales` → `admin_staff` di
`jwt_decision_department()`. Nol peran baru.
**B.** Peran `sales` sungguhan memang belum ada → tambahkan, dengan izin yang ditetapkan
pemilik produk.

## Rekomendasi
**Tidak diberikan** — ini pertanyaan tentang siapa yang bekerja di PT Indo Taste, bukan
pertanyaan teknis. **Jangan membuat peran baru sebelum dijawab**; membuatnya akan
melahirkan model peran kedua, yang dilarang CLAUDE.md.

**Akibat yang berlaku sekarang:** departemen `sales` di BD-06 **tidak dapat menahan PO
klien**, karena tidak ada peran yang memetakannya.

---
