/**
 * AnimatedPage — Framer Motion page transition wrapper
 * Subtle, snappy animations matching the "Aether" design language
 */

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface AnimatedPageProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

const pageTransition = {
  duration: 0.25,
  ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
};

export default function AnimatedPage({ children, delay = 0, className }: AnimatedPageProps) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
      transition={{ ...pageTransition, delay }}
      className={className}
      style={{ willChange: "transform, opacity" }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerContainer({ children, className, delay = 0 }: AnimatedPageProps & { delay?: number }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: 0.05,
            delayChildren: delay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: Omit<AnimatedPageProps, "delay">) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 12 },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.35,
            ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function HoverCard({ children, className }: Omit<AnimatedPageProps, "delay">) {
  return (
    <motion.div
      whileHover={{
        y: -2,
        boxShadow: "0 10px 15px rgba(0, 0, 0, 0.04), 0 4px 6px rgba(0, 0, 0, 0.02)",
        transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function FadeIn({ children, delay = 0, duration = 0.35, className }: AnimatedPageProps & { duration?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration, delay, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
