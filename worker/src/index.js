const DEFAULT_ALLOWED_ORIGINS = [
  "https://wangel-mondai.pages.dev",
  "http://localhost:8787",
  "http://127.0.0.1:8787",
];

const SUBJECT_PATHS = {
  共通: "kyotsu",
  自然観察: "shizekan",
  気象: "kishou",
  救急: "kyukyu",
  "2026インハイ": "inhai2026",
  県総体: "kensotai",
  中国大会予選: "chutaiyusen",
};

const DEFAULT_MAX_FILE_SIZE = 20 * 1024 * 1024;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const corsHeaders = createCorsHeaders(origin, env.ALLOWED_ORIGINS);

    if (origin && !corsHeaders) {
      return json({ error: "このサイトからは送信できません。" }, 403);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method === "GET") {
      return json({ ok: true, service: "pdf-upload-api" }, 200, corsHeaders);
    }

    if (request.method !== "POST") {
      return json(
        { error: "Method Not Allowed" },
        405,
        corsHeaders,
        { Allow: "GET, POST, OPTIONS" },
      );
    }

    try {
      const formData = await request.formData();
      const input = await validateUpload(formData, env.MAX_FILE_SIZE);
      const existing = await env.PDF_BUCKET.head(input.savePath);

      if (existing) {
        return json(
          { error: "同名のファイルがすでに送信されています。ファイル名を変更してください。" },
          409,
          corsHeaders,
        );
      }

      const stored = await env.PDF_BUCKET.put(input.savePath, input.file.stream(), {
        httpMetadata: {
          contentType: "application/pdf",
          contentDisposition: `attachment; filename="${input.filename}"`,
        },
        customMetadata: {
          docType: input.docType,
          subject: input.subject,
          title: input.title,
          uploader: input.uploader,
          uploadedAt: new Date().toISOString(),
        },
        onlyIf: { etagDoesNotMatch: "*" },
      });

      if (!stored) {
        return json(
          { error: "同名のファイルが同時に送信されました。ファイル名を変更してください。" },
          409,
          corsHeaders,
        );
      }

      let notificationSent = false;
      if (env.LINE_CHANNEL_ACCESS_TOKEN && env.LINE_USER_ID) {
        try {
          await sendLineNotification(env.LINE_CHANNEL_ACCESS_TOKEN, env.LINE_USER_ID, input);
          notificationSent = true;
        } catch (error) {
          console.error("LINE notification failed", error);
        }
      }

      return json(
        {
          success: true,
          message: "アップロードが完了しました。確認後に掲載されます。",
          path: input.savePath,
          notificationSent,
        },
        201,
        corsHeaders,
      );
    } catch (error) {
      const status = error instanceof UploadError ? error.status : 500;
      if (status === 500) console.error("Upload failed", error);
      return json(
        { error: status === 500 ? "アップロード処理中にエラーが発生しました。" : error.message },
        status,
        corsHeaders,
      );
    }
  },
};

export async function validateUpload(formData, configuredMaxSize) {
  const file = formData.get("file");
  const docType = cleanText(formData.get("doc_type"), 20);
  const subject = cleanText(formData.get("subject"), 40);
  const title = cleanText(formData.get("title"), 120);
  const uploader = cleanText(formData.get("uploader"), 80);
  const filename = normalizeFilename(formData.get("filename") || file?.name);
  const maxFileSize = parseMaxFileSize(configuredMaxSize);

  if (!file || typeof file.stream !== "function") {
    throw new UploadError("ファイルが添付されていません。");
  }
  if (!["question", "answer"].includes(docType)) {
    throw new UploadError("種別が正しくありません。");
  }
  if (!SUBJECT_PATHS[subject]) {
    throw new UploadError("担当科目が正しくありません。");
  }
  if (!title) throw new UploadError("タイトルを入力してください。");
  if (!uploader) throw new UploadError("アップロード者名を入力してください。");
  if (!filename) throw new UploadError("PDF形式のファイル名を指定してください。");
  if (file.size <= 0) throw new UploadError("ファイルが空です。");
  if (file.size > maxFileSize) {
    throw new UploadError(`ファイルサイズは${Math.floor(maxFileSize / 1024 / 1024)}MB以下にしてください。`, 413);
  }
  const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...signature) !== "%PDF-") {
    throw new UploadError("PDFファイルの内容を確認できませんでした。");
  }

  return {
    file,
    docType,
    subject,
    title,
    uploader,
    filename,
    savePath: `pdf/kadai/${SUBJECT_PATHS[subject]}/${filename}`,
  };
}

export function createCorsHeaders(origin, configuredOrigins) {
  const allowed = configuredOrigins
    ? String(configuredOrigins).split(",").map((value) => value.trim()).filter(Boolean)
    : DEFAULT_ALLOWED_ORIGINS;

  if (origin && !allowed.includes(origin)) return null;

  const headers = new Headers({
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  });
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

function normalizeFilename(value) {
  const filename = cleanText(value, 120);
  if (!filename || !/^[A-Za-z0-9][A-Za-z0-9._-]*\.pdf$/i.test(filename)) return "";
  if (filename.includes("..")) return "";
  return filename;
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function parseMaxFileSize(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_FILE_SIZE;
}

function json(body, status, corsHeaders, extraHeaders = {}) {
  const headers = new Headers(corsHeaders || undefined);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  for (const [key, value] of Object.entries(extraHeaders)) headers.set(key, value);
  return new Response(JSON.stringify(body), { status, headers });
}

class UploadError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function sendLineNotification(token, userId, data) {
  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [{
        type: "text",
        text: `ファイルがアップロードされました。\n\n【科目】${data.subject}\n【タイトル】${data.title}\n【投稿者】${data.uploader}\n【ファイル名】${data.filename}\n【保存パス】\n${data.savePath}`,
      }],
    }),
  });

  if (!response.ok) throw new Error(`LINE API returned ${response.status}`);
}
