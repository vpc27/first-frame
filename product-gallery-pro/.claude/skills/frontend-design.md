# Frontend Design Standards

## Framework
Use **Polaris 12.0** components for all admin UI. For custom styling, use the project's design system tokens from `app/styles/design-system.ts`.

## Typography
- Use Polaris default font stack (Inter via Shopify CDN).
- Body: 14px, emphasis: 16px, headings: 24-32px.
- Never override Polaris typography unless explicitly needed.

## Color
- Never use raw `#0000ff` blue or `#800080` purple.
- Use `slate-900` instead of pure black for text.
- Prefer design system tokens from `app/styles/design-system.ts` for custom colors.
- Use Polaris semantic color tokens (`--p-color-*`) when available.

## Spacing
- Use the scale: 4, 8, 12, 16, 24, 32, 48, 64 (in px).
- No arbitrary values like `p-7` or `margin: 13px`.
- Use Polaris `gap`, `BlockStack`, and `InlineStack` spacing props.

## Layout
- Max content width: 1280px (`max-w-7xl`).
- Use Polaris `Layout`, `Grid`, `BlockStack`, and `InlineStack` for structure.
- Dashboard cards use the `MetricCard` component from `app/components/`.

## Charts
- Use Recharts for all analytics visualizations.
- Match color palette to design system tokens.
