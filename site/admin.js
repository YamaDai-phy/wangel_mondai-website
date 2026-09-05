(function () {
  const API = "https://pdf-upload-api.yamadai.workers.dev";
  const tokenKey = "wangel-admin-token";
  let token = sessionStorage.getItem(tokenKey) || "";
  let submissions = [];
  let filter = "pending";

  const auth = document.getElementById("admin-auth");
  const dashboard = document.getElementById("admin-dashboard");
  const status = document.getElementById("admin-status");
  const list = document.getElementById("admin-submission-list");
  const dialog = document.getElementById("admin-pdf-dialog");
  const pdfFrame = document.getElementById("admin-pdf-frame");

  function api(path, options = {}) {
    return fetch(`${API}${path}`, {
      ...options,
      headers: { "X-Admin-Token": token, ...(options.headers || {}) },
    }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "通信に失敗しました。");
      return data;
    });
  }
  function setStatus(message, kind = "info") {
    status.textContent = message;
    status.className = `admin-status is-${kind}`;
  }
  function label(statusValue) {
    return { pending: "承認待ち", published: "公開中", hidden: "非表示", incomplete: "未完成", rejected: "却下" }[statusValue] || statusValue;
  }
  function typeLabel(item) {
    const kind = { self_made: "自作", past_exam: "過去問" }[item.fileKind];
    const documentType = { question: "問題", answer: "答え", mix: "問題・答え", incomplete: "未完成" }[item.docType];
    return [kind, documentType, item.subject].filter(Boolean).join("・");
  }
  function escapeHtml(value) {
    const node = document.createElement("span");
    node.textContent = value || "";
    return node.innerHTML;
  }
  function render() {
    const counts = submissions.reduce((result, item) => ({ ...result, [item.status]: (result[item.status] || 0) + 1 }), {});
    document.getElementById("admin-summary").textContent = `全${submissions.length}件 / 承認待ち${counts.pending || 0}件`;
    document.querySelectorAll("[data-filter]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.filter === filter);
      const count = button.dataset.filter === "all" ? submissions.length : (counts[button.dataset.filter] || 0);
      button.querySelector("span").textContent = count;
    });
    const visible = filter === "all" ? submissions : submissions.filter((item) => item.status === filter);
    list.innerHTML = "";
    if (!visible.length) {
      list.innerHTML = '<tr><td colspan="6" class="admin-empty">該当するPDFはありません。</td></tr>';
      return;
    }
    visible.forEach((item) => {
      const row = document.createElement("tr");
      row.innerHTML = `<td><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.filename)}<br>${escapeHtml(item.tournamentYear)} ${escapeHtml(item.tournamentName)}</small></td><td>${escapeHtml(typeLabel(item))}</td><td>${escapeHtml(item.uploader)}</td><td>${new Date(item.createdAt).toLocaleString("ja-JP")}</td><td><span class="admin-state state-${item.status}">${label(item.status)}</span></td><td><div class="admin-actions"><button type="button" class="icon-button" data-action="file" title="PDFを確認" aria-label="PDFを確認">表示</button>${item.status === "pending" ? '<button type="button" data-action="approve" class="approve-button">承認</button>' : ""}${item.status === "published" ? '<button type="button" data-action="hide" class="secondary-button">非表示</button>' : ""}${item.status === "hidden" ? '<button type="button" data-action="restore" class="approve-button">再公開</button>' : ""}<button type="button" data-action="delete" class="delete-button">削除</button></div></td>`;
      row.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => act(item, button.dataset.action)));
      list.appendChild(row);
    });
  }
  async function load() {
    try {
      setStatus("PDF一覧を読み込んでいます。");
      const data = await api("/admin/submissions");
      submissions = data.submissions || [];
      render();
      setStatus("");
    } catch (error) {
      setStatus(error.message, "error");
      if (/トークン|認証/.test(error.message)) logout();
    }
  }
  async function act(item, action) {
    if (action === "file") return openPdf(item);
    const messages = { approve: "このPDFを公開しますか？", hide: "このPDFを非表示にしますか？ 公開一覧からはすぐに消えます。", restore: "このPDFを再公開しますか？", delete: "このPDFを完全に削除しますか？ この操作は元に戻せません。" };
    if (!confirm(messages[action])) return;
    try {
      setStatus("処理しています。");
      await api(`/admin/submissions/${encodeURIComponent(item.id)}/${action}`, { method: action === "delete" ? "DELETE" : "POST" });
      await load();
      setStatus(action === "delete" ? "PDFを削除しました。" : `${label(item.status)}のPDFを更新しました。`, "success");
    } catch (error) { setStatus(error.message, "error"); }
  }
  async function openPdf(item) {
    try {
      setStatus("PDFを開いています。");
      const response = await fetch(`${API}/admin/submissions/${encodeURIComponent(item.id)}/file`, { headers: { "X-Admin-Token": token } });
      if (!response.ok) throw new Error("PDFを開けませんでした。");
      const blobUrl = URL.createObjectURL(await response.blob());
      pdfFrame.src = blobUrl;
      document.getElementById("admin-pdf-title").textContent = item.title;
      dialog.showModal();
      setStatus("");
    } catch (error) { setStatus(error.message, "error"); }
  }
  function logout() {
    sessionStorage.removeItem(tokenKey);
    token = "";
    dashboard.hidden = true;
    auth.hidden = false;
    document.getElementById("admin-token").value = "";
  }
  document.getElementById("admin-auth-form").addEventListener("submit", (event) => {
    event.preventDefault();
    token = document.getElementById("admin-token").value;
    sessionStorage.setItem(tokenKey, token);
    auth.hidden = true;
    dashboard.hidden = false;
    load();
  });
  document.getElementById("admin-refresh").addEventListener("click", load);
  document.getElementById("admin-logout").addEventListener("click", logout);
  document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => { filter = button.dataset.filter; render(); }));
  document.getElementById("admin-pdf-close").addEventListener("click", () => { dialog.close(); pdfFrame.src = "about:blank"; });
  if (token) { auth.hidden = true; dashboard.hidden = false; load(); }
})();
