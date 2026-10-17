/**
 * Shared Motion Tokens & Primitives Configuration
 * Token definitions:
 * - ease: cubic-bezier(0.22, 1, 0.36, 1)
 * - duration: 600-800ms (standard 0.7s)
 * - distance: 24px
 * - stagger: 70ms (0.07s)
 * - viewport trigger: 15% visible (amount: 0.15), once: true
 * - reduced-motion: fade only (duration 0.2s, no transform)
 */

export const motionTokens = {
  ease: [0.22, 1, 0.36, 1] as const,
  easeString: "cubic-bezier(0.22, 1, 0.36, 1)",
  duration: 0.7,
  distance: 24,
  stagger: 0.07,
  viewport: {
    once: true,
    amount: 0.15,
  },
  reduced: {
    duration: 0.2,
    ease: "easeOut" as const,
  },
};

export const revealVariants = {
  hidden: (isReduced: boolean) => ({
    opacity: 0,
    y: isReduced ? 0 : motionTokens.distance,
  }),
  visible: (isReduced: boolean) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: isReduced ? motionTokens.reduced.duration : motionTokens.duration,
      ease: isReduced ? motionTokens.reduced.ease : motionTokens.ease,
    },
  }),
};

export const revealGroupVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: motionTokens.stagger,
    },
  },
};
