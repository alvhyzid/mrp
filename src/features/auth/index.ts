export { default as HomePage } from './pages/HomePage';
export { default as LoginPage } from './pages/LoginPage';
export { default as RegisterPage } from './pages/RegisterPage';
export { default as DashboardPage } from './pages/DashboardPage';
export { default as DebugPage } from './pages/DebugPage';
export { default as TestTenantPage } from './pages/TestTenantPage';
export { default as InviteAcceptPage } from './pages/InviteAcceptPage';
export { default as ProfilePage } from './pages/ProfilePage';
export { default as ForgotPasswordPage } from './pages/ForgotPasswordPage';
export { default as ResetPasswordPage } from './pages/ResetPasswordPage';
// AppShell lama DIHAPUS di DS-04 (25 Agu 2026), diganti AppShellCarbon di
// src/features/navigasi/. Dihapus, bukan disisakan: kerangka lama yang masih bisa diimpor
// adalah jalur kedua yang hidup, dan jalur kedua tidak ikut berubah saat yang pertama
// diperbaiki -- kelas cacat yang sudah menggigit berkali-kali di proyek ini.
// Penggantinya sudah dibuktikan lebih dulu: 29 dari 29 halaman terbuka utuh di peramban.
export * from './server';
