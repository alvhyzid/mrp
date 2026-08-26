'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Button, InlineNotification, SkeletonText } from '@carbon/react';
import { Printer, Close } from '@carbon/icons-react';
import SuratJalanPreview, { type SuratJalanLine } from '../components/SuratJalanPreview';

type ShipmentDetail = {
  shipment_id: number;
  shipment_number: string;
  shipment_date: string;
  status: string;
  delivery_address: string;
  recipient_name: string | null;
  vehicle_number: string | null;
  driver_name: string | null;
  pod_token: string | null;
  so_number: string;
  customer_name: string;
  lines: { item_code: string | null; item_name: string | null; item_base_uom: string | null; qty_shipped: number; lot_number: string | null }[];
};

type CompanyInfo = { name: string; logo_url: string | null };

type SignatureInfo = { signature_url_snapshot: string; signer_role_at_signing: string | null; signer_name: string | null } | null;

// Halaman cetak Surat Jalan, diakses dari "Daftar Pengiriman" lewat tautan
// "Lihat / cetak surat jalan". SENGAJA ditaruh DI LUAR grup route (shell) supaya TIDAK
// ikut kerangka aplikasi (menu samping/header) — halaman ini murni dokumen untuk dicetak
// atau disimpan sebagai PDF lewat dialog cetak peramban, bukan bagian dari navigasi.
//
// KENAPA TIDAK MENGIKUTI CETAKAN HALAMAN (remah roti + judul + baris jumlah), 26 Agu 2026:
// cetakan itu untuk LAYAR — remah roti menunjukkan posisi di dalam aplikasi, dan baris
// jumlah menerangkan sebuah daftar. Di atas KERTAS keduanya tidak berarti apa-apa: yang
// memegang surat jalan tidak sedang menjelajah aplikasi. Yang diambil dari Carbon di sini
// hanya KOMPONENNYA (tombol, pemberitahuan, rangka pemuatan), bukan anatominya.
//
// Yang dicetak sendiri (SuratJalanPreview) TIDAK disentuh migrasi ini: ia dokumen resmi
// yang bentuknya sudah disepakati, dan mengubah tata letaknya berarti mengubah dokumen
// yang beredar di luar sistem.
export default function SuratJalanPrintPage({ shipmentId }: { shipmentId: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [signature, setSignature] = useState<SignatureInfo>(null);

  useEffect(() => {
    const load = async () => {
      if (!hasSupabaseConfig || !supabase) {
        setError('Supabase belum dikonfigurasi.');
        setLoading(false);
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        router.replace(`/login?redirectTo=/shipments/${shipmentId}/surat-jalan`);
        return;
      }
      const response = await fetch(`/api/shipments/${shipmentId}`, { headers: { Authorization: `Bearer ${sessionData.session.access_token}` } });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error || 'Gagal memuat data Surat Jalan.');
        setLoading(false);
        return;
      }
      setShipment(body.shipment);
      setCompany(body.company);
      setSignature(body.signature);
      setLoading(false);
    };
    load();
  }, [router, shipmentId]);

  if (loading) {
    return (
      <div className="surat-jalan-halaman">
        <SkeletonText heading width="18rem" />
        <SkeletonText paragraph lineCount={6} />
      </div>
    );
  }

  if (error || !shipment || !company) {
    return (
      <div className="surat-jalan-halaman">
        <InlineNotification kind="error" lowContrast hideCloseButton title="Surat jalan tidak bisa ditampilkan" subtitle={error || 'Data tidak ditemukan.'} />
      </div>
    );
  }

  const lines: SuratJalanLine[] = shipment.lines.map((line) => ({
    itemCode: line.item_code,
    itemName: line.item_name,
    qty: line.qty_shipped,
    uom: line.item_base_uom,
    lotNumber: line.lot_number
  }));

  return (
    <div className="surat-jalan-halaman">
      <div className="surat-jalan-alat">
        <Button kind="tertiary" renderIcon={Close} onClick={() => window.close()}>
          Tutup
        </Button>
        <Button renderIcon={Printer} onClick={() => window.print()}>
          Cetak / simpan sebagai PDF
        </Button>
      </div>
      <div className="surat-jalan-kertas">
        <SuratJalanPreview
          companyName={company.name}
          companyLogoUrl={company.logo_url}
          shipmentNumber={shipment.shipment_number}
          shipmentDate={shipment.shipment_date}
          soNumber={shipment.so_number}
          customerName={shipment.customer_name}
          deliveryAddress={shipment.delivery_address}
          recipientName={shipment.recipient_name}
          vehicleNumber={shipment.vehicle_number}
          driverName={shipment.driver_name}
          lines={lines}
          podToken={shipment.pod_token}
          signatureImageUrl={signature?.signature_url_snapshot ?? null}
          signerName={signature?.signer_name ?? null}
          signerRole={signature?.signer_role_at_signing ?? null}
        />
      </div>
    </div>
  );
}
