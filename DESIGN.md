# Sindhi Connect — Design System ("Midnight & Gold")

Tokens live at the top of `frontend/style.css`. Use them; don't hard-code new values.

## Color (from the logo)
| Token | Hex | Use |
|---|---|---|
| `--ink` | #0E1016 | Header, hero, footer, secondary buttons |
| `--gold` | #E9A825 | The single accent: primary buttons, stats, highlights on dark |
| `--gold-text` | #8A5D00 | Gold text on light backgrounds (passes AA) |
| `--red` | #A61E2A | Small accents only (icons, required marks) |
| `--paper` | #FAF8F4 | Alternating light sections |
| `--text` / `--muted` | #16181D / #565B66 | Body / secondary text on light |
| `--muted-dark` | #A9ADB8 | Secondary text on dark |

No gradients. Borders (1px `--line`) over shadows.

## Type
- Headings (h1, h2): **Fraunces** 600
- Body, UI, h3: **Inter** 400/500/600
- Sindhi text: **Noto Naskh Arabic**, always with `lang="sd" dir="rtl"`

## Spacing & shape
- 4px scale: `--s-1`…`--s-9` = 4, 8, 12, 16, 24, 32, 48, 64, 96
- Radius: 8px (buttons, inputs), 12px (cards, panels)
- Section padding: 96px desktop / 64px mobile

## Components
- **Buttons:** `.btn` + `.btn-primary` (gold) / `.btn-secondary` (ink) / `.btn-ghost` (on dark); `.btn-sm`, `.btn-block`. Min height 48px (40px small).
- **Section header:** `.eyebrow` label + `h2`.
- **Cards:** `.kh-cat`, `.kh-card`, `.video`, `.panel` — white, 1px border, 12px radius.
- **Knowledge Hub:** content lives in `frontend/resources.js`; `app.js` builds the cards. Covers without a thumbnail use the ajrak-inspired `--kh-motif` pattern on a per-category tone.
- **KPI strip:** `.stats` with `<dt>` label / `<dd>` value.
- **Form field:** `.field` > `label` + input; required marked with `.req`.

## Breakpoints
- ≤1024px tablet: 2-column grids, video list rows
- ≤760px mobile: single column, CSS-only menu toggle

## Motion
Color transitions only (≤150ms). Respect `prefers-reduced-motion`.
