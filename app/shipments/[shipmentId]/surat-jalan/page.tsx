import SuratJalanPrintPage from '@/features/mrp/pages/SuratJalanPrintPage';

export default async function Page({ params }: { params: Promise<{ shipmentId: string }> }) {
  const { shipmentId } = await params;
  return <SuratJalanPrintPage shipmentId={Number(shipmentId)} />;
}
