'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Checkbox,
  FileUploader,
  InlineNotification,
  SkeletonText,
  StructuredListBody,
  StructuredListCell,
  StructuredListHead,
  StructuredListRow,
  StructuredListWrapper,
  TextInput
} from '@carbon/react';
import { CheckmarkFilled } from '@carbon/icons-react';
import { formatNumberId } from '@/lib/currency';
import { LayarPublik } from '@/components/ui/layar-publik';

type ShipmentLine = { item_code: string | null; item_name: string | null; qty: number; uom: string | null };
type ShipmentSummary = { shipment_number: string; shipment_date: string; delivery_address: string; lines: ShipmentLine[] };

const CONFIRMATION_TEXT = 'Barang sudah sesuai jenis dan jumlahnya';

// Halaman PUBLIK, TANPA login sama sekali — diakses client (bukan user sistem) lewat scan QR di
// Surat Jalan fisik. TIDAK ADA pemeriksaan sesi Supabase di sini (beda dari SEMUA halaman lain
// di aplikasi ini yang selalu cek supabase.auth.getSession() dulu) — itu sengaja, bukan lupa.
// Field yang ditampilkan HANYA yang dikembalikan API (/api/pod/[token], sudah dibatasi ketat di
// server — lihat getShipmentByPodToken.ts) — komponen ini TIDAK PERNAH menambah field lain
// sendiri, apalagi apa pun berbau harga/biaya.
//
// Dimigrasikan ke Carbon pada 25 Agu 2026 (DS-02). Layar ini yang paling menentukan di antara
// ketiga layar publik, dan alasannya bukan estetika: ia dibuka di TEPI JALAN, di HP, oleh orang
// yang tidak pernah dilatih memakai sistem ini dan sedang menunggu untuk pergi. Komponen Carbon
// membawa ukuran sentuh, kontras, dan peran ARIA bawaan — hal-hal yang pada versi tulis-tangan
// harus diingat satu per satu, dan sebagian memang terlewat: tabel dan kotak centangnya ditulis
// sebagai elemen HTML mentah.

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
      <LayarPublik judul="Bukti penerimaan barang">
        <SkeletonText paragraph lineCount={5} />
      </LayarPublik>
    );
  }

  if (status === 'invalid') {
    return (
      <LayarPublik judul="Tautan tidak berlaku">
        <InlineNotification
          kind="error"
          title="Tautan tidak berlaku"
          subtitle="Tautan ini sudah tidak berlaku, sudah pernah dipakai, atau salah."
          hideCloseButton
          lowContrast
          className="publik-pemberitahuan"
        />
        <p className="publik-teks">
          Bila Anda merasa ini keliru, silakan hubungi pihak yang mengirimkan barang ini.
        </p>
      </LayarPublik>
    );
  }

  if (status === 'success') {
    return (
      <LayarPublik judul="Terima kasih">
        <InlineNotification
          kind="success"
          title="Sudah tercatat"
          subtitle="Konfirmasi penerimaan barang Anda sudah berhasil dicatat. Halaman ini boleh ditutup."
          hideCloseButton
          lowContrast
          className="publik-pemberitahuan"
        />
      </LayarPublik>
    );
  }

  const tanggal = new Date(shipment!.shipment_date).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  return (
    <LayarPublik judul="Bukti penerimaan barang" pengantar={`Surat jalan ${shipment!.shipment_number} · ${tanggal}`} lebar>
      <dl className="publik-baris-data">
        <dt>Alamat tujuan:</dt>
        <dd>{shipment!.delivery_address}</dd>
      </dl>

      <div className="publik-daftar-barang">
        <StructuredListWrapper isCondensed aria-label="Rincian barang yang dikirim">
          <StructuredListHead>
            <StructuredListRow head>
              <StructuredListCell head>Barang</StructuredListCell>
              <StructuredListCell head>Jumlah</StructuredListCell>
            </StructuredListRow>
          </StructuredListHead>
          <StructuredListBody>
            {shipment!.lines.map((line, idx) => (
              <StructuredListRow key={idx}>
                <StructuredListCell>
                  {line.item_code} — {line.item_name}
                </StructuredListCell>
                <StructuredListCell>
                  {formatNumberId(line.qty, 2)} {line.uom}
                </StructuredListCell>
              </StructuredListRow>
            ))}
          </StructuredListBody>
        </StructuredListWrapper>
      </div>

      <div className="publik-form">
        <div>
          <FileUploader
            // `lg` supaya tombolnya 48px seperti kontrol lain di layar ini. Tanpa ini ia
            // 40px -- dan justru tombol INILAH yang ditekan lebih dulu, di HP, di tepi jalan.
            size="lg"
            labelTitle="Foto barang diterima"
            labelDescription="Wajib. PNG, JPG, atau WEBP, maksimal 5MB."
            buttonLabel="Pilih atau ambil foto"
            accept={['image/png', 'image/jpeg', 'image/webp']}
            filenameStatus={photoFile ? 'edit' : 'uploading'}
            iconDescription="Hapus foto"
            // Carbon mengetikkan event-nya sebagai SyntheticEvent<HTMLElement>, bukan
            // ChangeEvent<HTMLInputElement>, karena FileUploader juga dipicu dari area seret-
            // dan-lepas — bukan hanya dari <input type="file">. Berkasnya diambil dari
            // currentTarget yang memang input itu.
            onChange={(event: React.SyntheticEvent<HTMLElement>) =>
              setPhotoFile((event.currentTarget as HTMLInputElement).files?.[0] ?? null)
            }
            onDelete={() => setPhotoFile(null)}
          />
          {photoPreviewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoPreviewUrl} alt="Pratinjau foto barang yang diterima" className="publik-pratinjau" />
          )}
        </div>

        <TextInput
          size="lg"
          id="nama-penerima"
          labelText="Nama yang menerima"
          helperText="Boleh dikosongkan."
          value={receivedByName}
          onChange={(e) => setReceivedByName(e.target.value)}
        />

        <Checkbox
          id="pernyataan-sesuai"
          labelText={CONFIRMATION_TEXT}
          checked={checked}
          disabled={submitting}
          onChange={(_event: unknown, { checked: nilai }: { checked: boolean }) => setChecked(nilai)}
        />
      </div>

      {submitError && (
        <InlineNotification
          kind="error"
          title="Gagal menyimpan"
          subtitle={submitError}
          onCloseButtonClick={() => setSubmitError('')}
          lowContrast
          className="publik-pemberitahuan"
        />
      )}

      <div className="publik-aksi">
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={!photoFile || !checked || submitting}
          renderIcon={CheckmarkFilled}
        >
          {submitting ? 'Memproses…' : 'Barang sudah diterima'}
        </Button>
      </div>
    </LayarPublik>
  );
}
