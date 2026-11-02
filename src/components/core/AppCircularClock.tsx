import { useEffect, useState } from "react";

export interface AppCircularClockProps {
  /** Elapsed time in seconds */
  elapsed: number;
  /** Whether the work timer is currently running */
  running?: boolean;
  /** Outer diameter in pixels (default: 124) */
  size?: number;
  className?: string;
}

/**
 * An analog circular clock dial with hour, minute, and second hands,
 * 12-hour indices, and a dynamic 60-second radial progress ring when running.
 */
export function AppCircularClock({
  elapsed,
  running = false,
  size = 124,
  className,
}: AppCircularClockProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Standard geometry
  const center = 100;
  const radius = 88;
  const circumference = 2 * Math.PI * radius;

  // Calculate live clock hand angles (0° at 12 o'clock)
  const hours = now ? now.getHours() % 12 : 0;
  const minutes = now ? now.getMinutes() : 0;
  const seconds = now ? now.getSeconds() : 0;

  const hourAngle = (hours + minutes / 60) * 30; // 360 / 12 = 30°
  const minuteAngle = (minutes + seconds / 60) * 6; // 360 / 60 = 6°
  const secondAngle = seconds * 6;

  // Radial progress for active timer: 60-second cycle around the bezel
  const secondProgress = running ? (elapsed % 60) / 60 : 0;
  const strokeDashoffset = circumference * (1 - secondProgress);

  // Generate 12 hour ticks and 60 minute marks
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const isHour = i % 5 === 0;
    const isCardinal = i % 15 === 0; // 12, 3, 6, 9
    const angleRad = (i * 6 - 90) * (Math.PI / 180);
    const outerR = 92;
    const innerR = isCardinal ? 78 : isHour ? 82 : 88;
    return {
      key: i,
      x1: center + outerR * Math.cos(angleRad),
      y1: center + outerR * Math.sin(angleRad),
      x2: center + innerR * Math.cos(angleRad),
      y2: center + innerR * Math.sin(angleRad),
      isHour,
      isCardinal,
    };
  });

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: size,
        height: size,
        margin: "0 auto",
        userSelect: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        style={{
          display: "block",
          overflow: "visible",
        }}
      >
        <defs>
          {/* Subtle radial dial background */}
          <radialGradient id="clockDialGlow" cx="50%" cy="50%" r="50%">
            <stop
              offset="0%"
              stopColor="var(--app-brand-primary)"
              stopOpacity={running ? "0.14" : "0.04"}
            />
            <stop
              offset="85%"
              stopColor="var(--app-brand-primary)"
              stopOpacity={running ? "0.04" : "0.01"}
            />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>

          {/* Stroke gradient for timer progress ring */}
          <linearGradient id="timerProgressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#009fe3" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
        </defs>

        {/* Outer Dial Bezel */}
        <circle
          cx={center}
          cy={center}
          r={95}
          fill="url(#clockDialGlow)"
          stroke={
            running
              ? "color-mix(in srgb, var(--app-brand-primary) 40%, var(--app-border-subtle))"
              : "var(--app-border-subtle)"
          }
          strokeWidth="1.5"
          style={{
            transition: "stroke 0.3s ease",
            filter: running ? "drop-shadow(0 0 10px rgba(0, 159, 227, 0.25))" : "none",
          }}
        />

        {/* Background track ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--app-border-subtle)"
          strokeWidth="2"
          strokeOpacity="0.4"
        />

        {/* Active Timer Radial Progress Ring (sweeps around every 60s when running) */}
        {running && (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="url(#timerProgressGradient)"
            strokeWidth="3.5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
            style={{
              transition: "stroke-dashoffset 0.25s linear",
              filter: "drop-shadow(0 0 4px rgba(0, 159, 227, 0.6))",
            }}
          />
        )}

        {/* 60 Minute & 12 Hour Ticks */}
        {ticks.map((t) => (
          <line
            key={t.key}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={
              t.isCardinal
                ? "var(--app-text-primary)"
                : t.isHour
                  ? "var(--app-text-secondary)"
                  : "var(--app-border-subtle)"
            }
            strokeWidth={t.isCardinal ? 2.4 : t.isHour ? 1.6 : 1}
            strokeOpacity={t.isHour ? 0.9 : 0.4}
            strokeLinecap="round"
          />
        ))}

        {/* Analog Clock Hands */}
        {now && (
          <g>
            {/* Hour hand */}
            <line
              x1={center}
              y1={center}
              x2={center + 38 * Math.sin((hourAngle * Math.PI) / 180)}
              y2={center - 38 * Math.cos((hourAngle * Math.PI) / 180)}
              stroke="var(--app-text-primary)"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            {/* Minute hand */}
            <line
              x1={center}
              y1={center}
              x2={center + 58 * Math.sin((minuteAngle * Math.PI) / 180)}
              y2={center - 58 * Math.cos((minuteAngle * Math.PI) / 180)}
              stroke="var(--app-text-primary)"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            {/* Second hand (accent color) */}
            <line
              x1={center - 14 * Math.sin((secondAngle * Math.PI) / 180)}
              y1={center + 14 * Math.cos((secondAngle * Math.PI) / 180)}
              x2={center + 72 * Math.sin((secondAngle * Math.PI) / 180)}
              y2={center - 72 * Math.cos((secondAngle * Math.PI) / 180)}
              stroke="var(--app-brand-primary)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            {/* Second hand counter-weight dot */}
            <circle
              cx={center - 10 * Math.sin((secondAngle * Math.PI) / 180)}
              cy={center + 10 * Math.cos((secondAngle * Math.PI) / 180)}
              r="2.5"
              fill="var(--app-brand-primary)"
            />
          </g>
        )}

        {/* Center Pin / Bezel Cap */}
        <circle cx={center} cy={center} r="5" fill="var(--app-text-primary)" />
        <circle cx={center} cy={center} r="2.2" fill="var(--app-brand-primary)" />
      </svg>
    </div>
  );
}
