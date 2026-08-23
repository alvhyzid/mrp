import * as React from "react"

import { cn } from "@/lib/utils"

// Tinggi field: h-10 (40px) = ukuran MEDIUM Carbon Design System (revisi pemilik
// produk 23 Agu 2026 -- modal sebelumnya terasa sempit dengan h-8/32px).
// Catatan jujur: aturan responsive proyek ini menetapkan target sentuh minimal
// 44px, sedangkan Carbon medium 40px. Selisih 4px ini disadari; untuk layar
// sentuh di lantai produksi, PEMBUNGKUS field (label+field+helper) yang jadi
// area sentuh efektif tetap >44px. Bila kelak terbukti sulit ditekan, naikkan
// ke h-11 (44px) -- keputusan itu belum diambil karena belum ada keluhan nyata.

// Carbon Design System text input: sudut tajam, latar terisi abu (field-01),
// garis cuma di bawah (bukan kotak penuh), fokus pakai outline 2px bukan ring
// lembut — pola yang sama dengan yang sudah direview & disetujui di halaman
// login/register, sekarang jadi default di semua pemakaian Input.
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-none border-0 border-b border-input bg-muted px-2.5 py-1 text-sm text-foreground transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
