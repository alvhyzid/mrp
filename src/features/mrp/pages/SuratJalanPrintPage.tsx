'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
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
  so_number: string;
  customer_name: string;
  lines: { item_code: string | null; item_name: string | null; item_base_uom: string | null; qty_shipped: number; lot_number: string | null }[];
};

type CompanyInfo = { name: string; logo_url: string | null };

type SignatureInfo = { signature_url_snapshot: string; signer_role_at_signing: string | null; signer_name: string | null } | null;

// Halaman cetak Surat Jalan, diakses dari "Daftar Pengiriman" (ShipmentsPage) via
// tombol "Lihat Surat Jalan". SENGAJA ditaruh DI LUAR grup route (shell) supaya TIDAK
// ikut AppShell (sidebar/header) — halaman ini murni dokumen untuk dicetak/disimpan
// sebagai PDF lewat print dialog browser, bukan bagian dari nav aplikasi.
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
    return <div className="p-10 text-center text-sm text-muted-foreground">Memuat Surat Jalan...</div>;
  }

  if (error || !shipment || !company) {
    return <div className="p-10 text-center text-sm text-destructive">{error || 'Data tidak ditemukan.'}</div>;
  }

  const lines: SuratJalanLine[] = shipment.lines.map((line) => ({
    itemCode: line.item_code,
    itemName: line.item_name,
    qty: line.qty_shipped,
    uom: line.item_base_uom,
    lotNumber: line.lot_number
  }));

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex justify-end gap-2 print:hidden">
        <Button variant="outline" onClick={() => window.close()}>
          Tutup
        </Button>
        <Button onClick={() => window.print()}>Cetak / Simpan sebagai PDF</Button>
      </div>
      <div className="rounded-md border p-6 shadow-sm print:border-0 print:p-0 print:shadow-none">
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
          signatureImageUrl={signature?.signature_url_snapshot ?? null}
          signerName={signature?.signer_name ?? null}
          signerRole={signature?.signer_role_at_signing ?? null}
        />
      </div>
    </div>
  );
}
