// Watches Shomi's Google Drive folder. New or changed files are turned into text,
// summarized into short Korean notes by AI, and stored in shomi_knowledge_files.
// shomi-chat appends those notes to its knowledge. Runs hourly via pg_cron.
// First run only records existing files as "baseline" (already in knowledge.ts).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const FOLDER_ID = "1JhwcmAp3Jf2WAXqao2DGIwCJzigDyd30";
const DRIVE = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const MAX_TEXT = 60000;
const MAX_FILES_PER_RUN = 5;

type DriveFile = { id: string; name: string; mimeType: string; modifiedTime: string };

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const lovKey = Deno.env.get("LOVABLE_API_KEY");
  const driveKey = Deno.env.get("GOOGLE_DRIVE_API_KEY");
  if (!lovKey || !driveKey) return json({ error: "missing keys" }, 500);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const dh = { Authorization: `Bearer ${lovKey}`, "X-Connection-Api-Key": driveKey };

  const drive = async (path: string, init?: RequestInit) => {
    const r = await fetch(`${DRIVE}${path}`, { ...init, headers: { ...dh, ...(init?.headers ?? {}) } });
    if (!r.ok) throw new Error(`Drive ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return r;
  };

  const listAll = async (folder: string, depth = 0): Promise<DriveFile[]> => {
    const q = encodeURIComponent(`'${folder}' in parents and trashed=false`);
    const r = await drive(`/files?q=${q}&pageSize=200&fields=files(id,name,mimeType,modifiedTime)`);
    const files: DriveFile[] = (await r.json()).files ?? [];
    const out: DriveFile[] = [];
    for (const f of files) {
      if (f.mimeType === "application/vnd.google-apps.folder") {
        if (depth < 3) out.push(...(await listAll(f.id, depth + 1)));
      } else out.push(f);
    }
    return out;
  };

  const extract = async (f: DriveFile): Promise<string | null> => {
    const m = f.mimeType;
    if (m === "application/vnd.google-apps.document" || m === "application/vnd.google-apps.presentation")
      return await (await drive(`/files/${f.id}/export?mimeType=text/plain`)).text();
    if (m === "application/vnd.google-apps.spreadsheet")
      return await (await drive(`/files/${f.id}/export?mimeType=text/csv`)).text();
    if (m.startsWith("text/") || m === "application/json")
      return await (await drive(`/files/${f.id}?alt=media`)).text();
    if (m === "application/pdf" || m.includes("wordprocessingml") || m === "application/msword") {
      // Let Drive convert it to a temporary Google Doc, read the text, then delete the copy.
      const copy = await (await drive(`/files/${f.id}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `tmp-shomi-${f.name}`, mimeType: "application/vnd.google-apps.document" }),
      })).json();
      try {
        return await (await drive(`/files/${copy.id}/export?mimeType=text/plain`)).text();
      } finally {
        await fetch(`${DRIVE}/files/${copy.id}`, { method: "DELETE", headers: dh }).catch(() => {});
      }
    }
    return null; // images, zip, etc.
  };

  const summarize = async (name: string, text: string): Promise<string> => {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovKey}`, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        reasoning_effort: "low",
        stream: true,
        messages: [
          {
            role: "system",
            content:
              "너는 패션 서비스 쇼미룩의 챗봇 '쇼미'가 참고할 지식 노트를 만든다. 문서에서 사용자 질문에 답하는 데 쓸모 있는 사실만 한국어 짧은 목록으로 정리해. 최대 1200자. 투자·재무·매출·투자 유치 수치, 내부 운영 정보, 개인 연락처(전화·이메일·주소)는 절대 넣지 마. 쓸모 있는 내용이 없으면 '없음'만 출력해.",
          },
          { role: "user", content: `파일명: ${name}\n\n${text.slice(0, MAX_TEXT)}` },
        ],
      }),
    });
    if (!r.ok || !r.body) throw new Error(`AI ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "", out = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += value;
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const l of lines) {
        const d = l.replace(/^data:\s*/, "").trim();
        if (!l.startsWith("data:") || !d || d === "[DONE]") continue;
        try { out += JSON.parse(d).choices?.[0]?.delta?.content ?? ""; } catch { /* partial */ }
      }
    }
    return out.trim();
  };

  try {
    const files = await listAll(FOLDER_ID);
    const { data: rows } = await db.from("shomi_knowledge_files").select("drive_file_id, modified_time");
    const known = new Map((rows ?? []).map((r) => [r.drive_file_id, r.modified_time]));

    if (known.size === 0) {
      await db.from("shomi_knowledge_files").insert(files.map((f) => ({
        drive_file_id: f.id, name: f.name, mime_type: f.mimeType, modified_time: f.modifiedTime, status: "baseline",
      })));
      return json({ baseline: files.length });
    }

    const changed = files.filter((f) => {
      const t = known.get(f.id);
      return !t || new Date(t).getTime() !== new Date(f.modifiedTime).getTime();
    }).slice(0, MAX_FILES_PER_RUN);

    const results: Record<string, string> = {};
    let knowledgeChanged = false;
    for (const f of changed) {
      const base = { drive_file_id: f.id, name: f.name, mime_type: f.mimeType, modified_time: f.modifiedTime, updated_at: new Date().toISOString() };
      try {
        const text = await extract(f);
        if (!text || text.trim().length < 20) {
          await db.from("shomi_knowledge_files").upsert({ ...base, status: "skipped", summary: null, error: null });
          results[f.name] = "skipped";
          continue;
        }
        const summary = await summarize(f.name, text);
        const useful = summary && summary !== "없음";
        await db.from("shomi_knowledge_files").upsert({ ...base, status: useful ? "active" : "skipped", summary: useful ? summary : null, error: null });
        if (useful) knowledgeChanged = true;
        results[f.name] = useful ? "active" : "skipped";
      } catch (e) {
        const msg = String((e as Error).message ?? e).slice(0, 500);
        console.error("shomi-knowledge-sync", f.name, msg);
        // Keep the old modified_time out so the file is retried next run.
        await db.from("shomi_knowledge_files").upsert({ ...base, modified_time: null, status: "error", error: msg });
        results[f.name] = "error";
      }
    }

    // Removed files: drop their notes.
    const present = new Set(files.map((f) => f.id));
    const gone = [...known.keys()].filter((id) => !present.has(id));
    if (gone.length) {
      await db.from("shomi_knowledge_files").delete().in("drive_file_id", gone);
      knowledgeChanged = true;
    }

    // Saved chat answers may now be outdated.
    if (knowledgeChanged) await db.from("shomi_answer_cache").delete().not("id", "is", null);

    return json({ checked: files.length, processed: results, removed: gone.length, knowledgeChanged });
  } catch (e) {
    console.error("shomi-knowledge-sync fatal", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
