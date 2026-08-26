// Halaman cetak surat jalan. CSS Carbon dimuat di sini sendiri karena halaman ini SENGAJA
// berada di luar kerangka aplikasi — ia dokumen, bukan layar aplikasi.
import '@carbon/react/index.scss';
import './surat-jalan.scss';

export default function SuratJalanLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
