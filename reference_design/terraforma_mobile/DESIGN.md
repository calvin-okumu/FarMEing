# Design System Specification: The Tactile Earth

## 1. Overview & Creative North Star: "The Digital Agronomist"
This design system moves away from the sterile, "tech-first" look of typical SaaS apps. Our North Star is **The Digital Agronomist**: a professional, sophisticated editorial experience that feels as organic as the soil but as precise as a laboratory.

To break the "template" look, we utilize **Intentional Asymmetry**. We move away from centered, rigid grids in favor of left-heavy editorial layouts and overlapping elements. By using high-contrast typography scales and deep forest tones, we ensure the UI is legible under the harsh midday sun of a farm while maintaining a premium, "High-End Editorial" aesthetic.

---

## 2. Colors & Surface Architecture
We prioritize legibility and depth through tonal shifts rather than structural lines.

### Palette Strategy
*   **Primary (#00450d):** The Deep Forest. Used for high-authority headers and grounding elements.
*   **Primary Fixed (#a3f69c):** The Vibrant Sprout. Reserved for "Profit," growth indicators, and primary CTAs to ensure they pop against earth tones.
*   **Secondary (#7a5649):** The Silt. Earth tones for secondary actions and grounding supportive info.
*   **Tertiary (#7c000a):** The Warning. A clear, high-contrast red for "Loss" and expenses, optimized for outdoor visibility.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning. Boundaries must be defined solely through background color shifts. 
*   *Example:* A `surface-container-low` (#f5f3f1) section sitting on a `surface` (#fbf9f7) background.

### The Glass & Gradient Rule
To move beyond a "flat" mobile app feel:
*   **Hero Sections:** Use subtle linear gradients from `primary` (#00450d) to `primary_container` (#065f18) to provide a "soulful" depth.
*   **Floating Navigation:** Use `surface_container_lowest` (#ffffff) with an 80% opacity and a `24px` backdrop blur (Glassmorphism) to keep the UI feeling light and integrated with the content beneath.

---

## 3. Typography: The Bilingual Editorial
Our typography system is built to handle the varying word lengths of English and Kiswahili while maintaining a high-end magazine feel.

*   **Display & Headlines (Manrope):** We use Manrope for all large-scale type. It provides a modern, geometric character that feels professional.
    *   *Headline-LG (2rem):* Use for crop names and major financial totals.
*   **Body & Labels (Inter):** We switch to Inter for everything below 20px. Inter’s tall x-height makes it exceptionally legible for Kiswahili’s descriptive terminology in outdoor, high-glare environments.
    *   *Title-MD (1.125rem):* The primary "working" font for field labels and list titles.

---

## 4. Elevation & Depth: Tonal Layering
We reject the 2010-era "Drop Shadow." We create hierarchy through physical stacking.

*   **The Layering Principle:** Place a `surface_container_lowest` card (Pure White) on a `surface_container` (#efedec) background. The contrast is enough to define the edge without a border.
*   **Ambient Shadows:** If a card must "float" (e.g., a Quick-Action FAB), use a shadow tinted with `on_surface` (#1b1c1b) at 4% opacity with a `32px` blur. It should look like a soft glow, not a dark smudge.
*   **The "Ghost Border" Fallback:** If accessibility testing requires a container edge, use `outline_variant` (#c0c9bb) at **15% opacity**. It must be a whisper of a line, never a statement.

---

## 5. Components

### Cards & Containers
*   **Style:** All containers use the `md` (1.5rem / 24px) or `lg` (2rem / 32px) corner radius.
*   **Rule:** Forbid divider lines within cards. Separate content using the `3` (1rem) or `4` (1.4rem) spacing tokens.

### Buttons (The Interaction Core)
*   **Primary:** `primary_fixed` background with `on_primary_fixed` text. This provides maximum contrast for "Add Harvest" or "Sell" actions.
*   **Secondary:** `surface_container_high` background. Feels like a part of the page, not a separate entity.
*   **Touch Targets:** All buttons must have a minimum height of `12` (4rem / 64px) to accommodate gloved or weathered hands in the field.

### Data Inputs (High-Contrast Fields)
*   **Style:** Use "Filled" style with `surface_container_highest`. 
*   **Error State:** Use `error` (#ba1a1a) text with an `error_container` background. Avoid thin red outlines; use the background tint to signal the error area.

### Signature Agricultural Components
*   **Growth Chips:** Utilizing `primary_fixed_dim` with an icon to represent crop health or profit percentage.
*   **Climate Gauges:** Overlapping semi-circles using `secondary_container` to show soil moisture or humidity.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use asymmetrical layouts. A "Market Price" card can be wider than the "Weather" card next to it to create visual interest.
*   **Do** use Kiswahili-first testing. Ensure that "Maelezo ya mapato" (Income details) doesn't break your button widths.
*   **Do** utilize the full range of `surface-container` tokens to create a "nested" feel.

### Don’t
*   **Don’t** use pure black (#000000). Use `on_surface` (#1b1c1b) for better readability in high sun.
*   **Don’t** use 1px dividers. If you need to separate two list items, use a `1.5` (0.5rem) vertical gap or a slight color shift.
*   **Don’t** cram icons. Every icon must have a label in at least `label-md` size for clarity and accessibility.