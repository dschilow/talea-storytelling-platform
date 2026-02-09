# Motion Guide

## Scope

Use this guide when the task requires animation, transitions, or interaction feedback.
Apply motion to clarify state changes and guide attention, not as decoration only.

## Motion Strategy

- Choose one dominant motion style per screen (calm, lively, or sharp).
- Keep durations short for common UI transitions (roughly 120-300ms).
- Use slower timing only for hero entrances or contextual storytelling moments.
- Prefer easing that feels natural and avoids abrupt stopping.

## Framer Motion Patterns

- Animate container entry first, then stagger child elements.
- Use `AnimatePresence` for conditional mount/unmount transitions.
- Animate `opacity` and `transform` before layout-changing properties.
- Keep layout animation predictable; avoid chaining too many nested layout animations.

## Interaction Feedback

- Add subtle hover or press feedback for clickable elements.
- Distinguish action feedback from navigation feedback.
- Keep feedback immediate so interactions feel responsive.

## Reduced Motion

- Respect reduced-motion preferences for all non-essential animation.
- Provide non-animated fallbacks for transitions and reveals.
- Keep state changes understandable even when animation is disabled.

## Performance Guardrails

- Avoid animating large blur filters, shadows, and expensive paint-heavy effects.
- Limit continuous infinite animations to small and low-impact elements.
- Test animations on lower-end devices when possible.

## Common Mistakes to Avoid

- Running multiple competing animations at the same time.
- Animating every element on page load.
- Using long bounce/spring settings for dense productivity UIs.
- Hiding functional problems behind motion.
