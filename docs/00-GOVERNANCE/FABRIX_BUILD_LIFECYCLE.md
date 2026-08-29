# FABRIX BUILD LIFECYCLE
## How work moves from idea to production

1. Product requirement / problem statement
2. Domain agent analysis
3. Cross-domain impact check
4. Architecture Guardian review
5. ADR if needed
6. Opus technical design
7. Build task registration
8. Implementation
9. Automated tests
10. Browser/E2E verification
11. Data/security/migration checks
12. Evidence capture
13. Reconciliation with architecture
14. Release certification
15. Post-release smoke/monitoring
16. Documentation update

### No direct Domain Agent → Code path for cross-domain changes.

### Task states
PROPOSED → APPROVED → READY → IN_PROGRESS → VERIFYING → DONE
with BLOCKED / REJECTED / SUPERSEDED as controlled states.

---

# KENYATAAN SIKLUS — 29 Agustus 2026

## Kosakata status task: dokumen ini vs registri yang benar-benar berjalan

Dokumen ini menyebut **PROPOSED → APPROVED → READY → IN_PROGRESS → VERIFYING → DONE**.
Registri sungguhan (`build_tasks`, kekangan `CHECK` di basis data) hanya mengenal **enam**
nilai, dan **bukan yang itu**:

| Registri sungguhan | Jumlah | Padanan di dokumen ini |
|---|---:|---|
| `menunggu` | 175 | APPROVED / READY (**dua-duanya, tidak dibedakan**) |
| `selesai` | 125 | DONE |
| `ditunda_sadar` | 34 | *(tidak ada padanannya)* |
| `menunggu_persetujuan` | 6 | PROPOSED |
| `dibatalkan` | 3 | REJECTED / SUPERSEDED (**digabung**) |
| `sedang_dikerjakan` | 2 | IN_PROGRESS |

**Dua nilai di dokumen ini tidak pernah ada di sistem**: `READY` dan `VERIFYING`.
`VERIFYING` yang hilang bermakna: **tidak ada keadaan "sudah dikerjakan, sedang diverifikasi"** —
task melompat dari dikerjakan langsung ke selesai.

**Keputusan yang dibutuhkan**: menyelaraskan dokumen ini ke registri, atau menambah nilai ke
registri. **Jangan menambahkan nilai enum yang tidak punya pemicu** — di proyek ini itu sudah
jadi cacat berulang (tombol yang tidak melakukan apa-apa, status yang tidak pernah dicapai,
peringatan yang tidak pernah menyala). `VERIFYING` hanya boleh lahir bersama **siapa yang
memindahkannya ke sana dan apa akibatnya**.

## Langkah siklus yang benar-benar dijalankan

Dari 16 langkah, yang **terbukti berjalan** hari ini: pernyataan masalah, analisis domain,
pemeriksaan dampak lintas domain, ADR (baru sejak hari ini), pendaftaran task, implementasi,
test otomatis, verifikasi peramban, pemeriksaan data/keamanan/migrasi, penangkapan bukti,
rekonsiliasi arsitektur, pembaruan dokumentasi.

Yang **belum pernah berjalan**: **sertifikasi rilis** dan **pemantauan pasca-rilis** —
keduanya bagian dari Gerbang 6 & 7 yang belum lulus.
