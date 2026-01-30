/**
 * RuleCard Component (PGP-F2.0 UX Overhaul)
 *
 * Visual card for the rules dashboard. Shows plain-language summaries,
 * category icons, match counts, and quick actions.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "@remix-run/react";
import { Badge, Tooltip } from "@shopify/polaris";
import type { Rule, RuleStatus } from "~/types/rules";
import {
  generateRuleSummary,
  getCategoryConfig,
  type RuleCategory,
} from "~/lib/rules/summary";
import { colors, borderRadius, spacing, shadows } from "~/styles/design-system";

// =============================================================================
// TYPES
// =============================================================================

interface RuleCardProps {
  rule: Rule;
  matchCount?: number;
  onToggleStatus: (rule: Rule) => void;
  onDelete: (rule: Rule) => void;
  onDuplicate: (rule: Rule) => void;
  onEdit: (rule: Rule) => void;
}

// =============================================================================
// CATEGORY ICONS (SVG)
// =============================================================================

const CATEGORY_ICONS: Record<RuleCategory, JSX.Element> = {
  variant: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a10 10 0 0 1 0 20" fill="currentColor" opacity="0.3" />
    </svg>
  ),
  traffic: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  ),
  mobile: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <line x1="12" y1="18" x2="12" y2="18" />
    </svg>
  ),
  customer: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  promotion: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  ),
  inventory: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    </svg>
  ),
  testing: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4" />
    </svg>
  ),
  regional: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  time: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  general: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

// =============================================================================
// CATEGORY BORDER COLORS
// =============================================================================

const CATEGORY_BORDER_COLORS: Record<string, string> = {
  primary: colors.primary[500],
  info: colors.info.main,
  success: colors.success.main,
  warning: colors.warning.main,
  critical: colors.critical.main,
  neutral: colors.neutral[400],
};

const CATEGORY_BG_COLORS: Record<string, string> = {
  primary: colors.primary[50],
  info: colors.info.light,
  success: colors.success.light,
  warning: colors.warning.light,
  critical: colors.critical.light,
  neutral: colors.neutral[100],
};

// =============================================================================
// COMPONENT
// =============================================================================

export function RuleCard({
  rule,
  matchCount,
  onToggleStatus,
  onDelete,
  onDuplicate,
  onEdit,
}: RuleCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const summary = generateRuleSummary(rule);
  const categoryConfig = getCategoryConfig(summary.category);
  const borderColor = CATEGORY_BORDER_COLORS[categoryConfig.color] || colors.neutral[400];
  const bgColor = CATEGORY_BG_COLORS[categoryConfig.color] || colors.neutral[100];

  const statusConfig: Record<
    RuleStatus,
    { tone: "success" | "attention" | "info" | "warning"; label: string }
  > = {
    active: { tone: "success", label: "Active" },
    paused: { tone: "attention", label: "Paused" },
    draft: { tone: "info", label: "Draft" },
    scheduled: { tone: "warning", label: "Scheduled" },
  };

  const status = statusConfig[rule.status];

  return (
    <div
      style={{
        background: colors.neutral[0],
        borderRadius: borderRadius.lg,
        border: `1px solid ${colors.neutral[200]}`,
        borderLeft: `4px solid ${borderColor}`,
        boxShadow: shadows.sm,
        transition: "box-shadow 0.2s, transform 0.2s",
        position: "relative",
        overflow: "visible",
        zIndex: menuOpen ? 10 : 1,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = shadows.md;
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = shadows.sm;
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div style={{ padding: spacing[4] }}>
        {/* Top row: icon + title + status + actions */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: spacing[3] }}>
          {/* Clickable area: icon + title + description */}
          <div
            role="button"
            tabIndex={0}
            style={{ display: "flex", gap: spacing[3], flex: 1, minWidth: 0, cursor: "pointer", textDecoration: "none", color: "inherit" }}
            onClick={() => navigate(`/app/rules/${rule.id}`)}
            onKeyDown={(e) => { if (e.key === "Enter") navigate(`/app/rules/${rule.id}`); }}
          >
          {/* Category icon */}
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: borderRadius.md,
              background: bgColor,
              color: borderColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {CATEGORY_ICONS[summary.category]}
          </div>

          {/* Title + description */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: spacing[2], marginBottom: spacing[1] }}>
              <span
                style={{
                  fontSize: "15px",
                  fontWeight: 600,
                  color: colors.neutral[900],
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {summary.title}
              </span>
              <Badge tone={status.tone}>{status.label}</Badge>
            </div>
            <div
              style={{
                fontSize: "13px",
                color: colors.neutral[600],
                lineHeight: 1.4,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {summary.description}
            </div>

            {/* Match count */}
            {matchCount !== undefined && matchCount > 0 && (
              <div
                style={{
                  display: "inline-block",
                  marginTop: spacing[2],
                  padding: `${spacing[0]} ${spacing[2]}`,
                  background: colors.neutral[100],
                  borderRadius: borderRadius.sm,
                  fontSize: "12px",
                  color: colors.neutral[600],
                }}
              >
                {matchCount.toLocaleString()} matches (7d)
              </div>
            )}
          </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: spacing[1], flexShrink: 0 }}>
            <Tooltip content={rule.status === "active" ? "Pause" : "Activate"}>
              <button
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); onToggleStatus(rule); }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: spacing[1],
                  borderRadius: borderRadius.sm,
                  color: rule.status === "active" ? colors.success.main : colors.neutral[400],
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {rule.status === "active" ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
            </Tooltip>

            {/* More menu */}
            <div ref={menuRef} style={{ position: "relative" }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(!menuOpen);
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: spacing[1],
                  borderRadius: borderRadius.sm,
                  color: colors.neutral[400],
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
              </button>

              {menuOpen && (
                <>
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      right: 0,
                      marginTop: "4px",
                      background: colors.neutral[0],
                      border: `1px solid ${colors.neutral[200]}`,
                      borderRadius: borderRadius.md,
                      boxShadow: shadows.lg,
                      zIndex: 1000,
                      minWidth: "140px",
                    }}
                  >
                    <button
                      onClick={() => {
                        console.log("[RuleCard] Edit clicked, navigating to /app/rules/" + rule.id);
                        setMenuOpen(false);
                        navigate(`/app/rules/${rule.id}`);
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: `${spacing[2]} ${spacing[3]}`,
                        fontSize: "14px",
                        color: colors.neutral[800],
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => { onDuplicate(rule); setMenuOpen(false); }}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: `${spacing[2]} ${spacing[3]}`,
                        fontSize: "14px",
                        color: colors.neutral[800],
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      Duplicate
                    </button>
                    <div style={{ borderTop: `1px solid ${colors.neutral[200]}` }} />
                    <button
                      onClick={() => { onDelete(rule); setMenuOpen(false); }}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: `${spacing[2]} ${spacing[3]}`,
                        fontSize: "14px",
                        color: colors.critical.main,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Expandable details */}
        {expanded && (
          <div
            style={{
              marginTop: spacing[3],
              padding: spacing[3],
              background: colors.neutral[50],
              borderRadius: borderRadius.md,
              fontSize: "13px",
              color: colors.neutral[700],
            }}
          >
            <div style={{ marginBottom: spacing[2] }}>
              <span style={{ fontWeight: 600, color: colors.neutral[500] }}>WHEN: </span>
              {summary.conditionSummary}
            </div>
            <div>
              <span style={{ fontWeight: 600, color: colors.neutral[500] }}>THEN: </span>
              {summary.actionSummary}
            </div>
          </div>
        )}

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: `${spacing[1]} 0 0 0`,
            fontSize: "12px",
            color: colors.primary[500],
            marginTop: spacing[2],
            display: "flex",
            alignItems: "center",
            gap: spacing[1],
          }}
        >
          {expanded ? "Hide details" : "Show details"}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>
    </div>
  );
}
