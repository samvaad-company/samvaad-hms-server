/**
 * Awareness programmes: a hospital posts a health camp, webinar, vaccination drive and so on; once published it appears in the patient
 * portal's awareness section and as a notification there. Shapes shared by the hospital screens and the portal API.
 */

export const AWARENESS_CATEGORIES = ["Health camp", "Webinar", "Vaccination drive", "Screening", "Awareness talk", "Campaign", "Other"] as const;
export type AwarenessCategory = (typeof AWARENESS_CATEGORIES)[number];

export const AWARENESS_MODES = ["In person", "Online"] as const;
export type AwarenessMode = (typeof AWARENESS_MODES)[number];

/** `all`: every patient on the portal. `hospital`: only the posting hospital's own patients. */
export const AWARENESS_AUDIENCES = ["all", "hospital"] as const;
export type AwarenessAudience = (typeof AWARENESS_AUDIENCES)[number];

export type AwarenessStatus = "Draft" | "Published" | "Cancelled";

/** What the hospital's staff see and edit. */
export interface AwarenessDTO {
  id: number;
  hospitalId: number;
  hospitalName: string;
  title: string;
  category: AwarenessCategory;
  summary: string;
  details: string;
  /** yyyy-mm-dd, or "" for a programme with no fixed day. */
  eventDate: string;
  /** HH:mm, or "". */
  eventTime: string;
  /** yyyy-mm-dd, or "" for a one-day programme. */
  endDate: string;
  mode: AwarenessMode;
  venue: string;
  /** Joining or registration link, for online programmes especially. */
  link: string;
  contact: string;
  audience: AwarenessAudience;
  /** An https link or a small data URL, or "". */
  image: string;
  status: AwarenessStatus;
  publishedAt: string | null;
  cancelledAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** How many patients have opened it in the portal. */
  reads: number;
}

export interface AwarenessInput {
  title: string;
  category: AwarenessCategory;
  summary: string;
  details?: string;
  eventDate?: string;
  eventTime?: string;
  endDate?: string;
  mode?: AwarenessMode;
  venue?: string;
  link?: string;
  contact?: string;
  audience?: AwarenessAudience;
  image?: string;
  /** Publish straight away instead of saving a draft. */
  publish?: boolean;
}

/** What the patient portal receives for one programme. */
export interface PortalAwarenessDTO {
  id: number;
  title: string;
  category: AwarenessCategory;
  summary: string;
  /** Only on the single-programme call; "" in lists. */
  details: string;
  eventDate: string;
  eventTime: string;
  endDate: string;
  mode: AwarenessMode;
  venue: string;
  link: string;
  contact: string;
  image: string;
  /** Published, or Cancelled for a programme patients may already have seen. */
  status: "Published" | "Cancelled";
  /** upcoming / ongoing / past by its dates; info when it has no date. */
  state: "upcoming" | "ongoing" | "past" | "info";
  publishedAt: string;
  hospital: { id: number; name: string; city: string };
  /** This patient has not opened it yet. */
  isNew: boolean;
}

export interface PortalAwarenessListDTO {
  items: PortalAwarenessDTO[];
  total: number;
  /** How many the patient has not opened. */
  unread: number;
  page: number;
  pageSize: number;
  categories: readonly string[];
}

export interface PortalNotificationDTO {
  /** The programme's id: use it to open the programme and to mark the notification read. */
  id: number;
  kind: "awareness_published" | "awareness_cancelled";
  title: string;
  body: string;
  eventId: number;
  hospitalName: string;
  category: AwarenessCategory;
  createdAt: string;
  read: boolean;
}

export interface PortalNotificationListDTO {
  unread: number;
  items: PortalNotificationDTO[];
}

/** What the HMS posts to the portal's webhook when a programme is published or cancelled. */
export interface AwarenessWebhookPayload {
  type: "awareness.published" | "awareness.cancelled";
  occurredAt: string;
  awareness: Omit<PortalAwarenessDTO, "isNew" | "details"> & { details: string; audience: AwarenessAudience; hospitalId: number };
}
