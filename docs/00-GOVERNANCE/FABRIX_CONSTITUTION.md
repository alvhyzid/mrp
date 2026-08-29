# FABRIX CONSTITUTION
## System-wide Architecture & Product Governance
**Status:** Proposed Canonical Governance
**Owner:** FABRIX Architecture Guardian / Product Owner

### 1. Mission
FABRIX is a manufacturing operating system for end-to-end factory operations:
Commercial → Planning → Supply → Manufacturing → Quality → Inventory → Delivery → Finance → After Sales.

### 2. Non-negotiable principles
1. Business requirements outrank implementation convenience.
2. UX, business domain, and technical architecture are separate layers.
3. Every authoritative business concern has one source-of-truth owner.
4. Domains may consume another domain's data, but must not silently mutate its authoritative state.
5. Existing implementation is evidence, not automatically the target architecture.
6. Architecture decisions must be recorded; decisions must not live only in chat.
7. No major implementation without AS-IS → TO-BE reconciliation where existing behavior is affected.
8. No critical release without required test evidence.
9. AI recommends/assists; consequential actions remain governed by authorization and audit.
10. Prefer modular-monolith/domain boundaries unless evidence justifies service extraction.

### 3. Authority hierarchy
1. Product Owner confirmed decisions
2. FABRIX Constitution / canonical governance
3. Approved architecture baselines
4. Approved ADRs
5. Current build/task registry
6. Current running implementation as AS-IS evidence
7. Individual agent proposals
8. Developer preference

If two canonical sources conflict, STOP and create an ADR/decision request.

### 4. Agent roles
- Architecture Guardian: cross-domain authority and IA guardian.
- Domain Agent: deep specialist for one segment.
- UX Agent/Guardian: cross-product UX and Carbon consistency.
- Opus/Technical Architect: converts approved business architecture into technical design.
- Code Agent: implementation, migration, tests, evidence.
- QA/Release Agent: verification and certification.

### 5. Definition of done
A change is complete only when architecture, implementation, data, security, UX, tests, evidence, and documentation are reconciled as applicable.

### 6. Change rule
Agents may propose. Only the Product Owner or designated Architecture Guardian may approve cross-domain architectural changes.

---

# CATATAN KEADAAN — 29 Agustus 2026

## Status berkas ini masih "Proposed"

Judulnya menyatakan **Proposed Canonical Governance**. Ia **belum dikonfirmasi** pemilik
produk sebagai tata kelola kanonik. Sampai dikonfirmasi, ia **belum mengikat** — dan
karenanya tidak dipakai untuk menolak pekerjaan.

## Kontradiksi yang wajib diselesaikan pemilik produk

Hierarki wewenang di §3 **tidak menyebut `CLAUDE.md`**, padahal `CLAUDE.md`-lah yang
**dibaca setiap sesi** dan memuat aturan yang benar-benar mengikat pekerjaan sehari-hari:
penggolongan biaya, aturan modal & form, aturan responsive, aturan navigasi, larangan
sistem izin paralel, dan gerbang rencana Carbon.

Dua kemungkinan, dan keduanya harus dipilih **secara sadar**:
1. `CLAUDE.md` adalah wujud nyata dari "canonical governance" di §3 butir 2 — maka berkas
   ini menyebutnya begitu.
2. Keduanya berdiri sendiri — maka **dua sumber aturan** hidup berdampingan, dan itu persis
   kelas cacat "dua jalur hidup" yang sudah menggigit proyek ini berkali-kali.

**Sesuai §3 kalimat terakhir — bila dua sumber kanonik bertentangan, BERHENTI dan buat
permintaan keputusan — kontradiksi ini dicatat, bukan didamaikan diam-diam.**
