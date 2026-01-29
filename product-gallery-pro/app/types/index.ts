/**
 * Shared type definitions for Product Gallery Pro
 */

// DATABASE MODELS

export interface Shop {
  id: string; // Shop domain
  access_token: string;
  scope: string;
  installed_at: string;
  uninstalled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  id?: number;
  shop_id: string;

  layout: "carousel" | "grid" | "stack";
  thumbnail_position: "bottom" | "left" | "right" | "none";
  thumbnail_size: "small" | "medium" | "large";

  enable_zoom: boolean;
  zoom_type: "hover" | "click" | "both";
  zoom_level: number;

  variant_filtering: boolean;
  lazy_loading: boolean;
  autoplay_video: boolean;

  enable_analytics: boolean;
  enable_ai: boolean;

  image_fit: "contain" | "cover" | "auto";

  created_at?: string;
  updated_at?: string;
}

export type EventType =
  | "gallery_load"
  | "gallery_view"
  | "slide_change"
  | "zoom_hover"
  | "zoom_click"
  | "lightbox_close"
  | "video_play"
  | "video_complete"
  | "thumbnail_click"
  | "variant_filter";

export interface AnalyticsEvent {
  id: number;
  shop_id: string;
  product_id: string;
  image_id: string | null;
  event_type: EventType;
  event_data: Record<string, unknown>;
  session_id: string;
  device_type: "mobile" | "tablet" | "desktop";
  created_at: string;
}

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface OnboardingState {
  dismissed: boolean;
  dismissedAt: string | null;
}

