---
name: talea-frontend-design
description: Design and implement high-quality Talea frontend interfaces with React, TypeScript, Tailwind, and Framer Motion. Use when requests involve new screens/components, UI redesign, visual polish, responsive layout fixes, interaction/motion work, accessibility improvements, or frontend code updates in frontend/.
---

# Talea Frontend Design

## Overview

Build production-ready Talea UI with a clear visual direction, strong usability, and maintainable component code.
Deliver complete interface work from layout and states to motion and responsive behavior.

## Workflow

1. Clarify the target
- Identify page/component scope, user goal, device constraints, and acceptance criteria.
- Inspect nearby files before introducing new patterns.

2. Set the visual direction
- Define typography hierarchy, color accents, spacing rhythm, and motion personality early.
- Preserve existing project language unless the user asks for a redesign.

3. Implement structure first
- Build semantic layout and interaction states before adding visual effects.
- Handle loading, empty, error, and success states explicitly.

4. Apply styling and motion
- Use Tailwind utilities and extract repeated class clusters for readability.
- Prefer one intentional entrance sequence and focused micro-interactions.

5. Harden and verify
- Check keyboard access, focus visibility, color contrast, and reduced-motion behavior.
- Validate mobile-first behavior and desktop scaling.

## Decision Guide

- Read `references/web-ui.md` for layout, hierarchy, and component styling decisions.
- Read `references/motion.md` for framer-motion usage and motion constraints.
- Read `references/quality-checklist.md` for final QA checks and review criteria.

## Implementation Rules

- Prefer TypeScript React function components with explicit props.
- Keep style logic close to components unless reused in 3 or more places.
- Reuse existing dependencies and utilities before adding new packages.
- Avoid generic, interchangeable UI output; commit to one intentional style direction.
- Keep animations meaningful and never block core interactions.

## Done Criteria

- Deliver readable code that matches existing repository patterns.
- Handle loading, empty, error, and success states.
- Work across mobile and desktop breakpoints.
- Keep keyboard and focus behavior accessible.
- Keep motion purposeful and compatible with reduced-motion preferences.
