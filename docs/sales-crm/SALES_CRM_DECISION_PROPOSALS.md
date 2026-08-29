# SALES_CRM_DECISION_PROPOSALS

**Tanggal:** 29 Agustus 2026 · **Menjawab:** §14–§19 perintah eksekusi
**Sifat berkas ini: USULAN. Tidak satu pun diimplementasikan.**

---


> **BERKAS INI KINI HANYA INDEKS.** Isi tiap usulan dipindahkan ke berkasnya sendiri pada
> 29 Agu 2026 (§30 perintah eksekusi). Yang tersisa di sini hanyalah usulan yang belum
> punya berkas bernama sendiri.

| Keputusan | Berkas |
|---|---|
| **AD-03** — nama status Sales Order | `AD-03_ARCHITECTURE_PROPOSAL.md` |
| **BD-09** — toleransi kurang-kirim | `BD-09_UNDER_SHIPMENT_DECISION.md` |
| **BD-10** — pembayaran terpenuhi | `BD-10_PAYMENT_COMPLETION_DECISION.md` |
| **Peran Sales** | `SALES_ROLE_DECISION.md` |
| **Override** | `OVERRIDE_DECISION_NOTE.md` |
| **INF-28** — pencadangan & pemulihan | `INF-28_BACKUP_RESTORE_RECONCILIATION.md` |

# Permintaan pembatalan (§18)

## Keadaan
Wewenang **akhir** sudah ada dan terbukti (Manager/GM). Yang belum ada: jalur **pengajuan**
oleh Sales.

## Yang dibutuhkan
Entitas permintaan pembatalan: pengusul · alasan (kategori + catatan, memakai katalog yang
sudah ada) · peninjau · hasil · jejak. Untuk order yang eksekusinya sudah berjalan,
ditambah **tinjauan dampak** oleh departemen terdampak.

## Kesiapan
Fondasinya **sudah ada dan terbukti**: katalog kategori alasan, `pasang_konteks_keputusan()`,
kolom jejak, pola RPC ber-konteks. Yang benar-benar baru hanyalah entitas permintaannya.

## Penghalang
**Peran Sales (§17) belum jelas.** "Sales mengajukan" tidak bisa ditegakkan bila tidak ada
peran yang mewakilinya. **Diblokir oleh keputusan Peran Sales, bukan oleh arsitektur.**
