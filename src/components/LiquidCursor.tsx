import { useEffect, useRef, useState } from "react";

interface Point {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  radius: number;
  color: string;
}

const COLORS = [
  "#FF0080",
  "#7928CA",
  "#0070F3",
  "#00DFD8",
  "#FF4D4D",
  "#FFD700",
];

// Detect device tier from hardware hints. Returns budget multipliers.
const detectTier = (): "low" | "mid" | "high" => {
  if (typeof navigator === "undefined") return "high";
  const cores = navigator.hardwareConcurrency || 4;
  // @ts-expect-error - non-standard but widely available
  const memory: number = navigator.deviceMemory || 4;
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  if (reduced) return "low";
  if (isMobile && (cores <= 4 || memory <= 2)) return "low";
  if (cores <= 2 || memory <= 2) return "low";
  if (isMobile || cores <= 6 || memory <= 4) return "mid";
  return "high";
};

export const LiquidCursor = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<Point[]>([]);
  const mouseRef = useRef({
    x: 0,
    y: 0,
    lastX: 0,
    lastY: 0,
    vx: 0,
    vy: 0,
    smoothX: 0,
    smoothY: 0,
    prevSmoothX: 0,
    prevSmoothY: 0,
    initialized: false,
  });
  const rafRef = useRef<number | null>(null);
  const [tier] = useState(detectTier);

  // Disable entirely for users who prefer reduced motion
  const disabled =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // Tier-based budgets
    const cfg = {
      low: {
        maxPoints: 80,
        emitProb: 0.45,
        maxStepsPerMove: 8,
        targetFps: 30,
        blurDeviation: 6,
        radiusMul: 0.85,
      },
      mid: {
        maxPoints: 180,
        emitProb: 0.6,
        maxStepsPerMove: 16,
        targetFps: 45,
        blurDeviation: 8,
        radiusMul: 0.95,
      },
      high: {
        maxPoints: 320,
        emitProb: 0.7,
        maxStepsPerMove: 30,
        targetFps: 60,
        blurDeviation: 10,
        radiusMul: 1,
      },
    }[tier];

    // Adaptive quality (degrades when frames go slow)
    const adaptive = {
      pointBudget: cfg.maxPoints,
      emitProb: cfg.emitProb,
      maxSteps: cfg.maxStepsPerMove,
      slowFrames: 0,
      fastFrames: 0,
    };

    const dpr = Math.min(window.devicePixelRatio || 1, tier === "low" ? 1 : 1.5);

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    window.addEventListener("resize", resize);
    resize();

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      if (!mouseRef.current.initialized) {
        mouseRef.current.smoothX = e.clientX;
        mouseRef.current.smoothY = e.clientY;
        mouseRef.current.prevSmoothX = e.clientX;
        mouseRef.current.prevSmoothY = e.clientY;
        mouseRef.current.lastX = e.clientX;
        mouseRef.current.lastY = e.clientY;
        mouseRef.current.initialized = true;
      }
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    // Pause when tab hidden to save CPU/battery
    let paused = false;
    const handleVisibility = () => {
      paused = document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const addPoint = (x: number, y: number) => {
      if (pointsRef.current.length >= adaptive.pointBudget) return;
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 1.5 + 0.3;
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      pointsRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 1,
        radius: (Math.random() * 8 + 4) * cfg.radiusMul,
        color,
      });
    };

    const SMOOTHING = 0.25;
    const PREDICTION = 3.5;
    const minFrameInterval = 1000 / cfg.targetFps;
    let lastFrameTs = performance.now();

    const animate = (now: number) => {
      rafRef.current = requestAnimationFrame(animate);
      if (paused) {
        lastFrameTs = now;
        return;
      }
      const elapsed = now - lastFrameTs;
      if (elapsed < minFrameInterval) return; // Throttle to target FPS
      lastFrameTs = now - (elapsed % minFrameInterval);

      // Adaptive quality: monitor frame timing
      if (elapsed > minFrameInterval * 1.8) {
        adaptive.slowFrames++;
        adaptive.fastFrames = 0;
        if (adaptive.slowFrames > 12) {
          adaptive.pointBudget = Math.max(40, Math.floor(adaptive.pointBudget * 0.85));
          adaptive.emitProb = Math.max(0.2, adaptive.emitProb - 0.05);
          adaptive.maxSteps = Math.max(4, adaptive.maxSteps - 2);
          adaptive.slowFrames = 0;
        }
      } else if (elapsed < minFrameInterval * 1.2) {
        adaptive.fastFrames++;
        adaptive.slowFrames = 0;
        if (adaptive.fastFrames > 180 && adaptive.pointBudget < cfg.maxPoints) {
          adaptive.pointBudget = Math.min(cfg.maxPoints, adaptive.pointBudget + 10);
          adaptive.emitProb = Math.min(cfg.emitProb, adaptive.emitProb + 0.02);
          adaptive.maxSteps = Math.min(cfg.maxStepsPerMove, adaptive.maxSteps + 1);
          adaptive.fastFrames = 0;
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const m = mouseRef.current;
      if (m.initialized) {
        m.vx = m.x - m.lastX;
        m.vy = m.y - m.lastY;
        m.lastX = m.x;
        m.lastY = m.y;

        const targetX = m.x + m.vx * PREDICTION;
        const targetY = m.y + m.vy * PREDICTION;

        m.prevSmoothX = m.smoothX;
        m.prevSmoothY = m.smoothY;
        m.smoothX += (targetX - m.smoothX) * SMOOTHING;
        m.smoothY += (targetY - m.smoothY) * SMOOTHING;

        const dx = m.smoothX - m.prevSmoothX;
        const dy = m.smoothY - m.prevSmoothY;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.5) {
          const steps = Math.min(Math.ceil(dist), adaptive.maxSteps);
          for (let i = 0; i < steps; i += 1) {
            const t = i / steps;
            const x = m.prevSmoothX + dx * t;
            const y = m.prevSmoothY + dy * t;
            if (Math.random() < adaptive.emitProb) addPoint(x, y);
          }
        }
      }

      const pts = pointsRef.current;
      for (let i = pts.length - 1; i >= 0; i--) {
        const p = pts[i];
        p.life -= 0.006;
        p.x += p.vx;
        p.y += p.vy;
        p.radius *= 0.995;

        if (p.life <= 0 || p.radius < 0.5) {
          pts.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life * 0.6;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [tier, disabled]);

  if (disabled) return null;

  // Drop the gooey filter on low tier (SVG filters are expensive to composite)
  const filterStyle =
    tier === "low" ? undefined : { filter: "url(#liquid-cursor-filter)" as const };
  const blurDev = tier === "low" ? 0 : tier === "mid" ? 8 : 10;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {tier !== "low" && (
        <svg className="hidden">
          <defs>
            <filter id="liquid-cursor-filter">
              <feGaussianBlur in="SourceGraphic" stdDeviation={blurDev} result="blur" />
              <feColorMatrix
                in="blur"
                mode="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
                result="goo"
              />
              <feComposite in="SourceGraphic" in2="goo" operator="atop" />
            </filter>
          </defs>
        </svg>
      )}
      <canvas ref={canvasRef} className="w-full h-full block" style={filterStyle} />
    </div>
  );
};

export default LiquidCursor;
