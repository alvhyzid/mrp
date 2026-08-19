// Jarak haversine (meter) -- dipakai menentukan DALAM/LUAR geofence plant
// (docs/rancangan-absensi-geo-qr.md §2.3). Presisi cukup utk radius ratusan
// meter, tidak butuh library eksternal.
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export interface PlantGeofence {
  center_lat: number | null;
  center_lng: number | null;
  geofence_radius_meters: number;
}

// Lokasi hanya direkam pada momen scan (§2.3, "bukan pelacakan") -- fungsi ini
// murni menghitung status geofence utk SATU titik, tidak menyimpan riwayat.
export function evaluateGeofence(plant: PlantGeofence | null, lat: number | null, lng: number | null): 'DALAM' | 'LUAR' | 'TANPA_GPS' {
  if (lat == null || lng == null) return 'TANPA_GPS';
  if (!plant || plant.center_lat == null || plant.center_lng == null) return 'TANPA_GPS';
  const distance = haversineMeters(lat, lng, plant.center_lat, plant.center_lng);
  return distance <= plant.geofence_radius_meters ? 'DALAM' : 'LUAR';
}
