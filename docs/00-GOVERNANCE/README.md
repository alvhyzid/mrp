# 00-GOVERNANCE — peta berkas

Tiga belas berkas di folder ini adalah **tata kelola kanonik** FABRIX. Sampai 29 Agustus 2026
sebagian besar berisi **kerangka tanpa isi** — mendaftar apa yang harus dicatat, dan mencatat
nol. Sejak 29 Agu 2026 setiap berkas yang menyimpan **keadaan** diisi dari **pengukuran**,
dan bagian isian itu selalu diberi judul bertanggal supaya kerangkanya tetap terbaca sebagai
kerangka.

## Berkas yang menyimpan KEADAAN (diisi & wajib diperbarui saat keadaannya berubah)

| Berkas | Menjawab pertanyaan |
|---|---|
| `FABRIX_PROJECT_STATUS.md` | Di mana proyek berdiri hari ini? Apa yang menghambat? |
| `FABRIX_ARCHITECTURE_MAP.md` | Domain apa saja yang ada, dan siapa pemilik tiap hal? |
| `FABRIX_ENTITY_REGISTRY.md` | Entitas apa saja, siapa pemiliknya, **berapa yang terpakai**? |
| `FABRIX_STATE_MACHINE_REGISTRY.md` | Mesin status mana yang nyata, dan perpindahan apa yang sah? |
| `FABRIX_CROSS_DOMAIN_CONTRACTS.md` | Kontrak antar domain yang benar-benar ada, dan yang belum ada |
| `FABRIX_ADR_REGISTER.md` | Keputusan arsitektur apa yang mengikat, dan mana yang masih usulan |
| `FABRIX_ASIS_TOBE_RECONCILIATION.md` | Apa yang terbangun vs apa yang **terpakai**, per domain |
| `FABRIX_RELEASE_GATES.md` | Gerbang mana yang lulus, dan apa yang menahan sisanya |
| `FABRIX_BUILD_LIFECYCLE.md` | Bagaimana pekerjaan bergerak — dan di mana dokumennya berbeda dari registri sungguhan |
| `FABRIX_DEFINITION_OF_DONE.md` | Kapan sesuatu boleh disebut selesai |
| `FABRIX_CONSTITUTION.md` | Prinsip yang tidak bisa ditawar + hierarki wewenang |

## Berkas PROSES (tidak menyimpan keadaan, tidak perlu diperbarui berkala)

`FABRIX_AGENT_OPERATING_MODEL.md` · `FABRIX_AGENT_PROTOCOL.md`

## Aturan yang berlaku untuk folder ini

1. **Angka di sini diukur, bukan diingat.** Setiap angka menyertakan saringan yang
   menghasilkannya.
2. **"Terbangun" dan "terpakai" dibedakan selalu.** Sebagian besar sistem ini sudah
   terbangun dan belum pernah dipakai; menyamakan keduanya membuat laporan terdengar jauh
   lebih maju daripada kenyataan.
3. **Kemajuan tidak naik karena kode sudah ditulis.** Yang menaikkannya adalah bukti.
4. **Kontradiksi dicatat, bukan didamaikan diam-diam** — termasuk kontradiksi antar berkas
   di folder ini sendiri.
