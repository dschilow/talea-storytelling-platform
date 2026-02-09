# Frontend Quality Checklist

## Before Finishing

- Confirm the user-facing goal is solved by the final UI, not only the visual style.
- Verify all changed components compile with no TypeScript errors.
- Ensure loading, empty, error, and success states are implemented.

## UX and Accessibility

- Keyboard navigation reaches every interactive element.
- Focus indicators remain visible and consistent.
- Icon-only controls include meaningful labels.
- Form validation messages are clear and actionable.
- Color contrast is sufficient for text and controls.

## Responsive Validation

- Check mobile layout at narrow widths.
- Check desktop layout at wide widths.
- Verify content does not overlap, clip, or collapse unexpectedly.
- Test long text and localized strings where relevant.

## Visual Consistency

- Spacing and sizing follow a consistent rhythm.
- Accent usage is intentional and not over-applied.
- Typography hierarchy is clear and stable.
- Component variants are consistent across states.

## Motion and Performance

- Animations improve clarity and do not delay core actions.
- Reduced-motion behavior is respected.
- No unnecessary heavy visual effects on large surfaces.
- Interactive controls remain responsive during transitions.

## Code Quality

- Keep component responsibilities focused.
- Remove dead styles, unused imports, and temporary debug code.
- Reuse shared utilities and patterns when available.
- Keep new abstractions minimal and justified by repetition.
