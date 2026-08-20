-- Bagian A (26 Agu 2026): cabut target 35% GPM dari KPI Margin Kontribusi % --
-- keputusan pemilik produk: 35% adalah angka dari KONTEKS SIMULASI PO lama (Gummy
-- Zala/Drinkme), bukan kebijakan yang berlaku untuk studi kasus baru (MLVT). Seed
-- (seedKpiRegistry.ts) sudah diperbarui untuk company BARU, tapi baris yang SUDAH
-- ada (company_id=1, diseed 25 Agu 2026) perlu dikoreksi langsung -- seed pakai
-- ignoreDuplicates:true, tidak akan menimpa baris yang sudah ada.

update kpi_registry
set target_value = null, target_set_at = null, benchmark_label = null, benchmark_source = null
where metric_key = 'metric.margin_kontribusi_persen' and target_value = 35;
