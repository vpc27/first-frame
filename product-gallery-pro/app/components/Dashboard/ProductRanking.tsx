/**
 * ProductRanking Component
 * Shows top performing products with views, time in gallery, and swipe depth.
 * Displays 10 by default with expandable "View All".
 * Clicking a product opens a modal with per-image analytics.
 */

import { useState, useCallback } from "react";
import { colors, borderRadius, spacing } from "~/styles/design-system";
import type { ProductImageAnalytics, ImageAnalyticsEntry } from "~/lib/analyticsMetafields.server";

interface Product {
  productId: string;
  title: string;
  views: number;
  engagementRate: number;
  avgActiveTimeSec: number;
  avgSwipeDepth: number;
}

interface ProductRankingProps {
  products: Product[];
  title?: string;
  initialCount?: number;
}

interface MediaNode {
  id: string;
  alt: string | null;
  mediaContentType?: string;
  image?: { url: string; altText: string | null } | null;
  preview?: { image: { url: string } | null } | null;
}

interface ModalData {
  productTitle: string;
  media: MediaNode[];
  imageAnalytics: ProductImageAnalytics | null;
}

/** Default minimum sessions before showing data. Set to 0 to always show. */
const MIN_SESSIONS_THRESHOLD = 0;

/** Extract numeric ID from either "12345" or "gid://shopify/MediaImage/12345" */
function numericId(id: string | undefined | null): string {
  if (!id) return "";
  const match = id.match(/(\d+)$/);
  return match ? match[1] : id;
}

function getRecommendation(
  entry: ImageAnalyticsEntry,
  position: number,
  totalImages: number,
  totalProductSessions: number,
  isVideo: boolean,
): string {
  if (totalImages <= 1) return "\u2014";
  const seenPct = totalProductSessions > 0 ? entry.sessions / totalProductSessions : 0;
  const zoomRate = entry.sessions > 0 ? entry.zoomSessions / entry.sessions : 0;
  const avgTimeMs = entry.sessions > 0 ? entry.totalActiveTimeMs / entry.sessions : 0;
  const engagement = isVideo
    ? Math.min(avgTimeMs / 5000, 1)
    : zoomRate * 0.5 + Math.min(avgTimeMs / 5000, 1) * 0.5;

  if (position === 0 && engagement < 0.1 && totalImages > 2)
    return "\uD83D\uDD04 Consider replacing hero image";
  if (position === 0) return "\u2014";
  if (seenPct < 0.4 && engagement > 0.4) return "\uD83D\uDD3C Move earlier";
  if (seenPct > 0.6 && engagement < 0.15) return "\uD83D\uDD3D Consider moving down";
  if (seenPct < 0.2 && engagement < 0.1) return "\uD83D\uDDD1 Remove or replace";
  if (isVideo && seenPct < 0.3) return "\uD83D\uDD3C Move up / add thumbnail";
  return "\u2014";
}

function getZoomLabel(
  zoomSessions: number,
  sessions: number,
  isVideo: boolean,
): { label: string; color: string } {
  if (isVideo) return { label: "N/A", color: colors.neutral[400] };
  if (sessions === 0) return { label: "None", color: colors.neutral[400] };
  const rate = zoomSessions / sessions;
  if (rate > 0.3) return { label: "High", color: colors.success.main };
  if (rate > 0.15) return { label: "Medium", color: colors.warning.main };
  if (rate > 0) return { label: "Low", color: colors.neutral[600] };
  return { label: "None", color: colors.neutral[400] };
}

export function ProductRanking({
  products,
  title = "Top Products",
  initialCount = 10,
}: ProductRankingProps) {
  const [expanded, setExpanded] = useState(false);
  const [modalData, setModalData] = useState<ModalData | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalProductTitle, setModalProductTitle] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const openModal = useCallback(async (product: Product) => {
    setModalProductTitle(product.title);
    setModalLoading(true);
    setModalData(null);
    setModalError(null);
    setModalOpen(true);
    try {
      const res = await fetch(
        `/app/api/product-image-analytics?productId=${encodeURIComponent(product.productId)}`,
      );
      if (!res.ok) {
        setModalError(`Failed to load (${res.status})`);
        return;
      }
      const data = (await res.json()) as ModalData;
      setModalData(data);
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setModalLoading(false);
    }
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setModalData(null);
    setModalLoading(false);
    setModalError(null);
    setModalProductTitle("");
  }, []);

  const containerStyle = {
    background: colors.neutral[0],
    borderRadius: borderRadius.lg,
    border: `1px solid ${colors.neutral[200]}`,
    padding: spacing[5],
  };

  if (!products || products.length === 0) {
    return (
      <div style={containerStyle}>
        <h3
          style={{
            fontSize: "15px",
            fontWeight: 600,
            color: colors.neutral[900],
            margin: `0 0 ${spacing[4]} 0`,
          }}
        >
          {title}
        </h3>
        <div
          style={{
            padding: spacing[6],
            textAlign: "center",
            background: colors.neutral[50],
            borderRadius: borderRadius.md,
            border: `1px dashed ${colors.neutral[300]}`,
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: borderRadius.full,
              background: colors.neutral[100],
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto",
              marginBottom: spacing[3],
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.neutral[400]}
              strokeWidth="2"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <p style={{ fontSize: "13px", color: colors.neutral[600], margin: 0 }}>
            No product data yet
          </p>
        </div>
      </div>
    );
  }

  const displayProducts = expanded ? products : products.slice(0, initialCount);
  const hasMore = products.length > initialCount;
  const maxViews = Math.max(...products.map((p) => p.views));

  const rankColors = [
    colors.primary[500],
    colors.primary[400],
    colors.primary[300],
  ];

  const isModalOpen = modalOpen;

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: spacing[3],
        }}
      >
        <h3
          style={{
            fontSize: "15px",
            fontWeight: 600,
            color: colors.neutral[900],
            margin: 0,
          }}
        >
          {title}
        </h3>
        <span style={{ fontSize: "12px", color: colors.neutral[500] }}>
          {products.length} product{products.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Column headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "32px 1fr 56px 48px 48px",
          gap: spacing[2],
          padding: `0 0 ${spacing[2]} 0`,
          borderBottom: `1px solid ${colors.neutral[100]}`,
          marginBottom: spacing[2],
        }}
      >
        <span />
        <span style={{ fontSize: "11px", fontWeight: 600, color: colors.neutral[400], textTransform: "uppercase" }}>
          Product
        </span>
        <span
          style={{ fontSize: "11px", fontWeight: 600, color: colors.neutral[400], textTransform: "uppercase", textAlign: "right" }}
          title="Total gallery views for this product"
        >
          Views
        </span>
        <span
          style={{ fontSize: "11px", fontWeight: 600, color: colors.neutral[400], textTransform: "uppercase", textAlign: "right" }}
          title="Average active interaction time per session (seconds)"
        >
          Time
        </span>
        <span
          style={{ fontSize: "11px", fontWeight: 600, color: colors.neutral[400], textTransform: "uppercase", textAlign: "right" }}
          title="Average deepest image index reached per session"
        >
          Depth
        </span>
      </div>

      {/* Product rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {displayProducts.map((product, index) => (
          <div
            key={product.productId}
            onClick={() => openModal(product)}
            style={{
              display: "grid",
              gridTemplateColumns: "32px 1fr 56px 48px 48px",
              gap: spacing[2],
              alignItems: "center",
              padding: `${spacing[2]} 0`,
              borderRadius: borderRadius.sm,
              cursor: "pointer",
            }}
            title={`${product.title} — click for image analytics`}
          >
            {/* Rank */}
            <div
              style={{
                width: "24px",
                height: "24px",
                borderRadius: borderRadius.full,
                background: index < 3 ? rankColors[index] : colors.neutral[100],
                color: index < 3 ? colors.neutral[0] : colors.neutral[600],
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "11px",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {index + 1}
            </div>

            {/* Name + bar */}
            <div style={{ minWidth: 0 }}>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: colors.neutral[800],
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "block",
                }}
                title={product.title}
              >
                {product.title}
              </span>
              <div
                style={{
                  height: "3px",
                  background: colors.neutral[100],
                  borderRadius: borderRadius.full,
                  overflow: "hidden",
                  marginTop: "3px",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${(product.views / maxViews) * 100}%`,
                    background: index < 3 ? rankColors[index] : colors.primary[200],
                    borderRadius: borderRadius.full,
                  }}
                />
              </div>
            </div>

            {/* Views */}
            <span
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: colors.neutral[800],
                textAlign: "right",
                fontFeatureSettings: "'tnum' on",
              }}
            >
              {product.views.toLocaleString()}
            </span>

            {/* Avg Time */}
            <span
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: colors.neutral[600],
                textAlign: "right",
                fontFeatureSettings: "'tnum' on",
              }}
            >
              {product.avgActiveTimeSec > 0 ? `${product.avgActiveTimeSec}s` : "\u2014"}
            </span>

            {/* Swipe Depth */}
            <span
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: colors.neutral[600],
                textAlign: "right",
                fontFeatureSettings: "'tnum' on",
              }}
            >
              {product.avgSwipeDepth > 0 ? product.avgSwipeDepth : "\u2014"}
            </span>
          </div>
        ))}
      </div>

      {/* View All / Collapse */}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            display: "block",
            width: "100%",
            marginTop: spacing[3],
            padding: `${spacing[2]} 0`,
            background: "none",
            border: `1px solid ${colors.neutral[200]}`,
            borderRadius: borderRadius.md,
            color: colors.primary[500],
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          {expanded ? "Show Less" : `View All ${products.length} Products`}
        </button>
      )}

      {/* Image Analytics Modal */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            style={{
              background: colors.neutral[0],
              borderRadius: borderRadius.lg,
              width: "min(900px, 95vw)",
              maxHeight: "85vh",
              overflow: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              padding: spacing[5],
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: spacing[4],
              }}
            >
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: 600,
                  color: colors.neutral[900],
                  margin: 0,
                }}
              >
                Image Performance: {modalProductTitle}
              </h3>
              <button
                onClick={closeModal}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "20px",
                  color: colors.neutral[500],
                  padding: "4px 8px",
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            {modalLoading && (
              <div style={{ padding: spacing[6], textAlign: "center", color: colors.neutral[500] }}>
                Loading image analytics...
              </div>
            )}

            {!modalLoading && modalError && (
              <div style={{ padding: spacing[5], textAlign: "center", color: "#991b1b", background: "#fee2e2", borderRadius: borderRadius.md }}>
                {modalError}
              </div>
            )}

            {!modalLoading && !modalError && modalData && renderImageTable(modalData)}
          </div>
        </div>
      )}
    </div>
  );
}

function renderImageTable(data: ModalData) {
  const { media, imageAnalytics } = data;

  if (!imageAnalytics || imageAnalytics.totalProductSessions < MIN_SESSIONS_THRESHOLD) {
    const count = imageAnalytics?.totalProductSessions ?? 0;
    return (
      <div
        style={{
          padding: spacing[5],
          textAlign: "center",
          background: colors.neutral[50],
          borderRadius: borderRadius.md,
          border: `1px solid ${colors.neutral[200]}`,
        }}
      >
        <p style={{ fontSize: "14px", color: colors.neutral[600], margin: 0 }}>
          Insufficient data — at least 5 sessions needed.
          {count > 0 ? ` (${count} session${count === 1 ? "" : "s"} so far)` : ""}
        </p>
      </div>
    );
  }

  const totalSessions = imageAnalytics.totalProductSessions;
  const totalImages = media.length;

  const headerStyle: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 600,
    color: colors.neutral[400],
    textTransform: "uppercase",
    padding: `${spacing[2]} ${spacing[3]}`,
    textAlign: "left",
    borderBottom: `2px solid ${colors.neutral[200]}`,
  };

  const cellStyle: React.CSSProperties = {
    fontSize: "13px",
    color: colors.neutral[800],
    padding: `${spacing[3]} ${spacing[3]}`,
    borderBottom: `1px solid ${colors.neutral[100]}`,
    verticalAlign: "middle",
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          minWidth: "700px",
        }}
      >
        <thead>
          <tr>
            <th style={headerStyle}>Image</th>
            <th style={{ ...headerStyle, textAlign: "center" }}>Position</th>
            <th style={{ ...headerStyle, textAlign: "center" }}>Type</th>
            <th style={{ ...headerStyle, textAlign: "center" }}>Seen By</th>
            <th style={{ ...headerStyle, textAlign: "center" }}>Avg Time</th>
            <th style={{ ...headerStyle, textAlign: "center" }}>Zoom Used</th>
            <th style={headerStyle}>Recommendation</th>
          </tr>
        </thead>
        <tbody>
          {media.map((m, idx) => {
            const entry = imageAnalytics.images.find(
              (e) => numericId(e.mediaId) === numericId(m.id),
            );
            const sessions = entry?.sessions ?? 0;
            const zoomSessions = entry?.zoomSessions ?? 0;
            const totalActiveTimeMs = entry?.totalActiveTimeMs ?? 0;
            const isVideo = m.mediaContentType === "VIDEO" || m.mediaContentType === "EXTERNAL_VIDEO";
            const thumbUrl = m.image?.url || m.preview?.image?.url;

            const seenPct = totalSessions > 0 ? Math.round((sessions / totalSessions) * 100) : 0;
            const avgTimeSec = sessions > 0
              ? Math.round((totalActiveTimeMs / sessions / 1000) * 10) / 10
              : 0;
            const zoom = getZoomLabel(zoomSessions, sessions, isVideo);
            const rec = entry
              ? getRecommendation(entry, idx, totalImages, totalSessions, isVideo)
              : "\u2014";

            return (
              <tr key={m.id}>
                <td style={cellStyle}>
                  {thumbUrl ? (
                    <div style={{ position: "relative", width: "40px", height: "40px" }}>
                      <img
                        src={thumbUrl + (thumbUrl.includes("?") ? "&" : "?") + "width=48"}
                        alt={m.alt ?? ""}
                        style={{
                          width: "40px",
                          height: "40px",
                          objectFit: "cover",
                          borderRadius: borderRadius.sm,
                          border: `1px solid ${colors.neutral[200]}`,
                        }}
                      />
                      {isVideo && (
                        <div style={{
                          position: "absolute", inset: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: "rgba(0,0,0,0.3)", borderRadius: borderRadius.sm,
                        }}>
                          <span style={{ color: "#fff", fontSize: "16px" }}>&#9654;</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        background: colors.neutral[100],
                        borderRadius: borderRadius.sm,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "10px",
                        color: colors.neutral[500],
                      }}
                    >
                      {isVideo ? "VID" : "IMG"}
                    </div>
                  )}
                </td>
                <td style={{ ...cellStyle, textAlign: "center", fontWeight: 600 }}>
                  {idx + 1}
                </td>
                <td style={{ ...cellStyle, textAlign: "center" }}>
                  {isVideo ? "Video" : "Image"}
                </td>
                <td style={{ ...cellStyle, textAlign: "center", fontFeatureSettings: "'tnum' on" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: borderRadius.full,
                      fontSize: "12px",
                      fontWeight: 600,
                      background: seenPct >= 60 ? "#dcfce7" : seenPct >= 30 ? "#fef9c3" : "#fee2e2",
                      color: seenPct >= 60 ? "#166534" : seenPct >= 30 ? "#854d0e" : "#991b1b",
                    }}
                  >
                    {seenPct}%
                  </span>
                </td>
                <td style={{ ...cellStyle, textAlign: "center", fontFeatureSettings: "'tnum' on" }}>
                  {avgTimeSec}s
                </td>
                <td style={{ ...cellStyle, textAlign: "center" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: borderRadius.full,
                      fontSize: "12px",
                      fontWeight: 500,
                      color: zoom.color,
                      background: colors.neutral[50],
                      border: `1px solid ${colors.neutral[200]}`,
                    }}
                  >
                    {zoom.label}
                  </span>
                </td>
                <td style={{ ...cellStyle, fontSize: "12px" }}>
                  {rec}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
