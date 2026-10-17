---
name: SmartToll
description: A soft, airy toll route planner where every trip reads as a route line, in sign green and lane amber.
colors:
  sign-green: "#0B4F3F"
  overhead-green: "#12261F"
  verge-green: "#2F8F5B"
  green-wash: "#E2F0E8"
  lane-amber: "#E8A33D"
  amber-deep: "#A86E18"
  amber-wash: "#FCEFD8"
  stop-red: "#C1442E"
  red-wash: "#FBE8E3"
  route-blue: "#2F6FD6"
  sky-wash: "#E4EEFB"
  mint-ground: "#EEF3EF"
  surface: "#FFFFFF"
  field: "#F5F8F6"
  hairline: "#E1E8E3"
  action: "#12261F"
  ink: "#14201C"
  ink-soft: "#55665D"
  ink-faint: "#5F6F66"
  sign-mint: "#A9CDBB"
  plaza-entry: "#16A34A"
  plaza-exit: "#EA580C"
  night-sign-green: "#2E9E78"
  night-verge-green: "#3DB37A"
  night-green-wash: "#163327"
  night-amber-deep: "#E0A74F"
  night-amber-wash: "#3A2C12"
  night-stop-red: "#E5684F"
  night-red-wash: "#3D1E19"
  night-route-blue: "#6FA2F0"
  night-sky-wash: "#16263D"
  night-ground: "#0D1412"
  night-surface: "#16201C"
  night-field: "#1D2924"
  night-hairline: "#25332D"
  night-action: "#DCEBE3"
  night-ink: "#E6EEEA"
  night-ink-soft: "#A7B8AF"
  night-ink-faint: "#8A9C92"
typography:
  display:
    fontFamily: "Manrope, sans-serif"
    fontSize: "30px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Manrope, sans-serif"
    fontSize: "21px"
    fontWeight: 600
    lineHeight: 1.29
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Manrope, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  label:
    fontFamily: "Manrope, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: "normal"
  button:
    fontFamily: "Manrope, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
  figure:
    fontFamily: "Manrope, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "\"tnum\""
  signage:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "0.01em"
rounded:
  sm: "8px"
  md: "16px"
  tile: "22px"
  lg: "24px"
  sheet: "28px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  gap: "10px"
  md: "16px"
  card: "18px"
  card-web: "26px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.surface}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "14px 22px"
    height: "52px"
  button-primary-night:
    backgroundColor: "{colors.night-action}"
    textColor: "{colors.night-ground}"
  button-amber:
    backgroundColor: "{colors.lane-amber}"
    textColor: "{colors.overhead-green}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "14px 22px"
    height: "52px"
  button-secondary:
    backgroundColor: "{colors.field}"
    textColor: "{colors.sign-green}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "14px 22px"
    height: "52px"
  button-danger:
    backgroundColor: "{colors.stop-red}"
    textColor: "{colors.surface}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "14px 22px"
    height: "52px"
  button-text:
    textColor: "{colors.sign-green}"
    typography: "{typography.button}"
    padding: "6px 4px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card}"
  card-night:
    backgroundColor: "{colors.night-surface}"
  figure-tile-green:
    backgroundColor: "{colors.green-wash}"
    textColor: "{colors.ink}"
    typography: "{typography.figure}"
    rounded: "{rounded.tile}"
    padding: "16px"
  figure-tile-amber:
    backgroundColor: "{colors.amber-wash}"
    textColor: "{colors.ink}"
    typography: "{typography.figure}"
    rounded: "{rounded.tile}"
    padding: "16px"
  figure-tile-sky:
    backgroundColor: "{colors.sky-wash}"
    textColor: "{colors.ink}"
    typography: "{typography.figure}"
    rounded: "{rounded.tile}"
    padding: "16px"
  field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "9px 16px"
    height: "60px"
  field-label:
    textColor: "{colors.ink-soft}"
    typography: "{typography.label}"
  option-selected:
    backgroundColor: "{colors.green-wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "14px"
  badge-ok:
    backgroundColor: "{colors.green-wash}"
    textColor: "{colors.sign-green}"
    rounded: "{rounded.pill}"
    padding: "5px 11px"
  badge-warn:
    backgroundColor: "{colors.amber-wash}"
    textColor: "{colors.amber-deep}"
    rounded: "{rounded.pill}"
    padding: "5px 11px"
  badge-danger:
    backgroundColor: "{colors.red-wash}"
    textColor: "{colors.stop-red}"
    rounded: "{rounded.pill}"
    padding: "5px 11px"
  price-pill:
    backgroundColor: "{colors.action}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  tab-active:
    backgroundColor: "{colors.green-wash}"
    textColor: "{colors.sign-green}"
    rounded: "{rounded.pill}"
    width: "56px"
    height: "30px"
  tab-plan-button:
    backgroundColor: "{colors.lane-amber}"
    textColor: "{colors.overhead-green}"
    rounded: "{rounded.pill}"
    size: "58px"
  sheet:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.sheet}"
    padding: "20px"
  driving-banner:
    backgroundColor: "{colors.overhead-green}"
    textColor: "{colors.surface}"
    typography: "{typography.signage}"
    rounded: "{rounded.md}"
    padding: "14px"
---

# Design System: SmartToll

<!-- The Creative North Star name below is a proposal derived from the built system; it has not yet been confirmed by the user. -->

## Overview

**Creative North Star: "The Dotted Road"**

Every trip in SmartToll is drawn the same way: an origin, a dotted road carrying the time and distance, and a destination marked by a sign-green pin. The rest of the system is built to give that line room. A pale mint-grey ground holds white, borderless cards with generous 24 px corners and one soft green-tinted lift; actions are pills; fields read like a ticket, with the label sitting inside above the value. The softness and airiness are borrowed from consumer travel apps, but the colour stays SmartToll's own: sign green for links, icons and selection, near-black overhead green for primary actions, and lane amber reserved for the one "go" action per screen.

The mood is clear, sturdy and trustworthy. Titles are large, sentence-case and medium weight, so the hierarchy feels calm; the weight is spent on figures instead (pesos, kilometres, minutes in Manrope 800), because the toll is the number the motorist came for. Pastel washes (green, amber, sky) carry figure tiles, badges, notices and selected states; they are tinted toward the road's green, never lavender.

On the road the system changes register on purpose. The Trip in Progress screen is a high-contrast gantry sign: overhead-green direction banners, Barlow Condensed uppercase plaza names and figures, thick outlines on toll alerts. The softness is for planning at home; the driving screen is for a glance. The app ships Light, Dark and System appearances; the website is light only. Confirmed rejections: the lavender consumer-travel template (candy tiles, illustrated mascots), gradients and glassy effects, and promo clutter (vouchers, points, discount banners, ratings, favourite hearts).

**Key Characteristics:**
- Trips drawn as route lines: origin, dotted road with time and km, destination with a green pin.
- Pale mint-grey ground, white borderless 24 px cards, one soft green-tinted shadow.
- Pill buttons: near-black overhead green for primary, amber only for the single "go" action.
- Borderless tinted fields with the label inside, above the value.
- Manrope throughout: medium sentence-case titles, heavy tabular figures.
- Barlow Condensed only for driving signage, the wordmark and the route illustration's fees.
- A bold, high-contrast driving screen that deliberately leaves the soft world.

## Colors

Sign green and lane amber on a pale mint ground, softened by green, amber and sky washes; a lifted, inverted twin for night.

### Primary
- **Sign Green** (#0B4F3F): links, icons, selected options and their check marks, active navigation text, the destination pin of the route line, the toll-road line on the map, avatars and the logo tile. In Dark it lifts to Night Sign Green (#2E9E78) so green text stays readable.
- **Overhead Green** (#12261F): the near-black green of an expressway gantry. It is the primary pill button (as the `action` token), the toll price pill on trip rows, the website's admin top bar, the login hero, and the driving screen's direction banner and next-plaza sign (dark in both themes).
- **Green Wash** (#E2F0E8): the first figure tile, the active pill behind a tab or sidebar icon, selected options, success badges and notices, empty-state icon discs.

### Secondary
- **Lane Amber** (#E8A33D): the one "go" action per screen (Plan a Trip on Home, the raised Plan button in the tab bar), the amber ring on dark heroes, the focus outline on the web, fee figures on dark gantry panels.
- **Amber Deep** (#A86E18): warning text on Amber Wash, the "TOLL" half of the wordmark on light grounds.
- **Amber Wash** (#FCEFD8): the second figure tile, warning badges and notices.

### Tertiary
- **Route Blue** (#2F6FD6): the free-road line and the motorist's position on the map, info notices.
- **Sky Wash** (#E4EEFB): the third figure tile and info notices.
- **Stop Red** (#C1442E) with **Red Wash** (#FBE8E3): errors, low-balance values and badges, danger buttons, the tracking dot on History.
- **Plaza Entry** (#16A34A) and **Plaza Exit** (#EA580C): toll-plaza entry and exit markers on the map only.

### Neutral
- **Mint Ground** (#EEF3EF): the page ground under everything, including the app header, which sits on the ground with no bar of its own.
- **Surface** (#FFFFFF): cards, sheets, the tab bar, the website top bar and sidebar, the fourth (plain) figure tile.
- **Field** (#F5F8F6): borderless fields, option rows, secondary buttons, round icon buttons and close buttons.
- **Hairline** (#E1E8E3): row dividers inside cards, skeleton bones, the website's top bar and sidebar edges.
- **Ink** (#14201C): main text and the route line's origin dot. **Ink Soft** (#55665D): subtitles, field labels, inactive navigation. **Ink Faint** (#5F6F66): meta lines, placeholders, the dotted road itself.
- **Sign Mint** (#A9CDBB): soft text on overhead green.

### Named Rules
**The One Amber Go Rule.** One amber pill per screen, and it is the action that moves the trip forward. Text and icons on amber are Overhead Green (#12261F), never white.

**The Green Wash Rule.** Pastels are green, amber and sky washes tinted toward the road; figure tiles run green, amber, sky, then plain white. Never lavender, never candy colours.

**The Night Lift Rule.** In Dark, sign green lifts to #2E9E78, the primary pill inverts to a pale #DCEBE3 with dark text, and cards gain a quiet #25332D outline because shadows no longer show. The driving screen's overhead-green banners stay dark in both themes; the night map draws the toll road in Night Verge Green (#3DB37A).

## Typography

**Display Font:** Manrope (with sans-serif)
**Body Font:** Manrope (with sans-serif)
**Label/Mono Font:** Barlow Condensed (with sans-serif), for driving signage only

**Character:** One friendly geometric sans carries the whole planning world, light in its titles and heavy in its numbers. Barlow Condensed is the road sign: it appears where the motorist reads at a glance.

### Hierarchy
- **Display** (500, 30px app / 34px web, 1.15–1.2): page titles and the Home greeting ("Hi, Juan"), sentence case. The web steps down to 30px at tablet and 27px on mobile; the login hero runs 32px.
- **Headline** (600, 21px, 1.29): sheet and empty-state titles, the large route line on trip detail (21px app, 28px web).
- **Title** (700, 16px): card titles, paired with a 17px sign-green icon.
- **Body** (400, 14.5px, 1.45): running text and notices (notices at 500). Muted lines use Ink Soft at 14px.
- **Label** (500, 12px): field labels inside fields, meta lines, badge text (600).
- **Figure** (800, 22px app / 28px web, tabular): pesos, kilometres, counts on figure tiles and totals.
- **Button** (700, 15px app / 14px web): every button label, sentence case.
- **Signage** (Barlow Condensed 800, 18–28px, uppercase on plaza names): the driving screen's next-plaza sign, toll alert names, distances and stat figures; the SMARTTOLL wordmark; fees on the dark route illustration.

### Named Rules
**The Medium Title Rule.** Titles are large, medium weight and sentence case; heaviness belongs to figures. A heading never shouts in bold uppercase.

**The Signage Stays On The Road Rule.** Barlow Condensed appears only on the driving screen, in the wordmark and in the route illustration's fees. Planning screens are all Manrope.

**The Standalone Heading Rule.** A heading stands on its own: no small caption or uppercase line above it. Dialog titles say what they are.

## Layout

The app is a single scrolling column on the mint ground with 16px page padding (plus safe-area insets in landscape) and 32px bottom padding. Cards stack with 14px between them; card insides use 18px padding and 12px between a card title and its content. Home opens with the greeting, two side-by-side pill actions (10px gap), then a two-by-two grid of figure tiles (10px gap), then cards. Rows inside cards are separated by hairlines with 11–14px vertical padding.

The website uses a white top bar (14px by 32px padding) and a 232px white sidebar of pill links over a main column (32px by 40px padding, 1240px max). Cards pad 26px; grids use 16px gaps; figure tiles run four across. At 1024px the sidebar collapses to a 68px icon rail and grids drop to two or one columns; at 480px the sidebar gives way to a white bottom tab bar, modals become bottom sheets with 28px top corners, and cards pad 18px, matching the app.

## Elevation & Depth

A hybrid of tonal layering and one soft lift. White cards rise off the mint ground with a single diffuse, green-tinted shadow; pastel figure tiles sit flat on their tint with no shadow, and only the plain white tile gets the lift. Dialogs and dropdowns use a deeper version of the same tint. At night shadows are invisible, so cards carry a hairline outline instead. Dark hero panels (app login, web auth panel and route illustration) add one faint amber ring (10% opacity) bleeding off a corner as their only ornament.

### Shadow Vocabulary
- **Card lift, app** (`shadowColor #0B261F, opacity 0.07, radius 20, offset 0 8, elevation 3`): cards, the white Home action pill, the plain figure tile, the tab bar, the raised Plan button (elevation 6).
- **Card lift, web** (`box-shadow: 0 2px 4px rgba(11,38,31,0.03), 0 10px 28px rgba(11,38,31,0.07)`): cards, empty states, map labels and legends.
- **Modal** (`box-shadow: 0 24px 64px rgba(11,38,31,0.22), 0 4px 16px rgba(11,38,31,0.10)`): dialogs and search dropdowns.
- **Field focus** (`box-shadow: 0 0 0 4px rgba(47,143,91,0.12)` with a Verge Green border): focused fields and open search selects on the web.

### Named Rules
**The One Soft Lift Rule.** There is one shadow, tinted with overhead green, and it is soft. No hard offsets, no stacked glows, no glass or blur, no gradients.

## Shapes

Generous, consistent rounding. Containers use 24px (cards, empty states, the dark route illustration, the map block); figure tiles 22px; sheets and dialogs 28px at the top; fields, option rows and notices 16px; small inner pieces 8px (skeleton bones run 6px). Every action and every status is a pill (999px): buttons, badges, the toll price, the active tab and sidebar marker, saved-route chips. Icons sit in circles: 34–40px white or green-wash discs on figure tiles, 36px avatars and close buttons, 64–72px empty-state discs. The login hero has a rounded foot (32px bottom corners). Cards are borderless by day; hairlines divide rows, not containers.

## Components

### Buttons
Soft, confident pills that are easy to hit.
- **Shape:** full pill (999px), 52px tall in the app (46px web, 50px block), 38px for small.
- **Primary:** Overhead Green (#12261F) with white text, 14px by 22px padding, 15px bold label, optional 17px icon. Inverts to pale #DCEBE3 with dark text at night.
- **Amber:** Lane Amber with Overhead Green text; once per screen (see The One Amber Go Rule).
- **Secondary:** Field with Sign Green text and a hairline edge; washes to Green Wash on web hover.
- **Danger:** Stop Red with white text. **Ghost:** transparent with a hairline edge and Ink Soft text. **Text:** Sign Green label with no container.
- **States:** app pressed drops to 0.85 opacity, disabled or busy to 0.55 with a spinner in the label colour; web hover brightens (filter 1.08), active dims (0.95), focus shows a 3px amber outline.

### Chips and Badges
- **Style:** pill, 5px by 11px, 12px semibold text with a 6px dot in the text colour. OK is Green Wash with Sign Green text, warn is Amber Wash with Amber Deep, danger is Red Wash with Stop Red, neutral is Hairline with Ink Soft.
- **Price pill:** the trip's toll on trip rows, Overhead Green with white 13px bold figures, 6px by 12px.

### Cards / Containers
- **Corner Style:** 24px.
- **Background:** Surface white; Night Surface at night.
- **Shadow Strategy:** the single card lift (see Elevation & Depth).
- **Border:** none by day; a #25332D hairline at night.
- **Internal Padding:** 18px app, 26px web desktop.
- **Figure tiles:** green, amber, sky, then plain white with lift; 22px corners, 16px padding (22px web), a round icon disc, an 800-weight figure, a 12.5px Ink Soft label.

### Inputs / Fields
- **Style:** borderless Field tint, 16px corners, 60px tall when labelled; the label (12px, Ink Soft) sits inside above the value (15px semibold). Select fields add a chevron and open a bottom sheet of option rows.
- **Focus:** the 1.5px edge turns Verge Green (#2F8F5B); on the web the field also turns white with a soft green focus ring.
- **Error / Disabled:** red edge with a 12.5px red message below; disabled at 0.6 opacity (web disabled selects drop to the ground colour).
- **Option rows:** Field tint, 16px corners, 14px padding; selected turns Green Wash with a Sign Green edge and a check-circle.

### Navigation
- **App tab bar:** white, no top border, soft lift, 70px plus safe area. Each tab icon sits in a 56 by 30px pill that fills Green Wash when active (filled icon, Sign Green); inactive tabs use outline icons in Ink Faint, labels 11px semibold. The centre Plan button is a raised 58px amber circle with a 4px white ring, turning Sign Green with an amber icon when Plan is open.
- **App header:** sits on the ground, no shadow; 24px medium title in Ink, the wordmark on Home, initials avatar top right.
- **Web:** white top bar with the wordmark and a hairline below (the admin side uses an Overhead Green bar); a white sidebar of pill links, active link Green Wash with Sign Green bold text, hover in Field.

### Sheets and Dialogs
- **App sheet:** slides up over a green-tinted backdrop (rgba(11,38,31,0.45)); white, 28px top corners, a 40px grabber, a 21px title and a round 36px close button.
- **Web dialog:** white, 28px corners, modal shadow, 22px title, footer buttons share the width; becomes a bottom sheet at 480px.

### Route Line (signature)
The trip as a route: origin on the left (15px bold, two lines max), a road in the middle with the time and kilometres above a 2px dashed Ink Faint line between a 9px Ink dot and a 20px Sign Green pin with a white flag, destination on the right aligned right. The large variant (21px semibold app, 28px web) heads trip detail. Used for every trip row on Home, History and the website's tables; in trip rows it is followed by a date and vehicle meta line and the dark price pill.

### Driving Screen (signage register)
Deliberately bold and high-contrast. The direction banner and next-plaza sign are Overhead Green panels with white text, Barlow Condensed plaza names in uppercase (26px) and amber meta lines. Toll alerts are white cards with a 2px coloured outline, a 62px tinted icon block and the plaza name in Barlow Condensed. Trip stats sit in outlined tiles with Barlow figures. This register stays on the driving screen.

## Do's and Don'ts

### Do:
- **Do** draw every trip as a route line: origin, dotted road with time and km, destination with the Sign Green pin.
- **Do** keep exactly one amber pill per screen, with Overhead Green (#12261F) text on it.
- **Do** use Overhead Green pills for primary actions and pills (999px) for every button, badge and price.
- **Do** put cards on the Mint Ground (#EEF3EF) as white, borderless 24px shapes with the one soft green-tinted lift; add the #25332D outline only at night.
- **Do** put field labels inside the field, above the value, on the borderless Field tint.
- **Do** run figure tiles green, amber, sky, then plain white, and set their figures in Manrope 800.
- **Do** keep titles large, medium weight and sentence case.
- **Do** keep the driving screen bold: Overhead Green banners, Barlow Condensed plaza names, high contrast in both themes.

### Don't:
- **Don't** use lavender, purple or candy-coloured tiles, or illustrated mascots.
- **Don't** use gradients, glassy or blurred effects.
- **Don't** add promo clutter: vouchers, points, discount banners, ratings or favourite hearts.
- **Don't** put white text on amber, or use more than one amber action on a screen.
- **Don't** place a small caption or uppercase line above a heading.
- **Don't** use Barlow Condensed on planning screens; it belongs to the driving screen, the wordmark and the route illustration's fees.
- **Don't** add hard offset shadows or stacked glows; there is one soft lift.
