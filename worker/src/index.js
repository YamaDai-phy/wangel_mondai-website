const DEFAULT_ALLOWED_ORIGINS = [
  "https://wangel-mondai.pages.dev",
  "https://yamadai-phy.github.io"
];

const SUBJECTS = {
  共通: { slug: "kyotsu", category: "共通" },
  自然観察: { slug: "shizekan", category: "自然観察" },
  気象: { slug: "kishou", category: "気象" },
  救急: { slug: "kyukyu", category: "救急" },
  天気図: { slug: "tenkizu", category: "天気図" },
  混在: { slug: "mixed", category: "混在" },
  "2026インハイ": { slug: "inhai2026", category: "インターハイ" },
  県総体: { slug: "kensotai", category: "県総体" },
  中国大会予選: { slug: "chutaiyusen", category: "chutaiyosen" },
};

const DEFAULT_MAX_FILE_SIZE = 20 * 1024 * 1024;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const corsHeaders = createCorsHeaders(origin, env.ALLOWED_ORIGINS);

    if (origin && !corsHeaders) return json({ error: "このサイトからは送信できません。" }, 403);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

    try {
      if (request.method === "GET" && url.pathname === "/") {
        return json({ ok: true, service: "pdf-upload-api" }, 200, corsHeaders);
      }
      if (request.method === "POST" && url.pathname === "/") {
        return await handleUpload(request, env, corsHeaders, url);
      }
      if (request.method === "GET" && (url.pathname === "/papers" || url.pathname === "/data.json")) {
        return await listPublished(env, corsHeaders, url);
      }

      const adminListMatch = url.pathname === "/admin/submissions";
      if (adminListMatch && request.method === "GET") {
        return await listAdminSubmissions(request, env, corsHeaders);
      }

      const adminMatch = url.pathname.match(/^\/admin\/submissions\/([0-9a-f-]{36})(?:\/(approve|hide|restore|delete|file))?$/i);
      if (adminMatch) {
        return await handleAdminSubmission(request, env, corsHeaders, adminMatch[1], adminMatch[2]);
      }

      const publicFileMatch = url.pathname.match(/^\/files\/([0-9a-f-]{36})(?:\/.*)?$/i);
      if (request.method === "GET" && publicFileMatch) {
        return await servePublicFile(request, env, corsHeaders, publicFileMatch[1]);
      }

      const reviewMatch = url.pathname.match(/^\/review\/([0-9a-f-]{36})(?:\/(file|approve|reject|metadata|comments))?$/i);
      if (reviewMatch) {
        return await handleReview(request, env, corsHeaders, reviewMatch[1], reviewMatch[2], url);
      }

      const incompleteMatch = url.pathname.match(/^\/incomplete\/([0-9a-f-]{36})\/file$/i);
      if (request.method === "GET" && incompleteMatch) {
        return await serveIncompleteFile(request, env, corsHeaders, incompleteMatch[1], url);
      }

      return json({ error: "Not Found" }, 404, corsHeaders);
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 500;
      if (status === 500) console.error("Request failed", error);
      return json(
        { error: status === 500 ? "処理中にエラーが発生しました。" : error.message },
        status,
        corsHeaders,
      );
    }
  },
};

async function handleUpload(request, env, corsHeaders, requestUrl) {
  const input = await validateUpload(await request.formData(), env.MAX_FILE_SIZE);
  const id = crypto.randomUUID();
  const reviewToken = createReviewToken();
  const reviewTokenHash = await hashToken(reviewToken);
  const createdAt = new Date().toISOString();
  const isIncomplete = input.docType === "incomplete";
  const status = isIncomplete ? "incomplete" : "pending";
  const r2Key = storageKeyFor(input, id, isIncomplete);

  await env.PDF_BUCKET.put(r2Key, input.file.stream(), {
    httpMetadata: { contentType: "application/pdf" },
    customMetadata: {
      docType: input.docType,
      fileKind: input.fileKind,
      subject: input.subject,
      title: input.title,
      uploader: input.uploader,
      tournamentName: input.tournamentName,
      tournamentYear: input.tournamentYear,
      uploadedAt: createdAt,
    },
  });

  try {
    await env.DB.prepare(
      `INSERT INTO submissions
       (id, r2_key, filename, title, uploader, subject, category, doc_type,
        status, review_token_hash, size, created_at, tournament_name, tournament_year, file_kind)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id,
      r2Key,
      input.filename,
      input.title,
      input.uploader,
      input.subject,
      SUBJECTS[input.subject].category,
      input.docType,
      status,
      reviewTokenHash,
      input.file.size,
      createdAt,
      input.tournamentName,
      input.tournamentYear,
      input.fileKind,
    ).run();
  } catch (error) {
    await env.PDF_BUCKET.delete(r2Key);
    throw error;
  }

  const siteUrl = String(env.PUBLIC_SITE_URL || requestUrl.origin).replace(/\/$/, "");
  const notificationUrl = isIncomplete
    ? `${siteUrl}/review.html?id=${encodeURIComponent(id)}&token=${encodeURIComponent(reviewToken)}`
    : `${siteUrl}/review.html?id=${encodeURIComponent(id)}&token=${encodeURIComponent(reviewToken)}`;
  let notificationSent = false;

  if (env.LINE_CHANNEL_ACCESS_TOKEN && env.LINE_USER_ID) {
    try {
      await sendLineNotification(
        env.LINE_CHANNEL_ACCESS_TOKEN,
        env.LINE_USER_ID,
        input,
        notificationUrl,
        isIncomplete,
      );
      notificationSent = true;
    } catch (error) {
      console.error("LINE notification failed", error);
    }
  }

  return json({
    success: true,
    message: isIncomplete
      ? "未完成品を送信しました。管理者へ通知されました。"
      : "アップロードが完了しました。確認後に掲載されます。",
    submissionId: id,
    notificationSent,
  }, 201, corsHeaders);
}

async function listPublished(env, corsHeaders, url) {
  let result;
  try {
    result = await env.DB.prepare(
      `SELECT id, filename, title, uploader, category, subject, doc_type, size,
              created_at, reviewed_at, tournament_name, tournament_year, file_kind
         FROM submissions WHERE status = 'published'
        ORDER BY reviewed_at DESC, created_at DESC`,
    ).all();
  } catch (error) {
    // Allow an older D1 schema to continue serving existing published files
    // while migrations are being rolled out.
    console.error("Falling back to legacy submissions schema", error);
    result = await env.DB.prepare(
      `SELECT id, filename, title, uploader, category, subject, doc_type, size,
              created_at, reviewed_at
         FROM submissions WHERE status = 'published'
        ORDER BY reviewed_at DESC, created_at DESC`,
    ).all();
  }

  const papers = result.results.map((row) => ({
    id: row.id,
    filename: row.filename,
    title: row.title,
    uploader: row.uploader,
    category: row.category,
    tournament: formatTournament(row.tournament_name, row.tournament_year) || tournamentForSubject(row.subject),
    tournamentName: row.tournament_name || "",
    tournamentYear: row.tournament_year || "",
    docType: row.doc_type,
    fileKind: row.file_kind || "",
    ext: extensionOf(row.filename),
    size: row.size,
    mtime: row.reviewed_at || row.created_at,
    path: `${url.origin}/files/${row.id}/${encodeURIComponent(row.filename)}`,
  }));

  return json({ papers }, 200, corsHeaders, { "Cache-Control": "public, max-age=60" });
}

function requireAdmin(request, env) {
  const token = request.headers.get("X-Admin-Token") || "";
  if (!env.ADMIN_TOKEN) throw new ApiError("管理者用の認証がまだ設定されていません。", 503);
  if (!token || token !== env.ADMIN_TOKEN) throw new ApiError("管理者トークンが正しくありません。", 401);
}

function adminSubmissionRow(row) {
  return {
    id: row.id,
    filename: row.filename,
    title: row.title,
    uploader: row.uploader,
    subject: row.subject,
    category: row.category,
    docType: row.doc_type,
    fileKind: row.file_kind || "",
    status: row.status,
    size: row.size,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    tournamentName: row.tournament_name || "",
    tournamentYear: row.tournament_year || "",
  };
}

async function listAdminSubmissions(request, env, corsHeaders) {
  requireAdmin(request, env);
  const result = await env.DB.prepare(
    `SELECT id, filename, title, uploader, subject, category, doc_type, status, size,
            created_at, reviewed_at, tournament_name, tournament_year, file_kind
       FROM submissions
      ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'incomplete' THEN 1 WHEN 'published' THEN 2 WHEN 'hidden' THEN 3 ELSE 4 END,
               created_at DESC`,
  ).all();
  return json({ submissions: result.results.map(adminSubmissionRow) }, 200, corsHeaders);
}

async function handleAdminSubmission(request, env, corsHeaders, id, action) {
  requireAdmin(request, env);
  const row = await env.DB.prepare(
    `SELECT id, r2_key, filename, title, uploader, subject, category, doc_type, status, size,
            created_at, reviewed_at, tournament_name, tournament_year, file_kind
       FROM submissions WHERE id = ?`,
  ).bind(id).first();
  if (!row) throw new ApiError("対象のPDFが見つかりません。", 404);

  if (action === "file" && request.method === "GET") {
    return serveR2Object(request, env.PDF_BUCKET, row.r2_key, row.filename, corsHeaders, true);
  }

  const transitions = {
    approve: { from: "pending", to: "published" },
    hide: { from: "published", to: "hidden" },
    restore: { from: "hidden", to: "published" },
  };
  if (action && transitions[action] && request.method === "POST") {
    const transition = transitions[action];
    if (row.status !== transition.from) throw new ApiError("現在の状態ではこの操作はできません。", 409);
    await env.DB.prepare(
      "UPDATE submissions SET status = ?, reviewed_at = ?, review_token_hash = NULL WHERE id = ?",
    ).bind(transition.to, new Date().toISOString(), id).run();
    return json({ success: true, status: transition.to }, 200, corsHeaders);
  }
  if (action === "delete" && request.method === "DELETE") {
    await env.PDF_BUCKET.delete(row.r2_key);
    await env.DB.prepare("DELETE FROM submissions WHERE id = ?").bind(id).run();
    return json({ success: true }, 200, corsHeaders);
  }
  throw new ApiError("Method Not Allowed", 405);
}

function extensionOf(filename) {
  const match = String(filename || "").match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : "";
}

async function servePublicFile(request, env, corsHeaders, id) {
  const row = await env.DB.prepare(
    "SELECT r2_key, filename FROM submissions WHERE id = ? AND status = 'published'",
  ).bind(id).first();
  if (!row) throw new ApiError("ファイルが見つかりません。", 404);
  return serveR2Object(request, env.PDF_BUCKET, row.r2_key, row.filename, corsHeaders);
}

async function handleReview(request, env, corsHeaders, id, action, url) {
  const token = url.searchParams.get("token") || "";
  if (!token) throw new ApiError("確認リンクが正しくありません。", 401);

  const tokenHash = await hashToken(token);
  const row = await env.DB.prepare(
    `SELECT id, r2_key, filename, title, uploader, subject, category, doc_type,
            status, size, created_at, tournament_name, tournament_year, file_kind
       FROM submissions
      WHERE id = ? AND review_token_hash = ? AND status IN ('pending', 'incomplete')`,
  ).bind(id, tokenHash).first();
  if (!row) throw new ApiError("確認リンクが無効または処理済みです。", 404);

  if (!action && request.method === "GET") {
    return json({ submission: publicReviewRow(row) }, 200, corsHeaders);
  }
  if (action === "file" && request.method === "GET") {
    return serveR2Object(request, env.PDF_BUCKET, row.r2_key, row.filename, corsHeaders, true);
  }
  if (action === "metadata" && request.method === "PATCH") {
    return await updateMetadata(request, env, corsHeaders, row, tokenHash);
  }
  if (action === "comments" && row.status === "incomplete") {
    if (request.method === "GET") return await listComments(env, corsHeaders, id);
    if (request.method === "POST") return await addComment(request, env, corsHeaders, id);
  }
  if (action === "approve" && request.method === "POST" && row.status === "pending") {
    const result = await env.DB.prepare(
      `UPDATE submissions
          SET status = 'published', reviewed_at = ?, review_token_hash = NULL
        WHERE id = ? AND review_token_hash = ? AND status = 'pending'`,
    ).bind(new Date().toISOString(), id, tokenHash).run();
    if (result.meta.changes !== 1) throw new ApiError("すでに処理されています。", 409);
    return json({ success: true, status: "published" }, 200, corsHeaders);
  }
  if (action === "reject" && request.method === "POST" && row.status === "pending") {
    const result = await env.DB.prepare(
      `UPDATE submissions
          SET status = 'rejected', reviewed_at = ?, review_token_hash = NULL
        WHERE id = ? AND review_token_hash = ? AND status = 'pending'`,
    ).bind(new Date().toISOString(), id, tokenHash).run();
    if (result.meta.changes !== 1) throw new ApiError("すでに処理されています。", 409);
    await env.PDF_BUCKET.delete(row.r2_key);
    return json({ success: true, status: "rejected" }, 200, corsHeaders);
  }

  throw new ApiError("Method Not Allowed", 405);
}

async function serveIncompleteFile(request, env, corsHeaders, id, url) {
  const token = url.searchParams.get("token") || "";
  if (!token) throw new ApiError("ダウンロードリンクが正しくありません。", 401);

  const tokenHash = await hashToken(token);
  const row = await env.DB.prepare(
    `SELECT r2_key, filename
       FROM submissions
      WHERE id = ? AND review_token_hash = ? AND status = 'incomplete'`,
  ).bind(id, tokenHash).first();
  if (!row) throw new ApiError("ダウンロードリンクが無効です。", 404);

  return serveR2Object(request, env.PDF_BUCKET, row.r2_key, row.filename, corsHeaders, false);
}

async function serveR2Object(request, bucket, key, filename, corsHeaders, inline = true) {
  const object = await bucket.get(key, { range: request.headers, onlyIf: request.headers });
  if (!object) throw new ApiError("ファイルが見つかりません。", 404);
  if (!object.body) return new Response(null, { status: 304, headers: corsHeaders });

  const headers = new Headers(corsHeaders || undefined);
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", "application/pdf");
  headers.set("Content-Disposition", contentDisposition(filename, inline));
  headers.set("ETag", object.httpEtag);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, no-store");

  let status = 200;
  if (object.range && "offset" in object.range && "length" in object.range) {
    status = 206;
    headers.set("Content-Range", `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`);
    headers.set("Content-Length", String(object.range.length));
  }
  return new Response(object.body, { status, headers });
}

function publicReviewRow(row) {
  return {
    id: row.id,
    filename: row.filename,
    title: row.title,
    uploader: row.uploader,
    subject: row.subject,
    category: row.category,
    docType: row.doc_type,
    fileKind: row.file_kind || "",
    size: row.size,
    createdAt: row.created_at,
    status: row.status,
    tournamentName: row.tournament_name || "",
    tournamentYear: row.tournament_year || "",
  };
}

function tournamentForSubject(subject) {
  if (subject === "2026インハイ") return "2026インターハイ";
  if (subject === "中国大会予選") return "中国大会予選";
  return "";
}

function formatTournament(name, year) {
  if (!name && !year) return "";
  return `${year || ""}${name || ""}`;
}

async function updateMetadata(request, env, corsHeaders, row, tokenHash) {
  let body;
  try {
    body = await request.json();
  } catch {
    throw new ApiError("更新内容が正しくありません。");
  }
  const filename = normalizeFilename(body.filename);
  const title = cleanText(body.title, 120);
  const tournamentName = cleanText(body.tournamentName, 100);
  const tournamentYear = normalizeTournamentYear(body.tournamentYear);
  if (!filename) throw new ApiError("PDF形式のファイル名を指定してください。");
  if (!title) throw new ApiError("タイトルを入力してください。");
  if (requiresTournamentInfo(row.file_kind, row.subject) && !tournamentName) throw new ApiError("大会名を入力してください。");
  if (requiresTournamentInfo(row.file_kind, row.subject) && !tournamentYear) throw new ApiError("大会年度を4桁で入力してください。");

  const result = await env.DB.prepare(
    `UPDATE submissions
        SET filename = ?, title = ?, tournament_name = ?, tournament_year = ?
      WHERE id = ? AND review_token_hash = ? AND status IN ('pending', 'incomplete')`,
  ).bind(filename, title, tournamentName, tournamentYear, row.id, tokenHash).run();
  if (result.meta.changes !== 1) throw new ApiError("更新できませんでした。", 409);
  return json({
    success: true,
    submission: publicReviewRow({
      ...row,
      filename,
      title,
      tournament_name: tournamentName,
      tournament_year: tournamentYear,
    }),
  }, 200, corsHeaders);
}

async function listComments(env, corsHeaders, submissionId) {
  const result = await env.DB.prepare(
    `SELECT id, author, body, created_at
       FROM submission_comments
      WHERE submission_id = ?
      ORDER BY created_at ASC`,
  ).bind(submissionId).all();
  return json({ comments: result.results.map((comment) => ({
    id: comment.id,
    author: comment.author,
    body: comment.body,
    createdAt: comment.created_at,
  })) }, 200, corsHeaders);
}

async function addComment(request, env, corsHeaders, submissionId) {
  let input;
  try {
    input = await request.json();
  } catch {
    throw new ApiError("コメントが正しくありません。");
  }
  const author = cleanText(input.author, 80);
  const body = cleanText(input.body, 1000);
  if (!author) throw new ApiError("投稿者名を入力してください。");
  if (!body) throw new ApiError("コメントを入力してください。");
  const comment = { id: crypto.randomUUID(), author, body, createdAt: new Date().toISOString() };
  await env.DB.prepare(
    `INSERT INTO submission_comments (id, submission_id, author, body, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(comment.id, submissionId, author, body, comment.createdAt).run();
  return json({ success: true, comment }, 201, corsHeaders);
}

export async function validateUpload(formData, configuredMaxSize) {
  const file = formData.get("file");
  const docType = cleanText(formData.get("doc_type"), 20);
  const fileKind = cleanText(formData.get("file_kind"), 20);
  const subject = cleanText(formData.get("subject"), 40);
  const title = cleanText(formData.get("title"), 120);
  const uploader = cleanText(formData.get("uploader"), 80);
  const tournamentName = cleanText(formData.get("tournament_name"), 100);
  const tournamentYear = normalizeTournamentYear(formData.get("tournament_year"));
  const filename = normalizeFilename(formData.get("filename") || file?.name);
  const maxFileSize = parseMaxFileSize(configuredMaxSize);

  if (!file || typeof file.stream !== "function") throw new ApiError("ファイルが添付されていません。");
  if (!["question", "answer", "mix"].includes(docType)) throw new ApiError("問題か答えかの選択が正しくありません。");
  if (!["self_made", "past_exam"].includes(fileKind)) throw new ApiError("種別が正しくありません。");
  if (!SUBJECTS[subject]) throw new ApiError("担当科目が正しくありません。");
  if (!title) throw new ApiError("タイトルを入力してください。");
  if (!uploader) throw new ApiError("アップロード者名を入力してください。");
  if (requiresTournamentInfo(fileKind, subject) && !tournamentName) throw new ApiError("大会名を入力してください。");
  if (requiresTournamentInfo(fileKind, subject) && !tournamentYear) throw new ApiError("大会年度を4桁で入力してください。");
  if (!filename) throw new ApiError("PDF形式のファイル名を指定してください。");
  if (file.size <= 0) throw new ApiError("ファイルが空です。");
  if (file.size > maxFileSize) {
    throw new ApiError(`ファイルサイズは${Math.floor(maxFileSize / 1024 / 1024)}MB以下にしてください。`, 413);
  }
  const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...signature) !== "%PDF-") throw new ApiError("PDFファイルの内容を確認できませんでした。");

  return { file, docType, fileKind, subject, title, uploader, filename, tournamentName, tournamentYear };
}

// Keep the long-standing `kadai` hierarchy exclusively for past exams.  Self-made
// papers are grouped by the tournament they were written for, then by subject.
// The UUID avoids collisions while keeping the folders useful when browsing R2.
export function storageKeyFor(input, id, isIncomplete = false) {
  if (isIncomplete) return `incomplete/${id}/${input.filename}`;

  const subject = SUBJECTS[input.subject];
  if (!subject) throw new ApiError("担当科目が正しくありません。");
  if (input.fileKind === "past_exam") {
    return `kadai/${subject.slug}/${id}/${input.filename}`;
  }
  if (!requiresTournamentInfo(input.fileKind, input.subject)) {
    return `self-made/${subject.slug}/${id}/${input.filename}`;
  }
  return `tournaments/${storageSegment(input.tournamentYear)}-${storageSegment(input.tournamentName)}/${subject.slug}/${id}/${input.filename}`;
}

function requiresTournamentInfo(fileKind, subject) {
  return fileKind !== "self_made" || !["気象", "救急"].includes(subject);
}

function storageSegment(value) {
  // R2 permits Unicode keys, but omit separators and control characters so a
  // tournament name can never alter the intended hierarchy.
  return String(value || "")
    .normalize("NFC")
    .replace(/[\\/\u0000-\u001f\u007f]/g, "-")
    .trim()
    .replace(/\s+/g, "-") || "unknown";
}

export function createCorsHeaders(origin, configuredOrigins) {
  const allowed = configuredOrigins
    ? String(configuredOrigins).split(",").map((value) => value.trim()).filter(Boolean)
    : DEFAULT_ALLOWED_ORIGINS;
  if (origin && !allowed.includes(origin)) return null;

  const headers = new Headers({
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Range, If-None-Match, X-Admin-Token",
    "Access-Control-Expose-Headers": "Content-Length, Content-Range, ETag",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  });
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

function normalizeFilename(value) {
  const filename = cleanText(value, 120).normalize("NFC");
  if (!filename || !filename.toLowerCase().endsWith(".pdf")) return "";
  if (filename.includes("..") || /[\\/\u0000-\u001f\u007f]/.test(filename)) return "";
  return filename;
}

function contentDisposition(filename, inline) {
  const fallback = filename.replace(/[^A-Za-z0-9._-]/g, "_") || "document.pdf";
  return `${inline ? "inline" : "attachment"}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeTournamentYear(value) {
  const year = cleanText(value, 4);
  return /^(?:19|20)\d{2}$/.test(year) ? year : "";
}

function parseMaxFileSize(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_FILE_SIZE;
}

function createReviewToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hashToken(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function json(body, status, corsHeaders, extraHeaders = {}) {
  const headers = new Headers(corsHeaders || undefined);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  for (const [key, value] of Object.entries(extraHeaders)) headers.set(key, value);
  return new Response(JSON.stringify(body), { status, headers });
}

class ApiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function sendLineNotification(token, userId, data, notificationUrl, isIncomplete) {
  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      to: userId,
      messages: [{
        type: "text",
        text: isIncomplete
          ? `未完成品がアップロードされました。\n\n【科目】${data.subject}\n【タイトル】${data.title}\n【投稿者】${data.uploader}\n【ファイル名】${data.filename}\n\n確認・コメント:\n${notificationUrl}`
          : `ファイルがアップロードされました。\n\n【科目】${data.subject}\n【タイトル】${data.title}\n【投稿者】${data.uploader}\n【ファイル名】${data.filename}\n\n確認・公開:\n${notificationUrl}`,
      }],
    }),
  });
  if (!response.ok) throw new Error(`LINE API returned ${response.status}`);
}
