/**
 * SamvaadHMS Design System
 * Single source of truth for all visual tokens.
 * Import from here when building any page or component.
 */

// ─── Colors ───────────────────────────────────────────────────────────────────

export const colors = {
  bg: {
    page: "#f7f7f7",
    card: "#ffffff",
    greyLight: "#f6f6f6",
    greyDark: "#f2f3f3",
  },
  brand: {
    primary: "#009598",
    primaryHover: "#007f82",
    primaryForeground: "#ffffff",
  },
  text: {
    primary: "#11111c",
    secondary: "#57575f",
    white: "#ffffff",
    onBrand: "#ffffff",
  },
  stroke: "#dedee1",
  status: {
    completed:      { bg: "#dffff3", text: "#00955c" },
    today:          { bg: "#d6eaff", text: "#007cff" },
    upcoming:       { bg: "#fff2e0", text: "#ff9000" },
    cancelled:      { bg: "#ffe9e9", text: "#ff0004" },
    admitted:       { bg: "#e8f4ff", text: "#0066cc" },
    discharged:     { bg: "#f0f0f0", text: "#57575f" },
    waiting:        { bg: "#fff2e0", text: "#ff9000" },
    inConsultation: { bg: "#d6eaff", text: "#007cff" },
    available:      { bg: "#dffff3", text: "#00955c" },
    occupied:       { bg: "#ffe9e9", text: "#ff0004" },
    reserved:       { bg: "#fff2e0", text: "#ff9000" },
    inStock:        { bg: "#dffff3", text: "#00955c" },
    lowStock:       { bg: "#fff2e0", text: "#ff9000" },
    outOfStock:     { bg: "#ffe9e9", text: "#ff0004" },
    scheduled:      { bg: "#d6eaff", text: "#007cff" },
    inProgress:     { bg: "#fff2e0", text: "#ff9000" },
    paid:           { bg: "#dffff3", text: "#00955c" },
    pending:        { bg: "#fff2e0", text: "#ff9000" },
    partial:        { bg: "#d6eaff", text: "#007cff" },
    refunded:       { bg: "#f0f0f0", text: "#57575f" },
    active:         { bg: "#dffff3", text: "#00955c" },
    onLeave:        { bg: "#fff2e0", text: "#ff9000" },
    inactive:       { bg: "#f0f0f0", text: "#57575f" },
    icu:            { bg: "#ffe9e9", text: "#ff0004" },
    expired:        { bg: "#ffe9e9", text: "#ff0004" },
    collected:      { bg: "#d6eaff", text: "#007cff" },
    reportReady:    { bg: "#dffff3", text: "#00955c" },
  },
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────

export const typography = {
  fontFamily: "var(--font-archivo), sans-serif",
  scale: {
    h1:      { fontSize: "24px", fontWeight: "500", lineHeight: "28px" },
    title3M: { fontSize: "16px", fontWeight: "500", lineHeight: "20px" },
    title3L: { fontSize: "16px", fontWeight: "300", lineHeight: "20px" },
    title4M: { fontSize: "14px", fontWeight: "500", lineHeight: "19px" },
    title4R: { fontSize: "14px", fontWeight: "400", lineHeight: "19px" },
    title5L: { fontSize: "12px", fontWeight: "300", lineHeight: "16px" },
  },
} as const;

// ─── Tailwind class helpers ───────────────────────────────────────────────────

export const tw = {
  text: {
    h1:          "text-[24px] font-medium leading-[28px] text-[color:var(--ink)]",
    title3M:     "text-[16px] font-medium leading-5 text-[color:var(--ink)]",
    title3L:     "text-[16px] font-light leading-5 text-[color:var(--ink)]",
    title4M:     "text-[14px] font-medium leading-[19px] text-[color:var(--ink)]",
    title4R:     "text-[14px] font-normal leading-[19px] text-[color:var(--ink)]",
    title4Muted: "text-[14px] font-normal leading-[19px] text-[color:var(--ink-soft)]",
    title5L:     "text-[12px] font-light leading-4 text-[color:var(--ink-soft)]",
  },

  surface: {
    page:      "bg-[color:var(--canvas)]",
    card:      "bg-[color:var(--surface)] border border-[color:var(--line)]",
    greyLight: "bg-[color:var(--subtle)]",
    greyDark:  "bg-[color:var(--subtle-3)]",
    brand:     "bg-[color:var(--brand)]",
  },

  border: {
    default: "border border-[color:var(--line)]",
    bottom:  "border-b border-[color:var(--line)]",
  },

  radius: {
    pill:  "rounded-full",
    card:  "rounded-[10px]",
    badge: "rounded-[6px]",
  },

  shadow: {
    nav:  "shadow-[0_1px_4px_rgba(0,0,0,0.08)]",
    card: "shadow-[0_1px_8px_rgba(0,0,0,0.06)]",
  },

  gutter:  "px-[30px]",
  gutterX: "mx-[30px]",

  pill: {
    white: "bg-[color:var(--surface)] flex items-center gap-[10px] px-[15px] py-[6px] rounded-full",
    grey:  "bg-[color:var(--subtle)] flex items-center gap-[10px] px-[15px] py-[6px] rounded-full",
    brand: "bg-[color:var(--brand)] flex items-center gap-[5px] px-[15px] py-[6px] rounded-full text-white hover:bg-[color:var(--brand-hover)] transition-colors cursor-pointer",
  },

  statusBadge: {
    // Appointment / patient statuses
    "Completed":       "bg-[#dffff3] text-[#00955c]",
    "Today":           "bg-[#d6eaff] text-[#007cff]",
    "Upcoming":        "bg-[#fff2e0] text-[#ff9000]",
    "Cancelled":       "bg-[#ffe9e9] text-[#ff0004]",
    // IPD / admission
    "Admitted":        "bg-[#e8f4ff] text-[#0066cc]",
    "Discharged":      "bg-[color:var(--subtle-2)] text-[color:var(--ink-soft)]",
    "ICU":             "bg-[#ffe9e9] text-[#ff0004]",
    // OPD queue
    "Waiting":         "bg-[#fff2e0] text-[#ff9000]",
    "In Consultation": "bg-[#d6eaff] text-[#007cff]",
    // Beds
    "Available":       "bg-[#dffff3] text-[#00955c]",
    "Occupied":        "bg-[#ffe9e9] text-[#ff0004]",
    "Reserved":        "bg-[#fff2e0] text-[#ff9000]",
    "Maintenance":     "bg-[color:var(--subtle-2)] text-[color:var(--ink-soft)]",
    // Pharmacy
    "In Stock":        "bg-[#dffff3] text-[#00955c]",
    "Low Stock":       "bg-[#fff2e0] text-[#ff9000]",
    "Out of Stock":    "bg-[#ffe9e9] text-[#ff0004]",
    "Expired":         "bg-[#ffe9e9] text-[#ff0004]",
    // OT
    "Scheduled":       "bg-[#d6eaff] text-[#007cff]",
    "In Progress":     "bg-[#fff2e0] text-[#ff9000]",
    // Billing
    "Paid":            "bg-[#dffff3] text-[#00955c]",
    "Pending":         "bg-[#fff2e0] text-[#ff9000]",
    "Partial":         "bg-[#d6eaff] text-[#007cff]",
    "Refunded":        "bg-[color:var(--subtle-2)] text-[color:var(--ink-soft)]",
    // Staff / doctor
    "Active":          "bg-[#dffff3] text-[#00955c]",
    "On Leave":        "bg-[#fff2e0] text-[#ff9000]",
    "Inactive":        "bg-[color:var(--subtle-2)] text-[color:var(--ink-soft)]",
    "In OPD":          "bg-[#d6eaff] text-[#007cff]",
    // Lab
    "Sample Collected": "bg-[#d6eaff] text-[#007cff]",
    "Report Ready":    "bg-[#dffff3] text-[#00955c]",
    // Prescription
    "Dispensed":       "bg-[#dffff3] text-[#00955c]",
    "Draft":           "bg-[color:var(--subtle-2)] text-[color:var(--ink-soft)]",
    // Radiology
    "Scan Done":       "bg-[#d6eaff] text-[#007cff]",
    // Blood bank
    "Eligible":        "bg-[#dffff3] text-[#00955c]",
    "Deferred":        "bg-[#fff2e0] text-[#ff9000]",
    "Issued":          "bg-[#dffff3] text-[#00955c]",
    // Ambulance
    "On Call":         "bg-[#d6eaff] text-[#007cff]",
    "Dispatched":      "bg-[#fff2e0] text-[#ff9000]",
    // TPA claims
    "Submitted":       "bg-[color:var(--subtle-2)] text-[color:var(--ink-soft)]",
    "In Review":       "bg-[#fff2e0] text-[#ff9000]",
    "Approved":        "bg-[#dffff3] text-[#00955c]",
    "Rejected":        "bg-[#ffe9e9] text-[#ff0004]",
    "Settled":         "bg-[#d6eaff] text-[#007cff]",
  } as Record<string, string>,

  nav: {
    height:      52,
    heightClass: "h-[52px]",
    offset:      "pt-[52px]",
  },

  table: {
    // Grid-based: cells are laid out via `grid-template-columns: var(--cols)`,
    // which the DataTable sets from each page's column widths. This keeps every
    // field in its own column (no stacking) and rows compact.
    headerRow: "grid items-center gap-3 pl-5 pr-6 h-[34px] bg-[color:var(--subtle-3)]",
    dataRow:   "grid items-center gap-3 pl-5 pr-6 h-[42px] border-b border-[color:var(--line)] bg-[color:var(--surface)] hover:bg-[color:var(--faint)] transition-colors",
    minWidth:  1240,
  },

  sidebar: {
    width:       "240px",
    widthClass:  "w-[240px]",
    offsetClass: "ml-[240px]",
  },
} as const;

// ─── Breakpoints ──────────────────────────────────────────────────────────────

export const breakpoints = {
  minDesktop: 1512,
} as const;

// ─── Icon sizes ───────────────────────────────────────────────────────────────

export const iconSize = {
  sm:   15,
  md:   16,
  base: 20,
  lg:   24,
} as const;
