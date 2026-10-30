import { useEffect, useState } from "react";
import { Text } from "@mantine/core";

/** 24h HH:mm:ss clock in Europe/Vienna. Renders only after mount to avoid hydration drift. */
export function AppLiveClock({ size = "sm" }: { size?: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  return (
    <Text ff="var(--app-font-mono)" fz={size} fw={600} c="inherit">
      {now
        ? now.toLocaleTimeString("de-AT", { hour12: false, timeZone: "Europe/Vienna" })
        : "--:--:--"}
    </Text>
  );
}

export function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}
