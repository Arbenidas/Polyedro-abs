"use client";

import { motion, type Variants } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

export { motion };

export const motionViewport = { once: true, amount: 0.22 } as const;

export const pageVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: "easeOut",
      staggerChildren: 0.04,
    },
  },
};

export const sectionShellVariants: Variants = {
  hidden: { opacity: 0, y: 52, scale: 0.985, filter: "blur(10px)" },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      type: "spring",
      stiffness: 120,
      damping: 20,
      mass: 0.9,
      staggerChildren: 0.07,
      delayChildren: 0.08,
    },
  },
};

export const staggerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.06,
    },
  },
};

export const revealVariants: Variants = {
  hidden: { opacity: 0, y: 26, rotate: -0.45, filter: "blur(7px)" },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    rotate: 0,
    filter: "blur(0px)",
    transition: {
      type: "spring",
      stiffness: 150,
      damping: 19,
      mass: 0.75,
      delay,
    },
  }),
};

export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 34, rotate: -0.9, scale: 0.96, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    rotate: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      type: "spring",
      stiffness: 135,
      damping: 17,
      mass: 0.8,
    },
  },
};

export function Reveal({
  children,
  className,
  delay = 0,
  style,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  style?: CSSProperties;
}) {
  return (
    <motion.div className={className} custom={delay} style={style} variants={revealVariants}>
      {children}
    </motion.div>
  );
}

export function MotionGroup({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <motion.div className={className} style={style} variants={staggerVariants}>
      {children}
    </motion.div>
  );
}
