> **CATATAN KEPALA (ditambahkan Claude Code, 22 Agu 2026, sesuai instruksi P.1):** Berkas ini adalah benchmark FUNGSIONAL berdasarkan fitur PUBLIK Mekari Talenta — BUKAN untuk menyalin kode, tampilan (UI), nama modul, atau aset visual Talenta. Implementasi modul HR/HCM di proyek ini WAJIB memakai model data, UX, dan algoritma milik proyek sendiri. Diunggah pemilik produk ke sesi arsitek (bukan susunan arsitek) — disimpan apa adanya di sini sebagai referensi, dipakai untuk mencatat task di Daftar Tugas Pembangunan (modul HR/PLT), bukan dikerjakan langsung.

# TALENTA-INSPIRED HCM / HRIS --- PRODUCT REVERSE ENGINEERING & CLAUDE CODE BUILD SPECIFICATION

**Document version:** 1.0\
**Date:** 21 August 2026\
**Purpose:** Blueprint untuk membangun HCM/HRIS SaaS yang secara
fungsional membenchmark Mekari Talenta, tetapi dengan arsitektur
modular, workflow engine, payroll/rule engine, API-first architecture,
dan AI-native capabilities.

> **Important product/legal boundary**
>
> Dokumen ini adalah functional/product reverse-engineering berdasarkan
> fitur publik Mekari Talenta dan dokumentasi publiknya. Tujuannya
> adalah membangun sistem dengan **kapabilitas bisnis yang setara atau
> lebih baik**, bukan menyalin source code, proprietary algorithms,
> desain UI, trademark, copywriting, database proprietary, atau aset
> visual Talenta. Implementasi harus menggunakan code, UX, nama modul,
> model data, dan algoritma milik proyek sendiri.

------------------------------------------------------------------------

# 1. EXECUTIVE SUMMARY

Mekari Talenta saat ini memposisikan dirinya sebagai HCM terintegrasi
dengan tujuh kelompok besar:

1.  Attendance Management
2.  Payroll, Compensation & Benefit
3.  Administration HR
4.  Talent Acquisition
5.  Talent Development
6.  AI & Analytics
7.  Integration

Fitur publiknya mencakup online attendance, timesheet, Talenta Portal,
liveness validation, overtime, shift, leave, live tracking, payroll
calculation, payroll reports, payroll disbursement, payslip,
reimbursement, expense, employee benefits, e-Bupot/Coretax,
recruitment/ATS, assessment, manpower planning, performance management,
talent management, LMS, HR analytics, AI chatbot, AI performance review,
resignation prediction, AI candidate scoring, ERP integration, digital
signature dan open API.

Referensi publik utama: - Talenta feature catalog:
https://www.talenta.co/fitur/ - Attendance:
https://www.talenta.co/fitur/attendance-management/ - Recruitment:
https://www.talenta.co/fitur/recruitment/ - AI:
https://www.talenta.co/fitur/talenta-ai/ - HR Analytics:
https://www.talenta.co/fitur/hr-analytics/ - Talenta Portal:
https://www.talenta.co/fitur/attendance-management/talenta-portal/

Dokumen ini mengubah capability tersebut menjadi **system specification
yang dapat diberikan kepada Claude Code secara bertahap**.

------------------------------------------------------------------------

# 2. PRODUCT VISION

## 2.1 Product definition

Build an **AI-native Indonesian HCM platform** capable of managing the
complete employee lifecycle:

``` text
WORKFORCE PLANNING
        ↓
RECRUITMENT
        ↓
ONBOARDING
        ↓
EMPLOYEE MASTER
        ↓
TIME & ATTENDANCE
        ↓
PAYROLL
        ↓
TAX & COMPLIANCE
        ↓
PERFORMANCE
        ↓
LEARNING
        ↓
CAREER / SUCCESSION
        ↓
OFFBOARDING
```

Across the entire lifecycle:

``` text
                    ┌───────────────┐
                    │ AI / ANALYTICS│
                    └───────┬───────┘
                            │
 ┌────────┬────────┬────────┼────────┬─────────┐
 │        │        │        │        │         │
Recruit  Core HR  Time    Payroll  Talent   Integration
 │        │        │        │        │         │
 └────────┴────────┴────────┴────────┴─────────┘
                            │
                     Workflow Engine
                            │
                     Notification Engine
                            │
                       Audit Engine
```

## 2.2 Product principles

The system MUST be:

-   Multi-tenant
-   API-first
-   Modular
-   Role-based
-   Workflow-driven
-   Event-driven where appropriate
-   Audit-ready
-   Indonesian payroll/tax compliant
-   Mobile-first for employees
-   Desktop/web-first for administrators
-   Offline-capable for selected mobile workflows
-   AI-ready
-   Integration-ready
-   Scalable to multi-company and multi-location enterprises

------------------------------------------------------------------------

# 3. CORE DIFFERENTIATORS TO BENCHMARK

The strength of Talenta is not merely the number of modules. The
strongest product characteristics are:

## 3.1 Integrated employee data

Employee data is the central source of truth.

``` text
Employee
 ├── Organization
 ├── Position
 ├── Employment
 ├── Attendance
 ├── Leave
 ├── Overtime
 ├── Payroll
 ├── Benefits
 ├── Performance
 ├── Learning
 ├── Documents
 └── Assets
```

## 3.2 Attendance → Payroll integration

Attendance, shift, overtime and leave must feed payroll automatically.

## 3.3 Recruitment → Employee conversion

Candidate data must flow into onboarding and employee master without
duplicate entry.

## 3.4 Performance → Talent

Performance results must feed competency, talent mapping, development
and succession.

## 3.5 Analytics across modules

Analytics must consume operational data rather than requiring separate
manual exports.

## 3.6 AI on top of structured HR data

AI should answer questions, summarize, predict and recommend actions.

------------------------------------------------------------------------

# 4. MULTI-TENANT ARCHITECTURE

## 4.1 Tenant model

Top-level:

``` text
Platform
 ├── Tenant / Organization
 │    ├── Legal Entity
 │    ├── Branch
 │    ├── Location
 │    ├── Department
 │    ├── Cost Center
 │    ├── Position
 │    └── Employees
 ├── Tenant
 └── Tenant
```

Every transactional table MUST have a tenant boundary.

Recommended:

``` text
tenant_id
company_id
created_at
updated_at
created_by
updated_by
deleted_at
version
```

## 4.2 Tenant isolation

Preferred architecture:

-   application-level tenant authorization
-   database row-level isolation where supported
-   tenant-scoped cache keys
-   tenant-scoped object storage
-   tenant-scoped search indexes
-   tenant-scoped analytics

Never trust tenant_id supplied directly by the client.

Derive tenant identity from authenticated session/token.

------------------------------------------------------------------------

# 5. IDENTITY, AUTHENTICATION & AUTHORIZATION

## Functions

-   Login
-   Logout
-   Password reset
-   MFA
-   SSO
-   Session management
-   Device management
-   Biometric unlock on mobile
-   Role-based access control
-   Permission groups
-   Organization-based access
-   Field-level restrictions
-   Audit trail

## Roles

Minimum system roles:

-   Super Admin
-   Tenant Owner
-   HR Admin
-   Payroll Admin
-   Recruiter
-   HR Manager
-   Finance
-   Manager
-   Supervisor
-   Employee
-   Auditor
-   System Integration User
-   AI/Analytics User

## Permission model

Permission should support:

``` text
module
resource
action
scope
```

Example:

``` text
Payroll
  read
  create
  calculate
  approve
  finalize
  disburse
```

Scope:

-   own
-   direct reports
-   department
-   branch
-   company
-   tenant

------------------------------------------------------------------------

# 6. EMPLOYEE MASTER / CORE HR

## 6.1 Employee profile

Fields:

-   employee_id
-   employee_number
-   legal name
-   preferred name
-   photo
-   date of birth
-   gender
-   nationality
-   contact
-   address
-   emergency contact
-   bank accounts
-   tax identity
-   BPJS identity
-   documents
-   employment status

## 6.2 Employment record

Separate employee identity from employment relationship.

``` text
Employee
  1:N
Employment
```

Employment should contain:

-   legal entity
-   branch
-   department
-   position
-   job level
-   employment type
-   join date
-   probation
-   contract start
-   contract end
-   manager
-   cost center
-   work location
-   work schedule
-   compensation profile

## 6.3 Employee lifecycle

States:

``` text
Draft
↓
Candidate
↓
Onboarding
↓
Active
↓
Leave of Absence
↓
Suspended
↓
Resigned
↓
Terminated
↓
Archived
```

Every state transition must be auditable.

------------------------------------------------------------------------

# 7. ORGANIZATION MANAGEMENT

Entities:

-   Legal Entity
-   Company
-   Branch
-   Location
-   Department
-   Division
-   Business Unit
-   Cost Center
-   Position
-   Job
-   Job Level
-   Grade
-   Reporting Line

## Organization tree

``` text
Holding
 ├── PT A
 │    ├── Jakarta
 │    └── Malang
 └── PT B
      ├── Surabaya
      └── Bali
```

## Challenge

Organization changes must not corrupt historical payroll/performance
data.

Use effective-dated records.

Example:

``` text
Employee Department History

2026-01-01 → Dept A
2026-07-01 → Dept B
```

Historical payroll must continue referencing the historical
organization.

------------------------------------------------------------------------

# 8. EMPLOYEE DOCUMENT MANAGEMENT

## Functions

-   Upload document
-   Document category
-   Expiration date
-   Version
-   Approval
-   Digital signature
-   Access permission
-   Document template
-   Generate document
-   Download
-   Audit history

Examples:

-   employment contract
-   NDA
-   warning letter
-   promotion letter
-   salary letter
-   BPJS documents
-   tax documents
-   certificates

## Improvement

Implement automated expiration monitoring:

``` text
Document expires in 30 days
        ↓
Notification
        ↓
Employee / HR
```

------------------------------------------------------------------------

# 9. EMPLOYEE SELF SERVICE

ESS is a major product pillar.

Employee should be able to:

-   clock in/out
-   request leave
-   request overtime
-   view schedule
-   view payslip
-   submit reimbursement
-   submit expense
-   update profile
-   upload documents
-   view benefits
-   view performance
-   complete review
-   access learning
-   sign documents
-   submit HR ticket
-   see announcements

## Principle

HR should not manually perform transactions that employees can safely
perform themselves.

------------------------------------------------------------------------

# 10. ATTENDANCE MANAGEMENT

Public Talenta capabilities include online attendance, GPS, geofencing,
face recognition, biometric validation, timesheet, shift management,
overtime, leave, Portal and live tracking.

## 10.1 Attendance record

Core fields:

``` text
attendance_id
employee_id
date
clock_in
clock_out
location
latitude
longitude
device
verification_method
shift_id
status
source
photo/evidence
```

## 10.2 Attendance sources

Support:

-   Mobile
-   Web
-   Face terminal
-   Fingerprint machine
-   API
-   Import
-   Manual correction

## 10.3 Attendance verification

Levels:

1.  PIN/password
2.  Device identity
3.  GPS
4.  Geofence
5.  Face recognition
6.  Liveness
7.  Risk scoring

## 10.4 Risk scoring

Example:

``` text
GPS mismatch           +40
Impossible travel      +30
Repeated device reuse  +20
Face mismatch          +50
Unusual time            +10
```

If score exceeds threshold:

``` text
Attendance = FLAGGED
```

Do not automatically delete the attendance.

Create an exception workflow.

------------------------------------------------------------------------

# 11. GEOFENCING

Entities:

-   Work Location
-   Geofence
-   Radius/polygon
-   Schedule
-   Allowed employee group

Example:

``` text
Factory A
Center: coordinate
Radius: 150m
```

Rules:

``` text
Inside = valid
Outside = rejected or flagged
```

Configurable by tenant.

------------------------------------------------------------------------

# 12. FACE RECOGNITION & LIVENESS

## Pipeline

``` text
Camera
 ↓
Face Detection
 ↓
Quality Check
 ↓
Liveness
 ↓
Face Embedding
 ↓
Identity Matching
 ↓
Attendance Decision
```

## Security requirements

Do not store raw face images unnecessarily.

Prefer:

-   encrypted biometric templates
-   strict access
-   retention policy
-   consent/legal basis
-   audit
-   anti-spoofing

## Challenge

Biometric systems are sensitive.

Need:

-   false positive control
-   false negative handling
-   poor lighting fallback
-   glasses/mask handling
-   spoof protection
-   device compatibility

------------------------------------------------------------------------

# 13. SHIFT MANAGEMENT

Support:

-   fixed shift
-   rotating shift
-   overnight
-   split shift
-   flexible schedule
-   custom work pattern
-   rest day
-   holiday
-   multi-location shift

Example:

``` text
Shift A
06:00–14:00

Shift B
14:00–22:00

Shift C
22:00–06:00
```

## Shift assignment

Support:

-   individual
-   department
-   position
-   location
-   batch
-   recurring schedule

## Challenge

Overnight shifts cross calendar boundaries.

Store actual timestamps, not only dates.

------------------------------------------------------------------------

# 14. TIMESHEET

Timesheet should capture:

-   date
-   employee
-   project
-   task
-   start
-   end
-   break
-   total hours
-   overtime
-   approval

Improvement:

Connect timesheet with project costing.

``` text
Employee
 ↓
Time
 ↓
Project
 ↓
Cost
```

------------------------------------------------------------------------

# 15. LEAVE / TIME OFF

Entities:

-   Leave Type
-   Leave Policy
-   Leave Balance
-   Leave Request
-   Approval
-   Holiday Calendar

Examples:

-   annual leave
-   sick leave
-   maternity
-   paternity
-   unpaid
-   special leave
-   custom leave

## Policy engine

Support:

-   accrual
-   monthly accrual
-   annual allocation
-   carry forward
-   expiration
-   probation restrictions
-   tenure-based entitlement
-   blackout periods
-   negative balance
-   partial day
-   hourly leave

------------------------------------------------------------------------

# 16. OVERTIME MANAGEMENT

Workflow:

``` text
Employee/Manager Request
        ↓
Policy Validation
        ↓
Manager Approval
        ↓
Actual Attendance
        ↓
Overtime Calculation
        ↓
Payroll
```

Rules should support:

-   workday overtime
-   holiday overtime
-   rest-day overtime
-   minimum overtime
-   rounding
-   approval requirement
-   maximum overtime
-   budget control

------------------------------------------------------------------------

# 17. LIVE TRACKING

For field employees:

-   location
-   route
-   timestamp
-   visit
-   photo
-   notes
-   activity
-   geofence
-   tracking interval

## Improvement

Add privacy-aware tracking:

-   only track during working hours
-   explicit employee visibility
-   configurable interval
-   location retention policy
-   manager access scope

------------------------------------------------------------------------

# 18. PAYROLL ENGINE

Payroll MUST be implemented as a rule engine, not hardcoded formulas.

## 18.1 Payroll components

Examples:

-   basic salary
-   fixed allowance
-   variable allowance
-   overtime
-   bonus
-   incentive
-   commission
-   deduction
-   loan
-   absence deduction
-   BPJS
-   PPh21
-   benefit

## 18.2 Component model

``` text
PayrollComponent
 ├── code
 ├── name
 ├── type
 ├── taxable
 ├── bpjs_base
 ├── proratable
 ├── recurring
 ├── formula
 ├── effective_date
 └── priority
```

## 18.3 Formula engine

Example:

``` text
overtime_pay =
hourly_rate × overtime_hours × overtime_multiplier
```

Do not execute arbitrary code from tenant configuration.

Use a safe DSL or expression engine.

------------------------------------------------------------------------

# 19. PAYROLL PROCESS

``` text
Open Payroll Period
        ↓
Freeze Input
        ↓
Collect Attendance
        ↓
Collect Leave
        ↓
Collect Overtime
        ↓
Collect Salary Changes
        ↓
Collect Allowances
        ↓
Collect Deductions
        ↓
Calculate
        ↓
Validate
        ↓
Exception Review
        ↓
Approval
        ↓
Finalize
        ↓
Payslip
        ↓
Disbursement
        ↓
Tax Reporting
        ↓
Accounting Posting
```

## Payroll states

``` text
DRAFT
INPUT_LOCKED
CALCULATED
UNDER_REVIEW
APPROVED
FINALIZED
DISBURSED
CLOSED
```

Never mutate finalized payroll silently.

Corrections must create adjustment records.

------------------------------------------------------------------------

# 20. INDONESIAN PAYROLL & TAX

The system should have a dedicated compliance layer.

Capabilities should include:

-   PPh 21/26
-   BPJS
-   THR
-   overtime
-   absence deduction
-   tax gross-up
-   tax allowance
-   tax annualization
-   employee tax status
-   e-Bupot
-   Coretax integration
-   payroll tax reports

## Architecture

``` text
Payroll Engine
      ↓
Tax Engine
      ↓
Compliance Adapter
      ├── PPh21
      ├── BPJS
      ├── e-Bupot
      └── Coretax
```

## Critical design rule

Regulatory logic must be versioned.

``` text
TaxRule
  effective_from
  effective_to
  jurisdiction
  rule_version
```

Never overwrite old tax rules.

Historical payroll must remain reproducible.

------------------------------------------------------------------------

# 21. PAYROLL SIMULATION

Before finalization, HR should be able to simulate:

-   salary increase
-   new allowance
-   bonus
-   tax gross-up
-   overtime
-   new employee
-   termination
-   THR

Example:

``` text
Current payroll:
Rp 2.4B

Scenario:
Salary +5%

Projected payroll:
Rp 2.52B

Additional monthly cost:
Rp 120M
```

------------------------------------------------------------------------

# 22. PAYROLL DISBURSEMENT

Support:

-   bank transfer
-   bulk payment
-   payment file
-   API
-   payment status
-   reconciliation

Workflow:

``` text
Finalized Payroll
 ↓
Payment Batch
 ↓
Approval
 ↓
Bank/API
 ↓
Processing
 ↓
Success/Failed
 ↓
Reconciliation
```

------------------------------------------------------------------------

# 23. PAYSLIP

Employee payslip:

-   gross salary
-   allowance
-   overtime
-   deductions
-   tax
-   BPJS
-   net salary
-   employer contributions where applicable

Must be:

-   immutable after payroll finalization
-   digitally generated
-   downloadable
-   access-controlled
-   auditable

------------------------------------------------------------------------

# 24. REIMBURSEMENT

Workflow:

``` text
Employee
 ↓
Claim
 ↓
Receipt
 ↓
Policy Validation
 ↓
Manager Approval
 ↓
Finance Approval
 ↓
Payment
```

## Policy engine

Examples:

``` text
Meal max = Rp100,000/day
Transport max = Rp500,000/trip
Hotel max = Rp1,000,000/night
```

## Improvement

Add OCR:

``` text
Receipt
 ↓
OCR
 ↓
Merchant
Date
Amount
Tax
Category
 ↓
Policy Validation
```

------------------------------------------------------------------------

# 25. EXPENSE MANAGEMENT

Support:

-   employee expense
-   company expense
-   business trip
-   advance
-   settlement
-   approval
-   cost center
-   project
-   accounting integration

Improvement:

Expense → Payroll/Finance/ERP posting.

------------------------------------------------------------------------

# 26. EMPLOYEE BENEFITS

Support:

-   insurance
-   BPJS
-   allowances
-   meal
-   transport
-   phone
-   wellness
-   flexible benefits
-   custom benefit

Benefit eligibility:

``` text
Employee
 ↓
Grade
 ↓
Policy
 ↓
Eligibility
 ↓
Benefit
```

------------------------------------------------------------------------

# 27. EARNED WAGE ACCESS

Optional module.

Concept:

``` text
Earned Salary
      ↓
Available Balance
      ↓
Employee Request
      ↓
Eligibility
      ↓
Advance
      ↓
Payroll Settlement
```

Need strict financial/legal review before production.

------------------------------------------------------------------------

# 28. RECRUITMENT / ATS

## Pipeline

``` text
Manpower Plan
 ↓
Job Requisition
 ↓
Approval
 ↓
Job Opening
 ↓
Job Posting
 ↓
Candidate
 ↓
Screening
 ↓
Assessment
 ↓
Interview
 ↓
Offer
 ↓
Accepted
 ↓
Onboarding
 ↓
Employee
```

## Candidate entity

Separate candidate from employee.

Candidate may later convert to employee.

------------------------------------------------------------------------

# 29. JOB POSTING

Support:

-   job title
-   description
-   requirements
-   skills
-   salary range
-   location
-   employment type
-   recruiter
-   hiring manager
-   custom application form

Channels:

-   career page
-   LinkedIn
-   JobStreet
-   custom API
-   social channels

Use integrations instead of scraping.

------------------------------------------------------------------------

# 30. AI CV SCREENING

Input:

``` text
Job Requirements
+
Candidate CV
+
Candidate Profile
```

Output:

-   match score
-   skills match
-   experience match
-   education match
-   missing requirements
-   evidence
-   confidence
-   recommendation

Important:

AI should not make irreversible hiring decisions without human
oversight.

------------------------------------------------------------------------

# 31. RECRUITMENT AUTOMATION

Examples:

``` text
Candidate score < threshold
→ Draft rejection

Candidate score > threshold
→ Move to screening

Interview completed
→ Request evaluation

Offer accepted
→ Create onboarding case
```

All automated actions must be configurable.

------------------------------------------------------------------------

# 32. ASSESSMENT

Support:

-   custom questions
-   scoring
-   personality assessment
-   technical test
-   cognitive test
-   structured interview scorecard

Do not hardcode one assessment model.

Create:

``` text
AssessmentTemplate
AssessmentSection
Question
Answer
ScoringRule
AssessmentResult
```

------------------------------------------------------------------------

# 33. MANPOWER PLANNING

Connect:

``` text
Business Plan
 ↓
Workforce Demand
 ↓
Current Headcount
 ↓
Gap
 ↓
Budget
 ↓
Hiring Plan
```

Metrics:

-   required headcount
-   current headcount
-   vacancy
-   projected attrition
-   hiring budget
-   hiring timeline

------------------------------------------------------------------------

# 34. ONBOARDING

Onboarding checklist:

-   documents
-   contract
-   bank
-   tax
-   BPJS
-   equipment
-   access
-   training
-   manager introduction
-   probation objectives

Automated employee creation after successful onboarding.

------------------------------------------------------------------------

# 35. OFFBOARDING

Workflow:

``` text
Resignation
 ↓
Approval
 ↓
Notice Period
 ↓
Asset Return
 ↓
Access Revocation
 ↓
Final Attendance
 ↓
Final Payroll
 ↓
Tax
 ↓
Exit Interview
 ↓
Archive
```

------------------------------------------------------------------------

# 36. PERFORMANCE MANAGEMENT

Support:

-   KPI
-   OKR
-   goals
-   competency
-   self review
-   manager review
-   peer review
-   360 review
-   calibration
-   performance score
-   feedback

------------------------------------------------------------------------

# 37. GOAL ENGINE

Hierarchy:

``` text
Company Objective
 ↓
Department Objective
 ↓
Team Objective
 ↓
Individual Goal
```

Each goal:

-   owner
-   metric
-   target
-   weight
-   period
-   status
-   progress
-   evidence

------------------------------------------------------------------------

# 38. PERFORMANCE REVIEW ENGINE

Review cycle:

``` text
Cycle Setup
 ↓
Goal Freeze
 ↓
Self Review
 ↓
Manager Review
 ↓
Peer Review
 ↓
Calibration
 ↓
Final Score
 ↓
Acknowledgement
```

Must support configurable workflows.

------------------------------------------------------------------------

# 39. 360 REVIEW

Reviewers:

-   self
-   manager
-   peers
-   direct reports
-   custom reviewer

Need anonymity options.

------------------------------------------------------------------------

# 40. COMPETENCY MANAGEMENT

Entities:

``` text
Competency
CompetencyLevel
JobCompetency
EmployeeCompetency
Assessment
SkillGap
```

Example:

``` text
Production Supervisor
Required:
Leadership L4
Problem Solving L4
Safety L5

Employee:
Leadership L3
Problem Solving L4
Safety L5
```

Skill gap:

``` text
Leadership: -1
```

------------------------------------------------------------------------

# 41. 9-BOX TALENT MATRIX

Axes:

-   Performance
-   Potential

Output:

-   high potential
-   high performer
-   solid performer
-   development need
-   risk

Improvement:

Add configurable matrix dimensions.

------------------------------------------------------------------------

# 42. TALENT MANAGEMENT

Talent pool:

-   high potential
-   critical role
-   critical skill
-   successor
-   leadership
-   retention risk

------------------------------------------------------------------------

# 43. SUCCESSION PLANNING

For every critical position:

``` text
Critical Position
 ↓
Successor Candidates
 ↓
Readiness
 ↓
Gap
 ↓
Development Plan
```

Readiness:

-   Ready Now
-   \< 1 year
-   1--2 years
-   2--3 years

------------------------------------------------------------------------

# 44. INDIVIDUAL DEVELOPMENT PLAN

IDP:

``` text
Skill Gap
 ↓
Development Objective
 ↓
Activity
 ↓
Training / Coaching
 ↓
Deadline
 ↓
Assessment
 ↓
Result
```

------------------------------------------------------------------------

# 45. LMS

Entities:

-   Course
-   Learning Path
-   Module
-   Lesson
-   Assessment
-   Enrollment
-   Progress
-   Certificate

Support:

-   mandatory training
-   optional training
-   certification expiry
-   recurring compliance training

------------------------------------------------------------------------

# 46. HR ANALYTICS

Public Talenta analytics includes dashboards for headcount, payroll,
attendance, performance and overtime, plus custom reporting and people
analytics.

Implement:

## Dashboard 1 --- Headcount

-   total headcount
-   active
-   new hires
-   resignations
-   turnover
-   department distribution
-   location distribution

## Dashboard 2 --- Payroll

-   gross payroll
-   net payroll
-   tax
-   BPJS
-   allowance
-   overtime
-   cost trend

## Dashboard 3 --- Attendance

-   attendance rate
-   absence
-   late
-   overtime
-   leave
-   anomaly

## Dashboard 4 --- Performance

-   average score
-   top performers
-   low performers
-   goal achievement

## Dashboard 5 --- Recruitment

-   open positions
-   applicants
-   screening rate
-   interview rate
-   offer rate
-   acceptance rate
-   time-to-hire
-   time-to-fill

------------------------------------------------------------------------

# 47. CUSTOM REPORT BUILDER

This should be built as a first-class platform capability.

User selects:

``` textdataset
 ↓
Dimensions
 ↓
Measures
 ↓
Filters
 ↓
Grouping
 ↓
Visualization
 ↓
Save Dashboard
```

Examples:

``` textemployee
Department
Payroll Cost
```

or:

``` textemployee
Attendance
Overtime
Production Location
```

Need semantic layer to prevent users from joining incompatible datasets.

------------------------------------------------------------------------

# 48. AI / HR COPILOT

Talenta currently markets AI capabilities including an AI chatbot,
performance review summarization, resignation prediction and candidate
scoring.

Our implementation should be more ambitious.

## 48.1 Natural language query

User:

> "Berapa biaya lembur production bulan ini dibanding bulan lalu?"

AI should:

1.  identify intent
2.  identify datasets
3.  generate safe query
4.  execute
5.  validate result
6.  summarize
7.  visualize
8.  cite data source
9.  provide recommendation

------------------------------------------------------------------------

# 49. AI SAFETY ARCHITECTURE

Never let LLM directly access the production database.

Use:

``` text
User
 ↓
AI Gateway
 ↓
Intent Classifier
 ↓
Permission Resolver
 ↓
Semantic Query Planner
 ↓
Safe Query Builder
 ↓
Read-only Analytics DB
 ↓
Validation
 ↓
LLM Summary
 ↓
Response
```

For write operations:

``` text
AI
 ↓
Action Proposal
 ↓
Permission Check
 ↓
Human Confirmation
 ↓
Workflow Engine
 ↓
Audit
```

------------------------------------------------------------------------

# 50. AI PERFORMANCE REVIEW

Input:

-   self review
-   manager review
-   peer review
-   goals
-   evidence
-   feedback

Output:

-   summary
-   strengths
-   improvement areas
-   themes
-   suggested development actions

Never fabricate facts.

Every generated insight should link to source evidence.

------------------------------------------------------------------------

# 51. AI TURNOVER / RESIGNATION PREDICTION

Potential features:

-   attrition risk
-   top factors
-   employee detail
-   department trend
-   intervention suggestions

Possible signals:

-   tenure
-   compensation change
-   overtime
-   absenteeism
-   leave pattern
-   performance trend
-   promotion history
-   manager changes
-   engagement data

Critical:

Do not use protected/sensitive characteristics as predictive signals.

Model output must be treated as decision support, not automatic
employment action.

------------------------------------------------------------------------

# 52. AI RECRUITMENT

Capabilities:

-   CV parsing
-   candidate scoring
-   skill extraction
-   job fit
-   duplicate detection
-   candidate ranking
-   interview question generation
-   interview summary

Fairness requirements:

-   explain score
-   expose criteria
-   allow human override
-   monitor bias
-   log model/version

------------------------------------------------------------------------

# 53. NOTIFICATION ENGINE

Channels:

-   in-app
-   email
-   push notification
-   WhatsApp via compliant provider
-   SMS if needed

Events:

-   attendance anomaly
-   leave approval
-   overtime approval
-   payroll finalized
-   payslip available
-   contract expiring
-   document expiring
-   interview
-   onboarding task
-   performance review
-   training due

Use event-driven architecture.

------------------------------------------------------------------------

# 54. WORKFLOW ENGINE

This is one of the most important foundational components.

Workflow should be generic.

``` text
Trigger
 ↓
Condition
 ↓
Approval
 ↓
Action
 ↓
Notification
 ↓
Next Step
```

Example:

``` text
Overtime Request
 ↓
Amount > Threshold?
 ├── NO → Supervisor
 └── YES → Supervisor → Manager → HR
```

Workflow must support:

-   sequential approval
-   parallel approval
-   conditional branch
-   delegation
-   escalation
-   SLA
-   reminder
-   rejection
-   resubmission
-   auto approval

------------------------------------------------------------------------

# 55. AUDIT ENGINE

Every important action must generate audit events.

``` text
actor
tenant
timestamp
resource
resource_id
action
before
after
ip
device
request_id
```

Examples:

-   salary changed
-   payroll approved
-   employee terminated
-   bank account changed
-   leave approved
-   attendance edited

Audit logs should be append-only.

------------------------------------------------------------------------

# 56. INTEGRATION PLATFORM

Support:

-   REST API
-   Webhooks
-   OAuth2
-   API keys
-   SSO
-   import/export
-   event subscriptions

Potential integrations:

``` text
ERP
Accounting
Bank
Tax
Biometric Device
Job Portal
E-sign
Email
Messaging
Identity Provider
LMS
Data Warehouse
```

------------------------------------------------------------------------

# 57. DEVICE / FINGERPRINT INTEGRATION

Architecture:

``` text
Biometric Device
 ↓
Device Connector
 ↓
Local Agent / Cloud Gateway
 ↓
Attendance API
 ↓
Attendance Engine
```

Never couple device-specific protocol directly into attendance business
logic.

Use adapter pattern:

``` text
AttendanceDeviceAdapter
 ├── ZKTecoAdapter
 ├── HikvisionAdapter
 ├── CustomAdapter
 └── MobileAdapter
```

------------------------------------------------------------------------

# 58. MOBILE APPLICATION

Recommended:

-   Flutter or React Native for shared codebase
-   native modules when required for biometrics/location
-   separate employee/admin experiences where appropriate

Core mobile:

``` text
Login
Dashboard
Attendance
Schedule
Leave
Overtime
Payslip
Reimbursement
Expense
Documents
Performance
Learning
Notifications
Profile
```

Special mobile requirements:

-   camera
-   GPS
-   geofencing
-   background location where legally appropriate
-   offline queue
-   biometric unlock
-   push notification

------------------------------------------------------------------------

# 59. WEB APPLICATION

Admin web should include:

``` text
Dashboard
Employees
Organization
Attendance
Shift
Leave
Overtime
Payroll
Tax
Recruitment
Performance
Talent
Learning
Expense
Benefits
Documents
Reports
Analytics
Workflow
Integrations
Settings
Audit
AI
```

------------------------------------------------------------------------

# 60. RECOMMENDED TECHNICAL ARCHITECTURE

For an initial production system:

``` text
Frontend
 ├── Web
 └── Mobile

API Gateway
      ↓
Application Services
 ├── Identity
 ├── Core HR
 ├── Time
 ├── Payroll
 ├── Recruitment
 ├── Performance
 ├── Talent
 ├── Learning
 ├── Expense
 ├── Workflow
 ├── Notification
 ├── Analytics
 └── AI

Infrastructure
 ├── PostgreSQL
 ├── Redis
 ├── Object Storage
 ├── Message Queue
 ├── Search
 ├── Analytics Warehouse
 └── Observability
```

------------------------------------------------------------------------

# 61. MODULAR MONOLITH FIRST

Do NOT start with 30 microservices.

Recommended initial architecture:

``` text
Modular Monolith
```

Modules have strict boundaries:

``` text
/modules
  /identity
  /tenant
  /core-hr
  /attendance
  /leave
  /overtime
  /payroll
  /recruitment
  /performance
  /talent
  /learning
  /expense
  /workflow
  /notification
  /analytics
  /integration
  /ai
```

Later extract services based on scale.

------------------------------------------------------------------------

# 62. EVENT MODEL

Use domain events.

Examples:

``` text
EmployeeCreated
EmployeeActivated
EmployeeTransferred
EmployeeTerminated

AttendanceRecorded
AttendanceCorrected

LeaveRequested
LeaveApproved

OvertimeRequested
OvertimeApproved

PayrollCalculated
PayrollApproved
PayrollFinalized
PayrollDisbursed

CandidateHired
OnboardingCompleted

PerformanceCycleStarted
PerformanceReviewCompleted
```

Events feed:

-   notification
-   audit
-   analytics
-   integrations
-   AI feature pipelines

------------------------------------------------------------------------

# 63. DATABASE CORE ENTITIES

Minimum entity families:

## Identity

-   User
-   Role
-   Permission
-   Session
-   Device

## Tenant

-   Tenant
-   LegalEntity
-   Company
-   Branch
-   Location

## Organization

-   Department
-   Division
-   Position
-   Job
-   Grade
-   CostCenter

## People

-   Employee
-   Employment
-   EmployeeHistory
-   EmergencyContact
-   BankAccount
-   TaxProfile
-   BenefitProfile

## Time

-   Attendance
-   Shift
-   ShiftAssignment
-   Timesheet
-   LeavePolicy
-   LeaveBalance
-   LeaveRequest
-   OvertimeRequest
-   Holiday

## Payroll

-   PayrollPeriod
-   PayrollRun
-   PayrollComponent
-   PayrollInput
-   PayrollResult
-   Payslip
-   PaymentBatch
-   PaymentTransaction
-   TaxResult

## Recruitment

-   JobRequisition
-   JobOpening
-   Candidate
-   Application
-   Interview
-   Assessment
-   Offer

## Performance

-   Goal
-   KPI
-   OKR
-   ReviewCycle
-   Review
-   Competency
-   Skill
-   Feedback

## Talent

-   TalentPool
-   TalentAssessment
-   SuccessionPlan
-   DevelopmentPlan

## Learning

-   Course
-   LearningPath
-   Enrollment
-   Assessment
-   Certificate

## Expense

-   Expense
-   Reimbursement
-   ExpensePolicy
-   Approval

## Platform

-   Workflow
-   WorkflowInstance
-   Notification
-   AuditLog
-   Integration
-   Webhook
-   APIKey

------------------------------------------------------------------------

# 64. CRITICAL DATABASE DESIGN RULES

## Effective dating

Use effective-dated tables for:

-   employment
-   salary
-   organization
-   position
-   tax rules
-   payroll components
-   benefit policies
-   leave policies

## Money

Never use floating point.

Use:

``` text
DECIMAL(19,4)
```

and store currency explicitly.

## Time

Store timestamps in UTC.

Convert to tenant/location timezone at presentation/business boundary.

## Historical integrity

Finalized payroll must be reproducible.

------------------------------------------------------------------------

# 65. API DESIGN

REST examples:

``` text
POST /api/v1/auth/login
GET /api/v1/employees
POST /api/v1/employees
GET /api/v1/employees/{id}

GET /api/v1/attendance
POST /api/v1/attendance/clock-in
POST /api/v1/attendance/clock-out

GET /api/v1/leaves
POST /api/v1/leaves
POST /api/v1/leaves/{id}/approve

GET /api/v1/payroll/runs
POST /api/v1/payroll/runs
POST /api/v1/payroll/runs/{id}/calculate
POST /api/v1/payroll/runs/{id}/approve
POST /api/v1/payroll/runs/{id}/finalize

GET /api/v1/candidates
POST /api/v1/candidates
POST /api/v1/candidates/{id}/score
```

Use versioning:

``` text
/api/v1
/api/v2
```

------------------------------------------------------------------------

# 66. FRONTEND UX PRINCIPLES

Avoid copying Talenta's visual design.

Build own UX based on:

-   command center dashboard
-   contextual actions
-   minimal clicks
-   mobile-first ESS
-   bulk actions
-   keyboard shortcuts
-   saved filters
-   advanced search
-   role-specific dashboards

Example HR dashboard:

``` text
┌─────────────────────────────────────┐
│ Workforce Overview                  │
├────────┬────────┬────────┬─────────┤
│ 1,248  │ 4.1%   │ Rp 3.2B│ 8.7%    │
│ People │ Turnover│Payroll │ Overtime│
└────────┴────────┴────────┴─────────┘

Exceptions
──────────────────────────────────────
12 attendance anomalies
4 contracts expiring
7 payroll exceptions
3 approvals pending
```

------------------------------------------------------------------------

# 67. BULK OPERATIONS

Enterprise HR requires bulk actions.

Support:

-   bulk employee import
-   bulk salary update
-   bulk shift assignment
-   bulk leave adjustment
-   bulk document upload
-   bulk payroll input
-   bulk approval
-   bulk notification

Use asynchronous jobs for large datasets.

------------------------------------------------------------------------

# 68. IMPORT / EXPORT

Support:

-   CSV
-   XLSX
-   API
-   SFTP where needed

Import must have:

``` text
Upload
 ↓
Mapping
 ↓
Validation
 ↓
Preview
 ↓
Error report
 ↓
Commit
```

Never directly insert imported data.

------------------------------------------------------------------------

# 69. SEARCH

Global search:

``` text
Employee
Candidate
Document
Payroll
Attendance
Leave
Workflow
```

Search should support:

-   exact
-   fuzzy
-   filters
-   tenant scope
-   permission scope

------------------------------------------------------------------------

# 70. REPORTING ENGINE

Reports must be generated asynchronously for large data.

Support:

-   PDF
-   XLSX
-   CSV
-   API

Report jobs:

``` text
Requested
 ↓
Queued
 ↓
Processing
 ↓
Completed
 ↓
Download
```

------------------------------------------------------------------------

# 71. SECURITY REQUIREMENTS

Minimum:

-   TLS
-   encryption at rest
-   encrypted secrets
-   password hashing
-   MFA
-   RBAC
-   tenant isolation
-   audit logging
-   rate limiting
-   API authentication
-   secure file upload
-   malware scanning
-   backup
-   disaster recovery
-   key rotation

Sensitive data:

-   bank accounts
-   tax identity
-   biometric templates
-   employee documents
-   payroll

Need stronger controls.

------------------------------------------------------------------------

# 72. PRIVACY

Important categories:

-   biometric
-   location
-   salary
-   tax
-   medical/leave information
-   identity documents

Implement:

-   data minimization
-   retention policy
-   purpose limitation
-   access logging
-   deletion/anonymization where legally possible
-   employee data access controls

------------------------------------------------------------------------

# 73. OBSERVABILITY

Need:

-   application logs
-   audit logs
-   metrics
-   traces
-   queue monitoring
-   job monitoring
-   API latency
-   error rate
-   payroll calculation duration
-   attendance ingestion rate

Critical alerts:

-   payroll failure
-   payment failure
-   attendance ingestion failure
-   integration failure
-   tax submission failure

------------------------------------------------------------------------

# 74. TESTING STRATEGY

## Unit tests

Every business rule.

Especially:

-   payroll
-   tax
-   leave
-   overtime
-   attendance
-   benefits

## Integration tests

-   attendance → payroll
-   leave → payroll
-   overtime → payroll
-   recruitment → onboarding
-   performance → talent

## End-to-end

Example:

``` text
Create Employee
 ↓
Assign Shift
 ↓
Clock In
 ↓
Clock Out
 ↓
Overtime
 ↓
Payroll
 ↓
Payslip
```

------------------------------------------------------------------------

# 75. PAYROLL TEST REQUIREMENT

Create a golden test suite.

For every payroll rule:

``` text
Input
Expected Output
```

Examples:

-   normal employee
-   late employee
-   absent employee
-   overtime
-   holiday overtime
-   new employee
-   resigned employee
-   unpaid leave
-   bonus
-   THR
-   tax gross-up
-   BPJS
-   tax annualization

Never change payroll engine without regression tests.

------------------------------------------------------------------------

# 76. CHALLENGES

## Challenge 1 --- Payroll complexity

Payroll rules differ by:

-   company
-   employee
-   contract
-   policy
-   regulation

Solution:

Rule engine + versioning + effective dates.

## Challenge 2 --- Attendance anomalies

GPS can be inaccurate.

Solution:

Risk scoring + exception workflow + manual correction.

## Challenge 3 --- Overnight shifts

Solution:

Use timestamps and shift business dates.

## Challenge 4 --- Historical integrity

Solution:

Immutable finalized transactions + effective-dated master data.

## Challenge 5 --- Multi-tenant scale

Solution:

Tenant-aware architecture + indexed tenant_id + asynchronous jobs.

## Challenge 6 --- AI hallucination

Solution:

AI must retrieve verified data and cite source records.

## Challenge 7 --- AI bias

Solution:

Explainability + monitoring + human review.

## Challenge 8 --- Biometric security

Solution:

Encrypted templates, minimal retention, access controls.

## Challenge 9 --- Regulatory changes

Solution:

Versioned compliance engine.

## Challenge 10 --- Integrations

Solution:

Adapter architecture + webhook/event bus.

------------------------------------------------------------------------

# 77. IMPROVEMENTS OVER A TALENTA-LIKE BASELINE

The goal should not stop at parity.

## 77.1 AI-native from architecture

Instead of adding chatbot at the end:

``` text
Operational Data
 ↓
Semantic Layer
 ↓
Analytics
 ↓
AI
```

from day one.

## 77.2 Explainable AI

Every AI answer should expose:

-   data sources
-   time period
-   filters
-   calculation
-   model version
-   confidence where relevant

## 77.3 AI action layer

AI should eventually be able to propose:

> "7 overtime approvals exceed department budget."

Then:

> "Open the approval queue."

Eventually:

> "Prepare a recommendation to reduce overtime."

But irreversible actions require confirmation.

## 77.4 Workforce cost intelligence

Connect:

``` text
Employee
 ×
Hours
 ×
Salary
 ×
Overtime
 ×
Benefits
```

to calculate true labor cost.

## 77.5 Labor cost by operation/project

Especially useful for manufacturing:

``` text
Employee
 ↓
Work Order
 ↓
Operation
 ↓
Hours
 ↓
Labor Cost
```

This is an opportunity to connect HCM with ERP/MES.

------------------------------------------------------------------------

# 78. MANUFACTURING-SPECIFIC EXTENSION

For a manufacturing-oriented ERP, add:

-   Production workforce planning
-   Skill matrix
-   Operator certification
-   Machine authorization
-   Production shift
-   Operator attendance
-   Labor allocation
-   Labor cost by work order
-   Labor cost by operation
-   Overtime by production order
-   Production incentive
-   Safety training
-   Maintenance technician certification
-   Production KPI
-   Operator performance

Example:

``` text
Production Order
 ↓
Operation
 ↓
Assigned Employee
 ↓
Attendance / Labor Time
 ↓
Labor Cost
 ↓
Production Cost
```

This can make the HR module materially more valuable than a standalone
HRIS.

------------------------------------------------------------------------

# 79. CLAUDE CODE DEVELOPMENT STRATEGY

Do NOT give Claude Code one enormous instruction such as:

> "Build Talenta."

Instead build a controlled sequence.

## Phase 0 --- Architecture

Claude Code creates:

-   repository
-   architecture
-   database conventions
-   coding standards
-   module boundaries
-   CI/CD
-   testing framework
-   authentication foundation

## Phase 1 --- Platform

Build:

-   tenant
-   user
-   role
-   permission
-   audit
-   notification
-   workflow
-   file storage

## Phase 2 --- Core HR

Build:

-   employee
-   employment
-   organization
-   position
-   department
-   documents
-   lifecycle

## Phase 3 --- Attendance

Build:

-   attendance
-   GPS
-   geofence
-   shift
-   timesheet
-   leave
-   overtime

## Phase 4 --- Payroll

Build:

-   payroll components
-   payroll engine
-   payroll periods
-   calculation
-   tax
-   payslip
-   approval
-   disbursement

## Phase 5 --- Recruitment

Build:

-   manpower planning
-   job requisition
-   ATS
-   candidate
-   interview
-   assessment
-   offer
-   onboarding

## Phase 6 --- Performance

Build:

-   goals
-   KPI
-   OKR
-   review
-   360
-   competency
-   calibration

## Phase 7 --- Talent

Build:

-   skill matrix
-   talent pool
-   9-box
-   IDP
-   succession
-   career path

## Phase 8 --- Learning

Build:

-   courses
-   learning paths
-   enrollment
-   assessment
-   certification

## Phase 9 --- Analytics

Build:

-   semantic layer
-   dashboards
-   reports
-   custom reporting

## Phase 10 --- AI

Build:

-   AI gateway
-   RAG/data query
-   HR copilot
-   performance summarization
-   recruitment scoring
-   predictive analytics

## Phase 11 --- Integrations

Build:

-   REST API
-   webhooks
-   ERP
-   bank
-   tax
-   biometric
-   e-sign
-   job portals

------------------------------------------------------------------------

# 80. CLAUDE CODE RULES

Claude Code must follow these rules:

1.  Never implement multiple large modules in one uncontrolled change.
2.  Before coding, inspect repository architecture.
3.  Before changing database schema, document migration impact.
4.  Every feature requires tests.
5.  Every business rule requires unit tests.
6.  Every API requires authorization tests.
7.  Every tenant-scoped query must be tested for cross-tenant leakage.
8.  Never bypass service-layer business rules from controllers.
9.  Never hardcode payroll regulations.
10. Never hardcode tenant-specific business rules.
11. Never store secrets in source code.
12. Never expose sensitive employee data in logs.
13. Never allow AI to directly execute unrestricted SQL.
14. Never allow AI to perform irreversible HR actions without
    permission/confirmation.
15. Every destructive action must be auditable.
16. Use database migrations.
17. Preserve backwards compatibility for APIs.
18. Do not rewrite stable modules without tests.
19. Use feature flags for risky releases.
20. Every implementation must include acceptance criteria.

------------------------------------------------------------------------

# 81. CLAUDE CODE TASK FORMAT

Each development task should use:

``` text
FEATURE:
[feature name]

BUSINESS PURPOSE:
[why it exists]

ACTORS:
[roles]

PRECONDITIONS:
[requirements]

USER FLOW:
[step-by-step]

BUSINESS RULES:
[rules]

DATA MODEL:
[entities]

API:
[endpoints]

UI:
[screens]

PERMISSIONS:
[roles and scopes]

EVENTS:
[domain events]

NOTIFICATIONS:
[notifications]

AUDIT:
[what must be logged]

EDGE CASES:
[exceptions]

SECURITY:
[security requirements]

TEST CASES:
[test scenarios]

ACCEPTANCE CRITERIA:
[definition of done]
```

Claude Code should not mark a feature complete until all sections are
implemented or explicitly documented as not applicable.

------------------------------------------------------------------------

# 82. EXAMPLE CLAUDE CODE TASK --- ATTENDANCE

``` text
FEATURE:
Mobile Attendance Clock In/Clock Out

BUSINESS PURPOSE:
Allow employees to record attendance from mobile devices with configurable location and identity validation.

ACTORS:
Employee
HR Admin
Manager

PRECONDITIONS:
Employee is active.
Employee has assigned work schedule.
Employee has registered mobile device.

USER FLOW:
1. Employee opens Attendance.
2. App requests required location permission.
3. App captures current location.
4. System evaluates geofence.
5. App performs identity verification if enabled.
6. System validates schedule.
7. System creates attendance record.
8. System returns attendance status.
9. System creates audit event.

BUSINESS RULES:
- Employee cannot clock in twice for same attendance session.
- Outside geofence may be rejected or flagged based on policy.
- Overnight shifts must use shift business date.
- Device time cannot be trusted.
- Server time is authoritative.

DATA:
Attendance
AttendanceSession
Geofence
ShiftAssignment
VerificationResult

API:
POST /api/v1/attendance/clock-in
POST /api/v1/attendance/clock-out
GET /api/v1/attendance/today

SECURITY:
- Tenant isolation
- Employee can only access own attendance
- Manager can access permitted subordinate scope
- Do not expose biometric templates

TESTS:
- valid clock in
- outside geofence
- duplicate clock in
- overnight shift
- timezone
- network retry
- offline queue
- unauthorized employee
- cross-tenant access attempt

ACCEPTANCE:
Feature passes unit, integration and E2E tests.
```

------------------------------------------------------------------------

# 83. DEVELOPMENT ORDER BY RISK

Do not build according to marketing importance alone.

Build high-risk foundations early:

``` text
1. Identity
2. Tenant isolation
3. Audit
4. Workflow
5. Effective dating
6. Time engine
7. Payroll engine
8. Compliance engine
9. API/event architecture
10. Analytics semantic layer
```

Then UI-heavy modules.

Reason:

If payroll architecture is wrong, rewriting it later is extremely
expensive.

------------------------------------------------------------------------

# 84. MVP

A credible MVP should include:

### Platform

-   multi-tenant
-   authentication
-   RBAC
-   audit
-   notifications

### Core HR

-   employee
-   employment
-   organization
-   documents

### Attendance

-   mobile attendance
-   GPS
-   geofence
-   shift
-   leave
-   overtime

### Payroll

-   salary
-   allowance
-   deduction
-   overtime
-   BPJS
-   PPh21
-   payslip

### ESS

-   attendance
-   leave
-   overtime
-   payslip
-   profile

### Admin

-   employee management
-   attendance correction
-   payroll run
-   approval

------------------------------------------------------------------------

# 85. V1

Add:

-   recruitment
-   onboarding
-   reimbursement
-   expense
-   benefits
-   performance
-   KPI/OKR
-   analytics
-   API
-   biometric integration

------------------------------------------------------------------------

# 86. V2

Add:

-   talent
-   succession
-   LMS
-   advanced analytics
-   custom report builder
-   AI copilot
-   AI CV scoring
-   AI performance review
-   turnover prediction

------------------------------------------------------------------------

# 87. V3

Add:

-   workforce planning
-   labor cost intelligence
-   ERP integration
-   production labor allocation
-   advanced predictive analytics
-   AI workflow agent
-   marketplace/integration ecosystem

------------------------------------------------------------------------

# 88. ACCEPTANCE CRITERIA FOR THE WHOLE PRODUCT

The system is not considered production-ready merely because all screens
exist.

It must satisfy:

### Functional

-   End-to-end employee lifecycle works.
-   Attendance feeds payroll.
-   Leave feeds payroll.
-   Overtime feeds payroll.
-   Recruitment feeds onboarding.
-   Performance feeds talent.
-   Payroll feeds tax/reporting.

### Security

-   No cross-tenant access.
-   Sensitive data protected.
-   Audit trail complete.

### Reliability

-   Payroll calculation reproducible.
-   Failed integrations retry safely.
-   Attendance duplicate events handled idempotently.

### Performance

Define actual SLAs, for example:

-   API p95 \< 500ms for ordinary CRUD.
-   Attendance clock-in \< 2 seconds excluding external biometric
    latency.
-   Payroll calculation asynchronous for large tenants.
-   Dashboard queries use optimized analytics layer.

### Quality

-   Unit tests
-   Integration tests
-   E2E tests
-   Security tests
-   Load tests
-   Migration tests

------------------------------------------------------------------------

# 89. KEY PRODUCT METRICS

Measure:

## HR operations

-   HR transactions per employee
-   manual interventions
-   approval time
-   HR ticket volume

## Attendance

-   attendance success rate
-   anomaly rate
-   late rate
-   overtime rate

## Payroll

-   payroll processing duration
-   payroll error rate
-   correction rate
-   payment failure rate

## Recruitment

-   time-to-hire
-   time-to-fill
-   offer acceptance
-   candidate conversion

## Performance

-   review completion
-   goal completion
-   performance distribution

## Product

-   DAU/MAU
-   ESS adoption
-   mobile attendance usage
-   automation rate
-   AI query usage

------------------------------------------------------------------------

# 90. FINAL ARCHITECTURAL MODEL

The target system should become:

``` text
                         ┌─────────────────────────┐
                         │       AI COPILOT        │
                         │ Query / Predict / Act   │
                         └───────────┬─────────────┘
                                     │
                         ┌───────────▼─────────────┐
                         │    ANALYTICS LAYER      │
                         │ Semantic + BI + Metrics │
                         └───────────┬─────────────┘
                                     │
             ┌───────────────────────┼───────────────────────┐
             │                       │                       │
     ┌───────▼───────┐      ┌──────▼──────┐       ┌────────▼────────┐
     │     PEOPLE     │      │    TIME     │       │     PAYROLL      │
     │ Core HR        │      │ Attendance  │       │ Salary           │
     │ Recruitment    │      │ Shift       │       │ Tax              │
     │ Performance    │      │ Leave       │       │ Benefits         │
     │ Talent         │      │ Overtime    │       │ Disbursement     │
     │ Learning       │      │ Timesheet   │       │ Payslip          │
     └───────┬────────┘      └──────┬──────┘       └────────┬─────────┘
             │                      │                       │
             └──────────────────────┼───────────────────────┘
                                    │
                         ┌──────────▼──────────┐
                         │  WORKFLOW ENGINE    │
                         │ Approval / Rules     │
                         └──────────┬──────────┘
                                    │
                         ┌──────────▼──────────┐
                         │  EVENT / INTEGRATION│
                         │ API / Webhook / Bus  │
                         └──────────┬──────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
          ERP/Finance           Bank/Tax            Devices/IoT
```

------------------------------------------------------------------------

# 91. FINAL INSTRUCTION TO CLAUDE CODE

Use this document as the **functional benchmark and architecture
specification** for building a new HCM/HRIS product.

Do not attempt to reproduce Talenta's source code, proprietary
implementation, branding, exact UI, text, or private algorithms.

Instead:

1.  Analyze each capability.
2.  Design an original implementation.
3.  Create domain model.
4.  Create database migration.
5.  Create service layer.
6.  Create API.
7.  Create UI.
8.  Create permissions.
9.  Create workflow.
10. Create audit events.
11. Create tests.
12. Run tests.
13. Perform security review.
14. Document the implementation.
15. Only then mark the feature complete.

For every module, Claude Code must maintain:

``` text
SPECIFICATION
↓
DOMAIN MODEL
↓
DATABASE
↓
BUSINESS RULES
↓
SERVICE
↓
API
↓
UI
↓
WORKFLOW
↓
EVENTS
↓
NOTIFICATIONS
↓
AUDIT
↓
TEST
↓
SECURITY REVIEW
↓
DOCUMENTATION
```

The end goal is not merely:

> "Build an HRIS similar to Talenta."

The goal is:

> **Build a modular, multi-tenant, Indonesian-compliant, AI-native HCM
> platform that achieves functional parity with the publicly observable
> capabilities of Talenta while providing stronger workflow automation,
> explainable AI, labor-cost intelligence, integration architecture, and
> manufacturing-oriented workforce capabilities.**
