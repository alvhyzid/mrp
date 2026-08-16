'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Notification, NotificationOff } from '@carbon/icons-react';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { isCompanyLeadership, getDepartmentForRole } from '@/lib/roles';
import { Badge } from '@/components/ui/badge';

type Alert = {
  system_alert_id: number;
  alert_type: string;
  target_department: string | null;
  related_work_order_id: number | null;
  related_po_id: number | null;
  related_item_id: number | null;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  status: string;
  created_at: string;
};

const severityBadgeVariant: Record<string, 'info' | 'warning' | 'critical'> = { info: 'info', warning: 'warning', critical: 'critical' };
const severityLabels: Record<string, string> = { info: 'Info', warning: 'Perhatian', critical: 'Kritis' };

// Navigasi setelah klik 1 alert — diarahkan ke halaman kerja yang paling relevan
// dengan alert_type-nya, bukan cuma ditandai acknowledged tanpa arah.
function alertTargetUrl(alert: Alert): string {
  if (alert.related_work_order_id) return '/work-orders';
  if (alert.alert_type === 'po_delayed') return '/purchasing';
  if (alert.alert_type === 'po_needs_approval') return '/customer-purchase-orders';
  if (['stock_depletion_forecast', 'expiry_risk_low_usage', 'low_stock'].includes(alert.alert_type)) return '/items';
  return '/dashboard';
}

const MUTE_STORAGE_KEY = 'mrp_notification_muted';

function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioContextClass();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.35);
    oscillator.onended = () => ctx.close();
  } catch {
    // Web Audio API tidak tersedia — bukan fitur kritis, abaikan saja.
  }
}

// Dipakai dua tempat: filter list awal (server, lewat scope=my_department) DAN
// filter event realtime yang baru masuk (client, karena RLS cuma membatasi per
// company_id, department disaring di sini) — logikanya HARUS identik dengan
// scope=my_department di listSystemAlerts.ts.
function isRelevantForRole(alert: { target_department: string | null }, role: string | null): boolean {
  if (isCompanyLeadership(role)) return true;
  if (alert.target_department === null) return true;
  return alert.target_department === getDepartmentForRole(role);
}

export default function NotificationBell({ role, companyId }: { role: string | null; companyId: number | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [muted, setMuted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMuted(window.localStorage.getItem(MUTE_STORAGE_KEY) === '1');
  }, []);

  const toggleMute = () => {
    setMuted((prev) => {
      const next = !prev;
      window.localStorage.setItem(MUTE_STORAGE_KEY, next ? '1' : '0');
      return next;
    });
  };

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }, []);

  const loadAlerts = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    setLoading(true);
    const response = await fetch('/api/system-alerts?scope=my_department&status=open', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (response.ok) {
      const body = await response.json();
      setAlerts(body.alerts || []);
    }
    setLoading(false);
  }, [getAccessToken]);

  useEffect(() => {
    if (!role) return;
    loadAlerts();
  }, [role, loadAlerts]);

  // Realtime: begitu ada system_alerts baru untuk company ini, badge naik OTOMATIS
  // tanpa reload halaman. RLS system_alerts_select_for_company sudah membatasi
  // event yang diterima cuma untuk company_id sendiri; penyaringan department
  // dilakukan di sini (client), sama seperti fetch awal.
  useEffect(() => {
    if (!supabase || !hasSupabaseConfig || !companyId || !role) return;

    const channel = supabase
      .channel(`system-alerts-company-${companyId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'system_alerts', filter: `company_id=eq.${companyId}` },
        (payload) => {
          const newAlert = payload.new as Alert;
          if (newAlert.status !== 'open' || !isRelevantForRole(newAlert, role)) return;
          setAlerts((prev) => [newAlert, ...prev]);
          if (window.localStorage.getItem(MUTE_STORAGE_KEY) !== '1') {
            playNotificationSound();
          }
        }
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [companyId, role]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAcknowledge = async (alert: Alert) => {
    const accessToken = await getAccessToken();
    setAlerts((prev) => prev.filter((a) => a.system_alert_id !== alert.system_alert_id));
    setOpen(false);
    router.push(alertTargetUrl(alert));
    if (!accessToken) return;
    await fetch('/api/system-alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ system_alert_id: alert.system_alert_id })
    });
  };

  if (!role) return null;

  const openCount = alerts.length;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex h-8 w-8 items-center justify-center rounded-none text-[#525252] transition-colors hover:bg-[rgba(141,141,141,0.12)]"
        aria-label="Notifikasi"
      >
        <Notification size={20} />
        {openCount > 0 ? (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
            {openCount > 99 ? '99+' : openCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-10 z-50 flex max-h-[28rem] w-96 flex-col overflow-hidden border border-[#c6c6c6] bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-[#e0e0e0] px-3 py-2">
            <span className="text-sm font-semibold text-[#161616]">Notifikasi</span>
            <button
              type="button"
              onClick={toggleMute}
              className="flex items-center gap-1 text-xs text-[#525252] hover:text-[#161616]"
              title={muted ? 'Bunyikan notifikasi' : 'Bisukan notifikasi'}
            >
              {muted ? <NotificationOff size={16} /> : <Notification size={16} />}
              {muted ? 'Dibisukan' : 'Aktif'}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="p-4 text-center text-xs text-[#8d8d8d]">Memuat...</p>
            ) : alerts.length === 0 ? (
              <p className="p-4 text-center text-xs text-[#8d8d8d]">Tidak ada notifikasi terbuka.</p>
            ) : (
              <ul className="divide-y divide-[#e0e0e0]">
                {alerts.map((alert) => (
                  <li key={alert.system_alert_id}>
                    <button
                      type="button"
                      onClick={() => handleAcknowledge(alert)}
                      className="flex w-full flex-col gap-1 px-3 py-2.5 text-left hover:bg-[rgba(141,141,141,0.08)]"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant={severityBadgeVariant[alert.severity] ?? 'info'}>{severityLabels[alert.severity] ?? alert.severity}</Badge>
                        <span className="text-[11px] text-[#8d8d8d]">{new Date(alert.created_at).toLocaleString('id-ID')}</span>
                      </div>
                      <span className="text-xs text-[#161616]">{alert.message}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
