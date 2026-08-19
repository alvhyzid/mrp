-- Koreksi Bagian F (Kesiapan AI Tenant): laporan sesi sebelumnya KELIRU menyatakan
-- "tidak ada tabel downtime di skema" utk metric_key quality.downtime_classified
-- (§1.5 spesifikasi-kesiapan-ai-tenant.md). production_disruptions SUDAH ADA sejak
-- migration 20260812154000 (fitur catat gangguan produksi, 5 kategori termasuk
-- 'other' sbg keranjang serba-guna) dgn data nyata (5 baris company_id=1, semua
-- utility_outage) -- metric_key ini SEHARUSNYA bisa dihitung, dan sekarang bisa
-- (lihat computeMetric.ts). Ditambahkan sbg prasyarat TIDAK MENGUNCI (is_blocking
-- false) pada kemampuan anomaly_detection -- §1.5 minta ini "bagian dari skor
-- kesiapan", bukan gerbang keras (data downtime yang sedikit tapi benar
-- diklasifikasi semua tetap skor tinggi, bukan mengunci kemampuan karena volume
-- rendah).

insert into ai_capability_requirements (capability_id, code, label, metric_key, threshold, comparator, weight, is_blocking, sort_order)
select c.ai_capability_id, 'quality_downtime', 'Downtime terklasifikasi (bukan "other", %)', 'quality.downtime_classified', 80, 'GTE', 20, false, 1
from ai_capabilities c
where c.code = 'anomaly_detection'
on conflict (capability_id, code) do nothing;
