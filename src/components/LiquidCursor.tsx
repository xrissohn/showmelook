import { useEffect, useRef } from "react";

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
  "#FF0080", // Pink
  "#7928CA", // Purple
  "#0070F3", // Blue
  "#00DFD8", // Cyan
  "#FF4D4D", // Red
  "#FFD700", // Gold
];

export const LiquidCursor = ({ disabled = false }: { disabled?: boolean }) => {
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
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
    window.addEventListener("mousemove", handleMouseMove);

    const addPoint = (x: number, y: number) => {
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
        radius: Math.random() * 8 + 4,
        color,
      });
    };

    const SMOOTHING = 0.25; // 0=no follow, 1=instant
    const PREDICTION = 3.5; // frames ahead

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const m = mouseRef.current;
      if (m.initialized) {
        // Velocity from raw mouse position
        m.vx = m.x - m.lastX;
        m.vy = m.y - m.lastY;
        m.lastX = m.x;
        m.lastY = m.y;

        // Predicted target = current pos + extrapolated velocity
        const targetX = m.x + m.vx * PREDICTION;
        const targetY = m.y + m.vy * PREDICTION;

        // Exponential smoothing toward predicted target
        m.prevSmoothX = m.smoothX;
        m.prevSmoothY = m.smoothY;
        m.smoothX += (targetX - m.smoothX) * SMOOTHING;
        m.smoothY += (targetY - m.smoothY) * SMOOTHING;

        // Emit points along the smoothed trajectory
        const dx = m.smoothX - m.prevSmoothX;
        const dy = m.smoothY - m.prevSmoothY;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.5) {
          const steps = Math.min(Math.ceil(dist), 30);
          for (let i = 0; i < steps; i += 1) {
            const t = i / steps;
            const x = m.prevSmoothX + dx * t;
            const y = m.prevSmoothY + dy * t;
            if (Math.random() > 0.3) addPoint(x, y);
          }
        }
      }

      for (let i = pointsRef.current.length - 1; i >= 0; i--) {
        const p = pointsRef.current[i];
        p.life -= 0.006;
        p.x += p.vx;
        p.y += p.vy;
        p.radius *= 0.995;

        if (p.life <= 0 || p.radius < 0.5) {
          pointsRef.current.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life * 0.6;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className={`fixed inset-0 pointer-events-none z-[9999] overflow-hidden ${disabled ? "hidden" : ""}`}>
      <svg className="hidden">
        <defs>
          <filter id="liquid-cursor-filter">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
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
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ filter: "url(#liquid-cursor-filter)" }}
      />
    </div>
  );
};

export default LiquidCursor;
