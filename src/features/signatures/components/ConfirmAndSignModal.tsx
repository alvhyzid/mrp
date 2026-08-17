'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// Komponen GENERIK dipakai ulang lintas jenis dokumen (Sesi 1, rencana-kerja-playbook-ams.md
// — mulai dipakai nyata di Shipments/Surat Jalan Sesi 2). Murni "UI shell" konfirmasi +
// tanda tangan: preview + checkbox + tombol Process/Cancel, TIDAK menyimpan apa pun ke
// database sendiri.
//
// PENYIMPANGAN SENGAJA dari deskripsi awal ("saat Process diklik: rekam ke
// document_signatures ... lalu panggil onConfirm"): kalau modal ini sendiri yang insert ke
// document_signatures (lewat endpoint generik), lalu memanggil onConfirm TERPISAH untuk aksi
// dokumennya (mis. ubah status shipment), itu 2 request/transaksi TERPISAH — persis yang
// TIDAK BOLEH terjadi menurut requirement Sesi 2 ("tanda tangan + transisi status HARUS 1
// transaksi, jangan sampai satu berhasil satu gagal"). Jadi di sini `onConfirm` SEPENUHNYA
// dikendalikan pemanggil — pemanggil yang memutuskan CARA menyimpan (utk kasus sederhana:
// panggil endpoint generik recordDocumentSignature; utk kasus butuh atomik: panggil 1 RPC
// gabungan yang insert document_signatures DAN transisi status dalam 1 transaksi database).
// Modal ini cuma menjamin: checkbox harus dicentang dulu sebelum Process bisa diklik, dan
// Cancel/Edit tidak pernah memanggil onConfirm sama sekali (tidak ada efek samping apa pun).
export type ConfirmAndSignModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  confirmationText: string;
  onConfirm: () => Promise<void>;
  children: React.ReactNode;
  // Opsional — default "Cancel/Edit"/"Process" tetap sama seperti sebelumnya (tidak
  // mengubah pemanggil lama). Dibutuhkan Sesi 2 (wizard Shipments): langkah 2 wizard
  // butuh label "Kembali"/"Buat Pengiriman", BUKAN "Cancel/Edit" generik — perilaku
  // "Kembali"-nya (balik ke langkah 1, data tetap ada, bukan tutup total) sepenuhnya
  // ditentukan pemanggil lewat `onOpenChange`, komponen ini cuma soal LABEL tombolnya.
  cancelLabel?: string;
  confirmLabel?: string;
};

export default function ConfirmAndSignModal({
  open,
  onOpenChange,
  title,
  confirmationText,
  onConfirm,
  children,
  cancelLabel = 'Cancel/Edit',
  confirmLabel = 'Process'
}: ConfirmAndSignModalProps) {
  const [checked, setChecked] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (open) {
      setChecked(false);
      setProcessing(false);
      setErrorMessage('');
    }
  }, [open]);

  const handleProcess = async () => {
    setProcessing(true);
    setErrorMessage('');
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = () => {
    if (processing) return;
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? handleCancel() : onOpenChange(next))}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Periksa ringkasan di bawah sebelum melanjutkan — tindakan ini akan tercatat dengan tanda tangan digital Anda.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] overflow-y-auto rounded-md border p-4">{children}</div>

        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={checked} onChange={(event) => setChecked(event.target.checked)} disabled={processing} />
          <span>{confirmationText}</span>
        </label>

        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleCancel} disabled={processing}>
            {cancelLabel}
          </Button>
          <Button type="button" onClick={handleProcess} disabled={!checked || processing}>
            {processing ? 'Memproses...' : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
