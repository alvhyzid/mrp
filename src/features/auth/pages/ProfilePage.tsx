'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Button, FileUploaderButton, InlineNotification, Modal, SkeletonText, TextInput, Tile } from '@carbon/react';
import { UserAvatar, Pen } from '@carbon/icons-react';
import { getRoleLabel } from '@/lib/glossary';
import { AreaNotifikasi, type Notifikasi } from '@/components/ui/notifikasi';
import { umumkanProfilBerubah } from '@/lib/profilEvents';
import { KepalaHalaman } from '@/components/ui/kepala-halaman';

// PROFIL SAYA — dimigrasikan ke Carbon 26 Agu 2026 (DS-09), cetakan Master Item.
// Pengantarnya BUKAN baris jumlah: halaman ini bukan daftar. Yang ditampilkan adalah
// keterangan singkat tentang apa yang bisa diubah di sini.

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');

  const [name, setName] = useState('');

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  // Foto yang alamatnya rusak jatuh ke ikon bawaan, bukan ke gambar patah.
  const [avatarGagalDimuat, setAvatarGagalDimuat] = useState(false);
  // PRATINJAU: alamat sementara di dalam peramban untuk foto yang BARU DIPILIH dan BELUM
  // tersimpan. Dibedakan dari avatarUrl (yang sudah ada di server) supaya layar bisa jujur
  // berkata "belum tersimpan" alih-alih memberi kesan sudah selesai.
  const [pratinjauUrl, setPratinjauUrl] = useState<string | null>(null);

  const [role, setRole] = useState<string | null>(null);
  // Nilai awal disimpan supaya "ada yang berubah atau tidak" bisa DIHITUNG, bukan ditebak.
  // Tombol simpan yang selalu hidup mengajak orang menyimpan hal yang tidak berubah.
  const [namaAwal, setNamaAwal] = useState('');

  // SATU DAFTAR NOTIFIKASI untuk seluruh halaman. Sebelumnya tiap bagian punya sepasang
  // state sendiri (status + message) dengan tampilan yang ditulis ulang -- tiga salinan cara
  // menampilkan hal yang sama. Sekarang seluruhnya lewat AreaNotifikasi di kanan atas.
  const [notifikasi, setNotifikasi] = useState<Notifikasi[]>([]);
  const beriTahu = useCallback((jenis: Notifikasi['jenis'], judul: string, rincian?: string) => {
    setNotifikasi((lama) => [...lama, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, jenis, judul, rincian }]);
  }, []);
  const tutupNotifikasi = useCallback((id: string) => {
    setNotifikasi((lama) => lama.filter((n) => n.id !== id));
  }, []);

  // Satu modal untuk dua konfirmasi. Menyalin markup modal dua kali berarti dua tempat yang
  // harus ikut berubah setiap kali bentuk konfirmasinya diperbaiki.
  const [konfirmasi, setKonfirmasi] = useState<null | 'identitas' | 'tandaTangan'>(null);
  const [menyimpan, setMenyimpan] = useState(false);

  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  // Pratinjau tanda tangan yang BARU DIPILIH dan belum tersimpan -- dibedakan dari
  // signatureUrl yang sudah ada di server, sama seperti foto profil.
  const [pratinjauTandaTangan, setPratinjauTandaTangan] = useState<string | null>(null);
  const [signatureGagalDimuat, setSignatureGagalDimuat] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [passwordMessage, setPasswordMessage] = useState('');

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!hasSupabaseConfig || !supabase) {
        router.replace('/login');
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        router.replace('/login?redirectTo=/profile');
        return;
      }

      const accessToken = sessionData.session.access_token;
      const response = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await response.json();

      if (!response.ok) {
        // Galat MEMUAT ditampilkan lewat jalur pesan yang sama dengan galat MENYIMPAN.
        // Sebelumnya ia punya state sendiri yang tidak dirender di mana pun setelah kartu
        // "Data akun" dihapus -- galat yang tersimpan tapi tidak pernah terlihat.
  beriTahu('error', 'Gagal memuat profil', data.error || undefined);
        setLoading(false);
        return;
      }

      setName(data.user.name || '');
      setNamaAwal(data.user.name || '');
      setRole(data.user.role || null);
      setEmail(data.user.email || '');
      setAvatarUrl(data.user.avatar_url || null);
      setSignatureUrl(data.user.signature_url || null);
      setLoading(false);
    };

    load();
  }, [router, beriTahu]);

  // ============================================================================
  // SATU ALUR SIMPAN untuk seluruh kartu identitas (foto + nama)
  // ============================================================================
  // Foto TIDAK terkirim saat dipilih; ia hanya dipratinjau. Yang mengirim hanya tombol
  // Simpan di luar kartu -- keputusan pemilik produk, supaya satu tombol menutup seluruh
  // perubahan identitas alih-alih satu tombol per isian.
  const adaPerubahan = name.trim() !== namaAwal.trim() || avatarFile !== null;

  // Pratinjau memakai alamat sementara di dalam peramban. WAJIB dilepas lagi, kalau tidak
  // tiap pemilihan foto meninggalkan satu alamat yang tidak pernah dibebaskan.
  const pilihFoto = (berkas: File | null) => {
    setPratinjauUrl((lama) => {
      if (lama) URL.revokeObjectURL(lama);
      return berkas ? URL.createObjectURL(berkas) : null;
    });
    setAvatarFile(berkas);
  };

  // Pratinjau tanda tangan, pola yang sama persis dengan foto profil.
  const pilihTandaTangan = (berkas: File | null) => {
    setPratinjauTandaTangan((lama) => {
      if (lama) URL.revokeObjectURL(lama);
      return berkas ? URL.createObjectURL(berkas) : null;
    });
    setSignatureFile(berkas);
  };

  const simpanIdentitas = async () => {
    setMenyimpan(true);

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setMenyimpan(false);
      setKonfirmasi(null);
      beriTahu('error', 'Sesi Anda sudah tidak valid', 'Silakan masuk lagi.');
      return;
    }

    // URUTAN DISENGAJA: NAMA DULU, FOTO KEMUDIAN.
    // Bila nama gagal, tidak ada berkas foto yang terlanjur lahir di penyimpanan. Kebalikannya
    // akan meninggalkan foto yatim setiap kali nama ditolak -- dan foto yatim tidak berbunyi.
    let namaTersimpan = false;
    if (name.trim() !== namaAwal.trim()) {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (!res.ok) {
        setMenyimpan(false);
        setKonfirmasi(null);
        beriTahu('error', 'Gagal menyimpan nama', data.error || undefined);
        return;
      }
      namaTersimpan = true;
    }

    let alamatFotoBaru: string | null = null;
    if (avatarFile) {
      const formData = new FormData();
      formData.append('avatar', avatarFile);
      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) {
        setMenyimpan(false);
        setKonfirmasi(null);
        // Disebut APA ADANYA, termasuk bagian yang TERLANJUR tersimpan. Menyembunyikannya
        // membuat orang mengira tidak ada yang berubah, lalu mengulang seluruhnya.
        beriTahu('error', namaTersimpan ? 'Nama tersimpan, foto gagal diunggah' : 'Gagal mengunggah foto', data.error || undefined);
        return;
      }
      alamatFotoBaru = data.avatar_url;
      setAvatarUrl(data.avatar_url);
      setAvatarGagalDimuat(false);
    }

    setNamaAwal(name.trim());
    pilihFoto(null);
    setMenyimpan(false);
    setKonfirmasi(null);
    // NOTIFIKASI, BUKAN MODAL. Modal untuk pesan berhasil menghentikan pekerjaan dan harus
    // ditutup dulu padahal tidak ada keputusan yang perlu diambil. Ini SARAN CARBON, dan
    // pemilik produk mencabut permintaan modalnya sendiri setelah membacanya.
    beriTahu('success', 'Profil berhasil diubah', 'Perubahan Anda sudah tersimpan.');
    // DIUMUMKAN SETELAH server menjawab berhasil, bukan sebelum. Header mendengarkan kabar
    // ini dan memperbarui dirinya tanpa halaman dimuat ulang (MM.1a).
    umumkanProfilBerubah({ avatarUrl: alamatFotoBaru ?? avatarUrl, nama: name.trim() });
  };

  const simpanTandaTangan = async () => {
    if (!signatureFile) return;
    setMenyimpan(true);

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setMenyimpan(false);
      setKonfirmasi(null);
      beriTahu('error', 'Sesi Anda sudah tidak valid', 'Silakan masuk lagi.');
      return;
    }

    const formData = new FormData();
    formData.append('signature', signatureFile);

    const response = await fetch('/api/profile/signature', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData
    });
    const data = await response.json();

    if (!response.ok) {
      setMenyimpan(false);
      setKonfirmasi(null);
      beriTahu('error', 'Gagal mengunggah tanda tangan', data.error || undefined);
      return;
    }

    setSignatureUrl(data.signature_url);
    setSignatureGagalDimuat(false);
    pilihTandaTangan(null);
    setMenyimpan(false);
    setKonfirmasi(null);
    beriTahu('success', 'Tanda tangan berhasil diperbarui', 'Dokumen yang sudah ditandatangani sebelumnya tetap memakai tanda tangan lama.');
  };

  const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordStatus('pending');
    setPasswordMessage('');

    if (newPassword.length < 8) {
      setPasswordStatus('error');
      setPasswordMessage('Kata sandi baru minimal 8 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus('error');
      setPasswordMessage('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    if (!supabase) {
      setPasswordStatus('error');
      setPasswordMessage('Supabase belum dikonfigurasi.');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setPasswordStatus('error');
      setPasswordMessage(error.message);
      return;
    }

    setPasswordStatus('success');
    setPasswordMessage('Kata sandi berhasil diubah.');
    setNewPassword('');
    setConfirmPassword('');
  };

  if (loading) {
    return (
      <div className="halaman">
        <SkeletonText heading width="16rem" />
        <SkeletonText paragraph lineCount={4} />
      </div>
    );
  }

  return (
    <div className="halaman">
      <KepalaHalaman
        remah={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Settings' }, { label: 'My Profile' }]}
        judul="Profil saya"
        pengantar="Foto, nama, tanda tangan digital, dan kata sandi. Jabatan ditetapkan admin perusahaan dan tidak bisa diubah dari sini."
      />
        {/* ====================================================================
            KARTU IDENTITAS — foto, nama, jabatan, dan email dalam SATU kartu,
            dengan SATU tombol simpan DI LUARNYA (keputusan pemilik produk).
            ==================================================================== */}
        <Tile className="profil-kartu">
          <h2 className="halaman__subjudul halaman__subjudul--rapat">Identitas</h2>
            {/* Menumpuk di bawah 672px — breakpoint Carbon, bukan angka pilihan sendiri. */}
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
              {/* FOTONYA SENDIRI ADALAH TOMBOLNYA.
                  FileUploaderButton dipakai, bukan <input type="file"> mentah, supaya Carbon
                  tetap yang mengurus input tersembunyi, aksesibilitas, dan penyaringan format.
                  disableLabelChanges WAJIB: tanpa itu Carbon mengganti isi label jadi nama
                  berkas, dan avatarnya lenyap begitu foto dipilih. */}
              <div className="profil-foto">
                <FileUploaderButton
                  accept={['image/png', 'image/jpeg', 'image/webp']}
                  buttonKind="ghost"
                  disableLabelChanges
                  size="lg"
                  multiple={false}
                  onChange={(event) => {
                    const berkas = (event.target as HTMLInputElement).files?.[0] ?? null;
                    if (berkas) pilihFoto(berkas);
                  }}
                  labelText={
                    <span className="profil-foto__lingkaran">
                      {pratinjauUrl ? (
                        <img src={pratinjauUrl} alt="Pratinjau foto profil yang baru dipilih" className="profil-foto__gambar" />
                      ) : avatarUrl && !avatarGagalDimuat ? (
                        <img
                          src={avatarUrl}
                          alt="Foto profil"
                          className="profil-foto__gambar"
                          onError={() => setAvatarGagalDimuat(true)}
                        />
                      ) : (
                        <UserAvatar size={56} aria-label="Belum ada foto profil" />
                      )}
                    </span>
                  }
                />
                <span className="profil-foto__keterangan">
                  {pratinjauUrl ? 'Foto baru — belum tersimpan' : 'Klik foto untuk mengganti'}
                </span>
              </div>

              <div className="flex w-full flex-col gap-5 md:max-w-md">
                <TextInput
                  id="profil-nama"
                  size="lg"
                  labelText="Nama lengkap"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  invalid={name.trim() === ''}
                  invalidText="Nama tidak boleh kosong."
                />
                {/* readOnly, BUKAN disabled. `disabled` berarti "sedang tidak bisa dipakai";
                    `readOnly` berarti "memang bukan untuk diisi". Keduanya terdengar berbeda
                    di pembaca layar, dan hanya yang kedua yang benar di sini.
                    Jabatan menampilkan PERAN AKSES dan sengaja tidak bisa diubah sendiri —
                    mengubah peran sendiri berarti menaikkan hak akses sendiri. */}
                <TextInput
                  id="profil-jabatan"
                  size="lg"
                  labelText="Jabatan"
                  readOnly
                  value={getRoleLabel(role)}
                  helperText="Ditetapkan admin perusahaan, tidak bisa diubah dari sini."
                />
                <TextInput
                  id="profil-email"
                  size="lg"
                  labelText="Email"
                  readOnly
                  value={email}
                  helperText="Dipakai untuk masuk, jadi tidak bisa diubah dari sini."
                />
              </div>
            </div>
        </Tile>

        {/* TOMBOL SIMPAN DI LUAR KARTU (keputusan pemilik produk), rata KIRI mengikuti aturan
            Carbon untuk form di halaman — bukan form di dalam tile, bukan form di dialog. */}
        {/* Hasilnya muncul sebagai NOTIFIKASI MELAYANG di kanan atas, bukan di sini —
            lihat <AreaNotifikasi> di kaki halaman. */}
        <div className="flex flex-col gap-4">
          <Button type="button" className="profil-tombol" disabled={!adaPerubahan || menyimpan} onClick={() => setKonfirmasi('identitas')}>
            {menyimpan && konfirmasi === 'identitas' ? 'Menyimpan...' : 'Simpan perubahan'}
          </Button>
        </div>

        <Tile className="profil-kartu">
          <h2 className="halaman__subjudul halaman__subjudul--rapat">Tanda Tangan Digital</h2>
            <p className="text-sm text-muted-foreground">Dipakai untuk konfirmasi &amp; tanda tangan dokumen (mis. Surat Jalan). Mengganti tanda tangan TIDAK mengubah dokumen yang sudah ditandatangani sebelumnya — dokumen lama tetap memakai gambar tanda tangan yang berlaku saat itu.</p>
            {/* POLA UNGGAH YANG SAMA PERSIS dengan foto profil: gambarnya sendiri adalah
                tombolnya, dipilih lalu dipratinjau, dan baru terkirim saat tombol simpan
                di luar kartu ditekan. Lihat aturan "Pola Unggah Gambar" di CLAUDE.md. */}
            <div className="profil-foto profil-foto--lebar">
              <FileUploaderButton
                accept={['image/png', 'image/jpeg', 'image/webp']}
                buttonKind="ghost"
                disableLabelChanges
                size="lg"
                multiple={false}
                onChange={(event) => {
                  const berkas = (event.target as HTMLInputElement).files?.[0] ?? null;
                  if (berkas) pilihTandaTangan(berkas);
                }}
                labelText={
                  <span className="profil-foto__lingkaran profil-foto__kotak">
                    {pratinjauTandaTangan ? (
                      <img src={pratinjauTandaTangan} alt="Pratinjau tanda tangan yang baru dipilih" className="profil-foto__gambar profil-foto__gambar--utuh" />
                    ) : signatureUrl && !signatureGagalDimuat ? (
                      <img
                        src={signatureUrl}
                        alt="Tanda tangan digital"
                        className="profil-foto__gambar profil-foto__gambar--utuh"
                        onError={() => setSignatureGagalDimuat(true)}
                      />
                    ) : (
                      <Pen size={40} aria-label="Belum ada tanda tangan" />
                    )}
                  </span>
                }
              />
              <span className="profil-foto__keterangan">
                {pratinjauTandaTangan ? 'Tanda tangan baru — belum tersimpan' : 'Klik untuk mengganti tanda tangan'}
              </span>
            </div>
        </Tile>

        {/* Tombol simpan DI LUAR kartu, sama seperti kartu Identitas. Tanda tangan punya
            tombolnya sendiri karena akibatnya berbeda: ia menentukan gambar yang akan
            tercetak di dokumen berikutnya, bukan sekadar identitas di layar. */}
        <div className="flex flex-col gap-4">
          <Button type="button" className="profil-tombol" disabled={!signatureFile || menyimpan} onClick={() => setKonfirmasi('tandaTangan')}>
            {menyimpan && konfirmasi === 'tandaTangan' ? 'Menyimpan...' : 'Simpan tanda tangan'}
          </Button>
        </div>


        <Tile className="profil-kartu">
          <h2 className="halaman__subjudul halaman__subjudul--rapat">Ganti kata sandi</h2>
            <form onSubmit={handleChangePassword} className="grid gap-4">
              <TextInput
                id="profil-sandi-baru"
                size="lg"
                type="password"
                labelText="Kata sandi baru"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <TextInput
                id="profil-sandi-konfirmasi"
                size="lg"
                type="password"
                labelText="Konfirmasi kata sandi baru"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                invalid={confirmPassword !== '' && confirmPassword !== newPassword}
                invalidText="Konfirmasinya belum sama dengan kata sandi baru."
              />

              {passwordMessage ? (
                <InlineNotification
                  kind={passwordStatus === 'success' ? 'success' : 'error'}
                  lowContrast
                  hideCloseButton
                  title={passwordStatus === 'success' ? 'Berhasil' : 'Gagal'}
                  subtitle={passwordMessage}
                />
              ) : null}

              <Button type="submit" disabled={passwordStatus === 'pending'} className="profil-tombol">
                {passwordStatus === 'pending' ? 'Menyimpan...' : 'Ganti kata sandi'}
              </Button>
            </form>
        </Tile>

      {/* SATU MODAL KONFIRMASI untuk dua tindakan — varian TRANSAKSIONAL: satu keputusan,
          satu aksi. Menyalin markup modal dua kali berarti dua tempat yang harus ikut berubah
          setiap kali bentuk konfirmasinya diperbaiki.

          MODAL BERHASIL DICABUT 25 Agu 2026. Carbon menganjurkan NOTIFIKASI untuk pesan
          berhasil, dan pemilik produk mencabut permintaan modalnya sendiri setelah membacanya:
          "ikuti saran carbon, saya yg salah". Konfirmasi TETAP modal karena di situ memang ada
          keputusan yang harus diambil — bedanya jelas: modal untuk MEMUTUSKAN, notifikasi
          untuk MEMBERI TAHU. */}
      <Modal
        open={konfirmasi !== null}
        size="sm"
        modalHeading={konfirmasi === 'tandaTangan' ? 'Simpan tanda tangan baru?' : 'Simpan perubahan profil?'}
        primaryButtonText={menyimpan ? 'Menyimpan...' : 'Simpan'}
        secondaryButtonText="Batal"
        primaryButtonDisabled={menyimpan}
        onRequestClose={() => (menyimpan ? null : setKonfirmasi(null))}
        onRequestSubmit={() => (konfirmasi === 'tandaTangan' ? simpanTandaTangan() : simpanIdentitas())}
        onSecondarySubmit={() => setKonfirmasi(null)}
      >
        <p>
          {konfirmasi === 'tandaTangan'
            ? 'Tanda tangan baru akan dipakai untuk dokumen berikutnya. Dokumen yang sudah ditandatangani TIDAK berubah.'
            : 'Apakah Anda yakin menyimpan perubahan ini?'}
        </p>
      </Modal>

      <AreaNotifikasi daftar={notifikasi} onTutup={tutupNotifikasi} />
    </div>
  );
}
