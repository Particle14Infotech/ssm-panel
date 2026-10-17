import { Variants } from "framer-motion";

export const easings = {
  power2Out: [0.25, 1, 0.5, 1] as const,
  power3Out: [0.215, 0.61, 0.355, 1] as const,
  power4Out: [0.165, 0.84, 0.44, 1] as const,
  expoOut: [0.19, 1, 0.22, 1] as const,
  smooth: [0.4, 0, 0.2, 1] as const,
  springy: { type: "spring", stiffness: 380, damping: 28 } as const,
};

export const durations = {
  fast: 0.2,
  medium: 0.45,
  slow: 0.8,
  intro: 1.2,
};

export const fadeUpVariant: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 1, 0.5, 1],
    },
  },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.02,
    },
  },
};

export const scaleInVariant: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: durations.medium,
      ease: easings.expoOut,
    },
  },
};

export const wordRevealContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.045,
    },
  },
};

export const wordRevealChild: Variants = {
  hidden: {
    opacity: 0,
    y: "110%",
    rotateX: 20,
  },
  visible: {
    opacity: 1,
    y: "0%",
    rotateX: 0,
    transition: {
      duration: 0.65,
      ease: easings.power4Out,
    },
  },
};
