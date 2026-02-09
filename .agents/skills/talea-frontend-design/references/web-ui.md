# Web UI Guide

## Scope

Use this guide when building or restyling Talea pages and components in `frontend/`.
Prioritize strong visual hierarchy, clear interactions, and responsive behavior.

## Layout

- Start with a mobile-first structure.
- Keep one dominant axis per section (vertical stack or horizontal split).
- Use spacing rhythm consistently (for example 4/8/12/16/24/32).
- Reserve high-contrast surfaces for primary actions and key information.
- Avoid visual noise by limiting simultaneous accent treatments.

## Typography

- Use one display treatment for headings and one body treatment for readability.
- Keep heading contrast high and body text readable at small sizes.
- Avoid decorative fonts in dense body content.
- Maintain clear hierarchy with size, weight, and spacing, not only color.

## Color and Contrast

- Define a primary accent and neutral base before styling details.
- Use accent color mainly for actions, focus states, and important highlights.
- Keep body text and controls above accessible contrast thresholds.
- Avoid gradients and glows that reduce text legibility.

## Components

- Design each component with four states: default, hover, active, disabled.
- Handle data states explicitly: loading, empty, error, success.
- Keep actionable controls visually distinct from decorative elements.
- Reuse existing button, card, and input patterns where possible.

## Forms and Input UX

- Keep labels persistent and close to their controls.
- Show helper or validation text near the related field.
- Prefer inline validation for immediate feedback.
- Keep error messages specific and actionable.

## Responsive Behavior

- Confirm behavior for narrow mobile widths and large desktop widths.
- Avoid hard-coded widths when fluid behavior is expected.
- Prevent clipped text and overlapping controls at intermediate breakpoints.
- Test long labels, translations, and empty content blocks.

## Accessibility Minimum

- Preserve visible focus outlines for keyboard users.
- Keep keyboard tab order aligned with visual flow.
- Provide meaningful `aria-label` text for icon-only buttons.
- Ensure touch targets are large enough on mobile.

## Performance Notes

- Prefer CSS transforms and opacity for animation.
- Avoid expensive effects on large scrolling containers.
- Defer non-critical visuals when rendering heavy screens.
