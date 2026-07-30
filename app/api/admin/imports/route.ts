import { getAdminUser } from "@/app/admin-auth";

const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_ITEMS_PER_REQUEST = 5000;
const REQUIRED_COLUMNS = ["title"];

type ManifestRow = Record<string, string>;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const user = await getAdminUser();
  if (!user) return Response.json({ error: "需要管理员权限" }, { status: 403 });

  const form = await request.formData();
  const name = cleanText(form.get("name"), 120);
  const packageLocation = cleanText(form.get("packageLocation"), 500);
  const notes = cleanText(form.get("notes"), 1000);
  const defaultStatus = cleanText(form.get("defaultStatus"), 20) === "draft" ? "draft" : "review";
  if (!name) return Response.json({ error: "请填写导入任务名称" }, { status: 400 });

  const manifestFile = form.get("manifest");
  let manifestText = cleanText(form.get("manifestText"), MAX_MANIFEST_BYTES);
  let manifestFilename = "";
  if (manifestFile instanceof File && manifestFile.size > 0) {
    if (manifestFile.size > MAX_MANIFEST_BYTES) {
      return Response.json({ error: "Manifest CSV 不能超过 2MB；一万篇以上建议按资源包分成多个任务" }, { status: 413 });
    }
    manifestFilename = manifestFile.name.slice(0, 180);
    manifestText = await manifestFile.text();
  }

  const parsed = parseManifestCsv(manifestText);
  if (manifestText.trim() && parsed.error) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  if (parsed.rows.length > MAX_ITEMS_PER_REQUEST) {
    return Response.json({ error: `单次最多预登记 ${MAX_ITEMS_PER_REQUEST} 篇；请把资源包拆成多个 manifest` }, { status: 413 });
  }

  const { env } = await import("cloudflare:workers");
  const jobResult = await env.DB.prepare(
    `INSERT INTO guide_import_jobs
     (name, source_type, package_location, manifest_filename, default_status,
      status, total_items, notes, created_by_email)
     VALUES (?, 'manifest_csv', ?, ?, ?, 'created', ?, ?, ?)`
  ).bind(
    name,
    packageLocation,
    manifestFilename,
    defaultStatus,
    parsed.rows.length,
    notes,
    user.email,
  ).run();
  const jobId = Number(jobResult.meta.last_row_id);
  if (!jobId) return Response.json({ error: "导入任务创建失败" }, { status: 500 });

  let importedItems = 0;
  let skippedRows = parsed.skippedRows;
  for (const row of parsed.rows) {
    const title = cleanString(row.title, 220);
    if (!title) {
      skippedRows += 1;
      continue;
    }
    const externalId = cleanString(row.id || row.external_id || row.slug || title, 180);
    try {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO guide_import_items
         (job_id, external_id, title, game_name, tags, content_file, cover_image,
          source_note, copyright_note, status, raw_metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
      ).bind(
        jobId,
        externalId,
        title,
        cleanString(row.game || row.game_name || row.gameName, 120),
        cleanString(row.tags, 500),
        cleanPath(row.content_file || row.contentFile || row.file),
        cleanPath(row.cover_image || row.coverImage || row.cover),
        cleanString(row.source || row.source_note || row.sourceNote, 500),
        cleanString(row.copyright || row.copyright_note || row.copyrightNote, 500),
        JSON.stringify(row).slice(0, 4000),
      ).run();
      importedItems += 1;
    } catch {
      skippedRows += 1;
    }
  }

  if (importedItems !== parsed.rows.length) {
    await env.DB.prepare(
      `UPDATE guide_import_jobs
       SET total_items = ?, failed_items = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(importedItems, skippedRows, jobId).run();
  }

  return Response.json({ ok: true, id: jobId, importedItems, skippedRows }, { status: 201 });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function cleanText(value: FormDataEntryValue | null, maxLength: number) {
  if (typeof value !== "string") return "";
  return cleanString(value, maxLength);
}

function cleanString(value: unknown, maxLength: number) {
  return String(value ?? "").normalize("NFKC").replace(/\u0000/g, "").trim().slice(0, maxLength);
}

function cleanPath(value: unknown) {
  return cleanString(value, 500).replace(/^\/+/, "").replace(/\.\.(\/|\\)/g, "");
}

function parseManifestCsv(text: string): { rows: ManifestRow[]; skippedRows: number; error?: string } {
  if (!text.trim()) return { rows: [], skippedRows: 0 };
  const records = parseCsvRecords(text).filter((record) => record.some((cell) => cell.trim()));
  if (records.length === 0) return { rows: [], skippedRows: 0 };
  const headers = records[0].map((header) => normalizeHeader(header));
  for (const required of REQUIRED_COLUMNS) {
    if (!headers.includes(required)) return { rows: [], skippedRows: 0, error: `Manifest CSV 缺少必填列：${required}` };
  }
  const rows: ManifestRow[] = [];
  let skippedRows = 0;
  for (const record of records.slice(1)) {
    const row: ManifestRow = {};
    headers.forEach((header, index) => {
      if (header) row[header] = record[index]?.trim() ?? "";
    });
    if (!row.title?.trim()) {
      skippedRows += 1;
      continue;
    }
    rows.push(row);
  }
  return { rows, skippedRows };
}

function parseCsvRecords(text: string) {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  record.push(field);
  records.push(record);
  return records;
}

function normalizeHeader(header: string) {
  return header.trim().replace(/^\uFEFF/, "").replace(/[-\s]+/g, "_");
}
