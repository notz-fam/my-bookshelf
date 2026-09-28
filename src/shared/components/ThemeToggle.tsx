"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "motion/react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/shared/ui/button";

const subscribeNoop = () => () => {};

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // resolvedTheme はクライアントでしか確定しないので、マウント後に描画する
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "ライトテーマに切り替え" : "ダークテーマに切り替え"}
      title={isDark ? "ライトテーマに切り替え" : "ダークテーマに切り替え"}
      className="relative overflow-hidden"
    >
      <AnimatePresence mode="wait" initial={false}>
        {mounted && (
          <motion.span
            key={isDark ? "moon" : "sun"}
            initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: 90, scale: 0.4, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            className="flex"
          >
            {isDark ? <Moon /> : <Sun />}
          </motion.span>
        )}
      </AnimatePresence>
    </Button>
  );
}
