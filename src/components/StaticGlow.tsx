// Static, non-animated ambient color decoration for the landing page.
// Replaces the mouse-following LiquidCursor: zero per-frame work, pure CSS.
export const StaticGlow = () => (
  <div
    aria-hidden="true"
    className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
  >
    <div className="absolute -top-24 -left-24 w-[28rem] h-[28rem] rounded-full bg-coral/15 blur-3xl" />
    <div className="absolute top-1/3 -right-32 w-[32rem] h-[32rem] rounded-full bg-purple/15 blur-3xl" />
    <div className="absolute bottom-0 left-1/4 w-[26rem] h-[26rem] rounded-full bg-sky/10 blur-3xl" />
  </div>
);

export default StaticGlow;
