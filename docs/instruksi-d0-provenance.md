# Instruksi Claude Code — D0: Aturan Provenance untuk Komponen UI (berlaku sekarang)

**Format:** B.0.2 · **Ukuran:** kecil (satu sesi pendek) · **Sumber:** `fitur-drop-ai-spec.md` §3.1 & §5

## 1. TUJUAN
Menetapkan fondasi Drop-AI tanpa membangun fiturnya: setiap komponen UI BARU yang
menampilkan angka membawa identitas datanya, dan aturan ini ditegakkan otomatis —
supaya saat panel asal-usul & Drop-AI dibangun pasca-September, ratusan titik tampilan
tidak perlu ditambal.

## 2. KONTEKS YANG WAJIB DIBACA DULU
- `fitur-drop-ai-spec.md` §3.1 (tipe ProvenanceEnvelope) & §5 (aturan sekarang)
- Komponen penampil nilai yang ADA saat ini (audit ringkas: nama + jumlah titik pakai)

## 3. LANGKAH
1. Definisikan tipe `ProvenanceEnvelope` di satu modul bersama (persis §3.1 spec:
   entity, entityId, field, rawValue string presisi penuh, uom, displayValue,
   parentEntity, basis, derivation{formulaId, inputs}, learnedStandard, screen, capturedAt).
2. Tambahkan prop opsional `provenance?: Partial<ProvenanceEnvelope>` ke komponen
   penampil nilai BERSAMA (sel angka tabel, kartu KPI, badge angka) — komponen menyimpan
   metadata itu sebagai data-attribute/context, TANPA perilaku UI baru apa pun.
3. Pasang pada 3 layar contoh sebagai acuan pola: detail BOM (`qty_per` — kasus 1/51),
   detail batch (yield), kartu margin.
4. Tambahkan aturan ke CLAUDE.md:
   - "Komponen baru yang menampilkan nilai data wajib menerima prop provenance
     (min. entity+entityId+field). Nilai desimal diteruskan sebagai string presisi
     penuh; pembulatan hanya di tampilan. Angka tanpa keterangan basisnya = cacat
     penyajian."
5. Penegakan otomatis: lint rule / check sederhana yang menandai komponen penampil
   angka baru tanpa prop provenance (heuristik: komponen yang merender nilai numerik
   dari props data). Bila lint penuh tidak praktis, minimal checklist PR + grep guard —
   laporkan pilihan & alasannya.

## 4. BATAS
- JANGAN membangun panel, pin, chat, atau UI baru apa pun — ini murni kontrak data.
- JANGAN retrofit massal komponen lama (hanya 3 layar contoh di atas; sisanya aturan pramuka).
- JANGAN mengubah perilaku visual yang ada.

## 5. KRITERIA SELESAI
- [ ] Tipe ada, dipakai di 3 layar contoh, terlihat di React DevTools/data-attribute.
- [ ] Aturan masuk CLAUDE.md.
- [ ] Penegakan otomatis (atau alternatif terlemahnya + alasan) berjalan di CI.
- [ ] Bukti: satu komponen baru TANPA provenance dibuat sengaja → tertangkap penegakan.

## 6. BUKTI (termasuk skenario negatif)
1. Screenshot/dump data-attribute provenance di 3 layar contoh.
2. Skenario negatif 1: komponen pelanggar → CI/lint menandai.
3. Skenario negatif 2: nilai desimal dikirim sebagai number ter-round → tertangkap
   (type check: rawValue harus string).

## 7. STOP CONDITION
Bila audit menemukan komponen penampil nilai bersama TIDAK terpusat (angka dirender ad-hoc
di banyak tempat tanpa komponen bersama), berhenti dan laporkan — keputusan konsolidasi
komponen lebih dulu ada di pemilik produk, jangan lakukan refactor besar diam-diam.
