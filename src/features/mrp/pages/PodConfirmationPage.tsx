'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type ShipmentLine = { item_code: string | null; item_name: string | null; qty: number; uom: string | null };
type ShipmentSummary = { shipment_number: string; shipment_date: string; delivery_address: string; lines: ShipmentLine[] };

const CONFIRMATION_TEXT = 'Barang sudah sesuai jenis dan jumlahnya';

// Halaman PUBLIK, TANPA login sama sekali — diakses client (bukan user sistem) lewat
// scan QR di Surat Jalan fisik. TIDAK ADA pemeriksaan sesi Supabase di sini (beda dari
// SEMUA halaman lain di aplikasi ini yang selalu cek supabase.auth.getSession() dulu)
// — itu sengaja, bukan lupa. Field yang ditampilkan HANYA yang dikembalikan API
// (/api/pod/[token], sudah dibatasi ketat di server — lihat getShipmentByPodToken.ts)
// — komponen ini TIDAK PERNAH menambah field lain sendiri, apalagi apa pun berbau
// harga/biaya.
export default function PodConfirmationPage({ token }: { token: string }) {
  const [status, setStatus] = useState<'loading' | 'invalid' | 'valid' | 'success'>('loading');
  const [shipment, setShipment] = useState<ShipmentSummary | null>(null);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [receivedByName, setReceivedByName] = useState('');
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    const load = async () => {
      const response = await fetch(`/api/pod/${encodeURIComponent(token)}`);
      const body = await response.json();
      if (!response.ok || !body.valid) {
        setStatus('invalid');
        return;
      }
      setShipment(body);
      setStatus('valid');
    };
    load();
  }, [token]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  const handleSubmit = async () => {
    if (!photoFile || !checked) return;
    setSubmitting(true);
    setSubmitError('');

    const formData = new FormData();
    formData.append('photo', photoFile);
    if (receivedByName.trim()) formData.append('received_by_name', receivedByName.trim());

    const response = await fetch(`/api/pod/${encodeURIComponent(token)}/confirm`, { method: 'POST', body: formData });
    const body = await response.json();

    if (!response.ok) {
      setSubmitting(false);
      setSubmitError(body.error || 'Terjadi kesalahan. Silakan coba lagi.');
      return;
    }

    setSubmitting(false);
    setStatus('success');
  };

  if (status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <p className="text-sm text-muted-foreground">Memuat...</p>
      </main>
    );
  }

  if (status === 'invalid') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl">Link Tidak Valid</CardTitle>
            <CardDescription>Link ini sudah tidak berlaku, sudah pernah dipakai, atau salah.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Kalau Anda merasa ini keliru, silakan hubungi pihak yang mengirimkan barang ini.</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (status === 'success') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl">Terima Kasih</CardTitle>
            <CardDescription>Konfirmasi penerimaan barang Anda sudah berhasil dicatat.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardDescription className="uppercase tracking-[0.2em]">Bukti Penerimaan Barang</CardDescription>
          <CardTitle className="text-xl">{shipment!.shipment_number}</CardTitle>
          <CardDescription>{new Date(shipment!.shipment_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="text-sm">
            <span className="text-muted-foreground">Alamat Tujuan:</span> {shipment!.delivery_address}
          </div>

          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-3 py-1.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Item</th>
                  <th className="px-3 py-1.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Qty</th>
                </tr>
              </thead>
              <tbody>
                {shipment!.lines.map((line, idx) => (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="px-3 py-1.5">
                      {line.item_code} — {line.item_name}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {line.qty} {line.uom}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="my-1 border-t" />

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Foto Barang Diterima (wajib)</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
              className="text-sm text-foreground file:mr-3 file:h-8 file:rounded-none file:border-0 file:bg-[#0f62fe] file:px-3 file:text-xs file:font-medium file:text-white hover:file:bg-[#0043ce]"
            />
            <span className="text-xs text-muted-foreground">PNG, JPG, atau WEBP, maksimal 5MB.</span>
          </label>
          {photoPreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoPreviewUrl} alt="Preview foto barang diterima" className="h-40 w-fit rounded-md border object-contain" />
          ) : null}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Nama yang Menerima (opsional)</span>
            <Input value={receivedByName} onChange={(e) => setReceivedByName(e.target.value)} />
          </label>

          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={checked} onChange={(event) => setChecked(event.target.checked)} disabled={submitting} />
            <span className="text-sm">{CONFIRMATION_TEXT}</span>
          </label>

          {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

          <Button onClick={handleSubmit} disabled={!photoFile || !checked || submitting}>
            {submitting ? 'Memproses...' : 'Barang Sudah Diterima'}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
