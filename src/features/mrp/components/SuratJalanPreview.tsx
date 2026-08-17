'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

// Preview dokumen Surat Jalan — dipakai di Langkah 2 wizard "Buat Pengiriman"
// (ShipmentsPage.tsx, draft belum tersimpan) DAN halaman cetak sungguhan
// (SuratJalanPrintPage.tsx) supaya tata letaknya SAMA PERSIS antara preview dan hasil
// cetak, bukan 2 implementasi berbeda yang bisa melenceng.
export type SuratJalanLine = {
  itemCode: string | null;
  itemName: string | null;
  qty: number;
  uom: string | null;
  lotNumber: string | null;
};

export type SuratJalanPreviewProps = {
  companyName: string;
  companyLogoUrl: string | null;
  shipmentNumber: string | null; // null = belum tersimpan (masih draft di wizard)
  shipmentDate: string; // ISO date
  soNumber: string;
  customerName: string;
  deliveryAddress: string;
  recipientName: string | null;
  vehicleNumber: string | null;
  driverName: string | null;
  lines: SuratJalanLine[];
  signatureImageUrl?: string | null;
  signerName?: string | null;
  signerRole?: string | null;
  // Diisi HANYA kalau shipment sudah punya pod_token (status sudah lewat draft) —
  // di preview wizard (belum tersimpan) selalu null/undefined, QR sengaja tidak
  // tampil sampai halaman /pod/[token] benar-benar berlaku untuk shipment ini.
  podToken?: string | null;
};

const roleLabels: Record<string, string> = {
  warehouse_manager: 'Manager Warehouse',
  warehouse_staff: 'Staf Warehouse',
  ppic_manager: 'Manager PPIC',
  company_admin: 'Admin Perusahaan',
  general_manager: 'General Manager'
};

export default function SuratJalanPreview({
  companyName,
  companyLogoUrl,
  shipmentNumber,
  shipmentDate,
  soNumber,
  customerName,
  deliveryAddress,
  recipientName,
  vehicleNumber,
  driverName,
  lines,
  signatureImageUrl,
  signerName,
  signerRole,
  podToken
}: SuratJalanPreviewProps) {
  const [podQrDataUrl, setPodQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!podToken || typeof window === 'undefined') {
      setPodQrDataUrl(null);
      return;
    }
    const podUrl = `${window.location.origin}/pod/${podToken}`;
    let cancelled = false;
    QRCode.toDataURL(podUrl, { margin: 1, width: 96 })
      .then((dataUrl) => {
        if (!cancelled) setPodQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setPodQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [podToken]);

  return (
    <div className="bg-white text-[13px] text-black">
      <div className="flex items-center justify-between border-b-2 border-black pb-3">
        <div className="flex items-center gap-3">
          {companyLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={companyLogoUrl} alt={companyName} className="h-12 w-12 object-contain" />
          ) : null}
          <div className="font-bold uppercase">{companyName}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold uppercase tracking-wide">Surat Jalan</div>
          <div className="text-xs">{shipmentNumber ?? <span className="italic text-neutral-500">(belum tersimpan — nomor dibuat saat Anda menekan &quot;Buat Pengiriman&quot;)</span>}</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
        <div>
          <span className="text-neutral-500">Tanggal:</span> {new Date(shipmentDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
        </div>
        <div>
          <span className="text-neutral-500">No. Sales Order:</span> {soNumber}
        </div>
        <div>
          <span className="text-neutral-500">Penerima (Client):</span> {customerName}
        </div>
        <div>
          <span className="text-neutral-500">PIC Penerima:</span> {recipientName || '-'}
        </div>
        <div className="col-span-2">
          <span className="text-neutral-500">Alamat Tujuan:</span> {deliveryAddress}
        </div>
        <div>
          <span className="text-neutral-500">Nomor Kendaraan:</span> {vehicleNumber || '-'}
        </div>
        <div>
          <span className="text-neutral-500">Nama Sopir:</span> {driverName || '-'}
        </div>
      </div>

      <table className="mt-4 w-full border-collapse border border-neutral-400 text-xs">
        <thead>
          <tr className="bg-neutral-100">
            <th className="border border-neutral-400 px-2 py-1 text-left">Kode Item</th>
            <th className="border border-neutral-400 px-2 py-1 text-left">Nama Item</th>
            <th className="border border-neutral-400 px-2 py-1 text-right">Qty</th>
            <th className="border border-neutral-400 px-2 py-1 text-left">Satuan</th>
            <th className="border border-neutral-400 px-2 py-1 text-left">No. Lot</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => (
            <tr key={idx}>
              <td className="border border-neutral-400 px-2 py-1">{line.itemCode}</td>
              <td className="border border-neutral-400 px-2 py-1">{line.itemName}</td>
              <td className="border border-neutral-400 px-2 py-1 text-right">{line.qty}</td>
              <td className="border border-neutral-400 px-2 py-1">{line.uom}</td>
              <td className="border border-neutral-400 px-2 py-1">{line.lotNumber}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-8 grid grid-cols-2 gap-6 text-center text-xs">
        <div>
          <div className="mb-1">Pengirim,</div>
          <div className="flex h-20 items-end justify-center">
            {signatureImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={signatureImageUrl} alt="Tanda tangan pengirim" className="max-h-20 object-contain" />
            ) : (
              <span className="italic text-neutral-400">(tanda tangan digital akan ditambahkan saat Anda mencentang &amp; menekan &quot;Buat Pengiriman&quot;)</span>
            )}
          </div>
          <div className="border-t border-black pt-1">
            {signerName || '(...........................)'}
            {signerRole ? <div className="text-neutral-500">{roleLabels[signerRole] ?? signerRole}</div> : null}
          </div>
        </div>
        <div>
          <div className="mb-1">Penerima,</div>
          <div className="flex h-20 flex-col items-center justify-end gap-1">
            {podQrDataUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={podQrDataUrl} alt="QR konfirmasi Bukti Penerimaan" className="h-16 w-16 object-contain" />
                <span className="text-[9px] leading-tight text-neutral-500">Scan untuk konfirmasi penerimaan</span>
              </>
            ) : null}
          </div>
          <div className="border-t border-black pt-1">(...........................)</div>
        </div>
      </div>
    </div>
  );
}
