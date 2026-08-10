import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Copy, ExternalLink } from "lucide-react";

const mcpUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/mcp`;

export default function Connect() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(mcpUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Helmet>
        <title>Connect ShowMeLook to your AI assistant</title>
        <meta
          name="description"
          content="Connect ShowMeLook to ChatGPT or Claude so your AI assistant can search products and browse public looks."
        />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <main className="min-h-screen bg-background text-foreground">
        <div className="max-w-3xl mx-auto px-6 py-12 space-y-10">
          <header className="space-y-3">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Connect ShowMeLook to your AI assistant
            </h1>
            <p className="text-muted-foreground">
              Let ChatGPT or Claude search the ShowMeLook catalog and browse public
              AI-generated looks on your behalf. Copy the server URL below, then
              follow the steps for your assistant.
            </p>
          </header>

          <Card className="p-5 space-y-3">
            <div className="text-sm font-medium text-muted-foreground">
              MCP server URL
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md bg-muted px-3 py-2 text-sm">
                {mcpUrl}
              </code>
              <Button onClick={copy} variant="secondary" size="sm">
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-1" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" /> Copy
                  </>
                )}
              </Button>
            </div>
          </Card>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">ChatGPT</h2>
            <ol className="list-decimal list-inside space-y-2 text-sm md:text-base">
              <li>
                Open{" "}
                <a
                  className="underline inline-flex items-center gap-1"
                  href="https://chatgpt.com/#settings/Connectors/Advanced"
                  target="_blank"
                  rel="noreferrer"
                >
                  ChatGPT Connectors → Advanced
                  <ExternalLink className="w-3 h-3" />
                </a>{" "}
                and enable Developer mode (read the risk notice shown there).
              </li>
              <li>In the chat composer's "+" menu, turn on Developer mode.</li>
              <li>Click "Add sources", then "Connect more".</li>
              <li>Name the connector "ShowMeLook" and paste the MCP URL above.</li>
              <li>Ask ChatGPT to search ShowMeLook products or public looks.</li>
            </ol>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Claude</h2>
            <ol className="list-decimal list-inside space-y-2 text-sm md:text-base">
              <li>
                Open{" "}
                <a
                  className="underline inline-flex items-center gap-1"
                  href="https://claude.ai/customize/connectors?modal=add-custom-connector"
                  target="_blank"
                  rel="noreferrer"
                >
                  Claude → Add custom connector
                  <ExternalLink className="w-3 h-3" />
                </a>
                .
              </li>
              <li>Name the connector "ShowMeLook" and paste the MCP URL above.</li>
              <li>
                Enable the connector from the chat composer, then ask Claude to use
                ShowMeLook.
              </li>
            </ol>
          </section>

          <p className="text-sm text-muted-foreground">
            Once connected, your assistant can search the product catalog, look up
            a product's details and purchase link, and browse recent public looks
            from the ShowMeLook community.
          </p>
        </div>
      </main>
    </>
  );
}
