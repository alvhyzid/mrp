// Validasi upload gambar dipakai lintas domain (auth avatar/signature, company logo,
// mrp dispatch-photo/POD) — disatukan di sini (src/lib, bukan 1 domain) sesuai aturan
// struktur folder proyek untuk kode infrastruktur bersama.
//
// PENTING: Content-Type yang dikirim client (browser maupun request manual) SEPENUHNYA
// bisa dipalsukan — jangan pernah dipakai sendirian untuk memutuskan format file.
// Selalu sniff byte signature (magic number) asli dari isi file sebagai sumber
// kebenaran, dan turunkan ekstensi + Content-Type yang DISIMPAN dari hasil sniff itu,
// bukan dari klaim client.
export const ALLOWED_IMAGE_MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp'
};

export const EXT_TO_IMAGE_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp'
};

export function detectImageExtFromBytes(buffer: Buffer): string | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

// Dipanggil SEBELUM request.formData() membaca body penuh ke memori — supaya body
// raksasa ditolak cepat, tidak perlu selesai dibuffer dulu baru ketahuan kebesaran.
// maxBytes diberi sedikit slack dari batas ukuran file asli untuk overhead multipart.
export function isContentLengthTooLarge(request: Request, maxFileBytes: number): boolean {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  return contentLength > maxFileBytes + 64 * 1024;
}
