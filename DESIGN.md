# Commerce Studio Design System

## Source Direction

This app follows an adapted `awesome-design-md` direction:

- Primary reference: Shopify transactional surfaces, using a light commerce canvas, black pill CTAs, mint/aloe accents, and clean storefront-tool typography.
- Secondary reference: Linear product density, using restrained hairline borders, compact panels, and the product workspace as the main visual subject.
- Open-source UI references: `satnaing/shadcn-admin` for dense admin navigation and metrics, `shadcnstore/shadcn-dashboard-landing-template` for restrained SaaS cards, `htmlstreamofficial/awesome-dashboard-ui-kit` for dashboard component coverage, and `VoltAgent/awesome-design-md` for keeping the design rules explicit.

The product is a working seller tool. The homepage may introduce the product, but it must route directly into the production workspace and avoid generic marketing filler.

## Visual Theme

- Professional cross-border ecommerce tooling.
- Calm, high-density, and operational.
- Avoid domestic promo-poster styling, large marketing heroes, decorative gradients, and ornamental backgrounds.
- Let product images, generation results, settings, and task history carry the page.

## Color Roles

- Canvas: `#f7f8f5`, a very light commerce surface.
- Primary surface: `#ffffff`.
- Soft surface: `#fbfbf5`.
- Aloe accent: `#c1fbd4`, reserved for active nav, primary selected states, and featured pricing.
- Pistachio accent: `#d4f9e0`, reserved for chips, status surfaces, and quiet emphasis.
- Ink: `#111111`.
- Muted text: `#52525b`.
- Subtle text: `#71717a`.
- Hairline: `#e4e4e7`.
- Strong hairline: `#cfd4d8`.
- Error: `#9f2d20` on `#fff3ef`.

## Typography

- Use Inter or system sans.
- Use normal letter spacing except uppercase eyebrows.
- Keep headings compact inside panels.
- Reserve large display type for real marketing pages, not the workspace.

## Components

- Buttons use pill geometry (`999px`) across top navigation, primary actions, secondary actions, and task actions.
- Panels and repeated cards use compact `8px` corners.
- Inputs use `8px` corners, 42px minimum height, and clear focus rings.
- Status badges use pill geometry and semantic fills.
- Cards must not be nested inside other cards.

## Layout

- Desktop workspace is three columns: module/history, upload/result preview, parameters.
- Current studio pages use a two-zone production desk: left settings, right preview. The top summary is allowed because it gives operational context without turning the page into a landing page.
- Homepage first screen uses a real visual asset as the main signal, with direct entry cards for 商品主图, 白底图, and 详情页. It should leave the tool workflow visible through CTAs, not hide the product behind brand storytelling.
- Tablet and mobile collapse to a vertical workflow: modules, product input, preview, parameters, history.
- Avoid horizontal overflow at every viewport.
- Keep product and result previews stable with fixed aspect ratios.

## Interaction Rules

- Keep the generation flow unchanged: choose product, adjust parameters, generate, inspect result, download or reuse task.
- Failed tasks must show clear reasons and support retry when the product source is still available.
- Uploaded blob product sources must not be reused after reload.
- Navigation must preserve the mounted workspace and in-flight generation state.
