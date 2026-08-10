import { SHOMI_BASE_HASHTAGS, SHOMI_CHANNEL_LIST } from "@/lib/shomiChannels";

interface ShomiTagFooterProps {
  hashtags?: string[];
}

const ShomiTagFooter = ({ hashtags = [] }: ShomiTagFooterProps) => {
  const allTags = [...SHOMI_BASE_HASHTAGS, ...hashtags];

  return (
    <section className="mt-12 rounded-2xl border border-border bg-muted/40 p-6">
      <h2 className="text-base font-semibold text-foreground">
        쇼미의 공식 채널
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        쇼미의 데일리 룩과 새로운 코디 실험은 채널에서 먼저 공개돼요.
      </p>

      <ul className="mt-4 flex flex-wrap gap-2">
        {SHOMI_CHANNEL_LIST.map((channel) => (
          <li key={channel.key}>
            <a
              href={channel.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <span className="font-medium">{channel.label}</span>
              <span className="text-muted-foreground">{channel.handle}</span>
            </a>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-sm text-muted-foreground break-keep">
        {allTags.join(" ")}
      </p>
    </section>
  );
};

export default ShomiTagFooter;
