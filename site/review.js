(function () {
  const API = "https://pdf-upload-api.yamadai.workers.dev";
  const params = new URLSearchParams(location.search);
  const id = params.get("id") || "";
  const token = params.get("token") || "";
  const status = document.getElementById("review-status");
  const content = document.getElementById("review-content");
  const approveButton = document.getElementById("approve-button");
  const rejectButton = document.getElementById("reject-button");
  const commentsCard = document.getElementById("comments-card");

  const endpoint = (action = "") => `${API}/review/${encodeURIComponent(id)}${action ? `/${action}` : ""}?token=${encodeURIComponent(token)}`;
  function setStatus(message, kind) {
    status.textContent = message;
    status.className = `upload-status is-${kind}`;
  }
  async function request(action, options = {}) {
    const response = await fetch(endpoint(action), options);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "処理に失敗しました。");
    return result;
  }
  function displaySubmission(s) {
    document.getElementById("review-title").textContent = s.title;
    document.getElementById("review-subject").textContent = s.subject;
    const roleLabels = { question: "問題", answer: "答え", mix: "どちらも", incomplete: "未完成品" };
    const kindLabels = { self_made: "自作", past_exam: "過去問" };
    document.getElementById("review-type").textContent = [kindLabels[s.fileKind], roleLabels[s.docType] || s.docType].filter(Boolean).join("・");
    document.getElementById("review-uploader").textContent = s.uploader;
    document.getElementById("review-filename").textContent = s.filename;
    document.getElementById("review-size").textContent = `${(s.size / 1024 / 1024).toFixed(2)} MB`;
    document.getElementById("review-created").textContent = new Date(s.createdAt).toLocaleString("ja-JP");
    document.getElementById("review-filename-input").value = s.filename;
    document.getElementById("review-title-input").value = s.title;
    document.getElementById("review-tournament-name").value = s.tournamentName || "";
    document.getElementById("review-tournament-year").value = s.tournamentYear || "";
    const incomplete = s.status === "incomplete";
    approveButton.hidden = incomplete;
    rejectButton.hidden = incomplete;
    commentsCard.hidden = !incomplete;
  }
  function renderComments(comments) {
    const list = document.getElementById("comment-list");
    list.innerHTML = "";
    if (!comments.length) return void (list.textContent = "コメントはまだありません。");
    comments.forEach((comment) => {
      const article = document.createElement("article");
      const meta = document.createElement("div");
      meta.className = "comment-meta";
      meta.textContent = `${comment.author}・${new Date(comment.createdAt).toLocaleString("ja-JP")}`;
      const body = document.createElement("p");
      body.textContent = comment.body;
      article.append(meta, body);
      list.appendChild(article);
    });
  }
  async function loadComments() {
    const { comments } = await request("comments");
    renderComments(comments || []);
  }
  async function load() {
    if (!id || !token) return setStatus("確認リンクが正しくありません。", "error");
    try {
      const { submission } = await request();
      displaySubmission(submission);
      document.getElementById("review-pdf").src = endpoint("file");
      content.hidden = false;
      if (submission.status === "incomplete") await loadComments();
      setStatus(submission.status === "incomplete" ? "未完成ファイルの情報編集とコメントができます。" : "内容を確認し、必要なら情報を編集してから公開してください。", "info");
    } catch (error) { setStatus(error.message, "error"); }
  }
  document.getElementById("metadata-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = document.getElementById("metadata-save-button");
    button.disabled = true;
    try {
      const { submission } = await request("metadata", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        filename: document.getElementById("review-filename-input").value,
        title: document.getElementById("review-title-input").value,
        tournamentName: document.getElementById("review-tournament-name").value,
        tournamentYear: document.getElementById("review-tournament-year").value,
      }) });
      displaySubmission(submission);
      setStatus("変更を保存しました。", "success");
    } catch (error) { setStatus(error.message, "error"); }
    finally { button.disabled = false; }
  });
  document.getElementById("comment-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = document.getElementById("comment-submit");
    button.disabled = true;
    try {
      await request("comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ author: document.getElementById("comment-author").value, body: document.getElementById("comment-body").value }) });
      document.getElementById("comment-body").value = "";
      await loadComments();
      setStatus("コメントを追加しました。", "success");
    } catch (error) { setStatus(error.message, "error"); }
    finally { button.disabled = false; }
  });
  async function decide(action) {
    if (!confirm(action === "approve" ? "このPDFをサイトで公開しますか？" : "この投稿を却下してPDFを削除しますか？")) return;
    approveButton.disabled = rejectButton.disabled = true;
    try {
      await request(action, { method: "POST" });
      document.getElementById("review-pdf").src = "about:blank";
      content.hidden = true;
      history.replaceState({}, "", "review.html");
      setStatus(action === "approve" ? "公開しました。PDF一覧に表示されます。" : "投稿を却下し、PDFを削除しました。", "success");
    } catch (error) { setStatus(error.message, "error"); approveButton.disabled = rejectButton.disabled = false; }
  }
  approveButton.addEventListener("click", () => decide("approve"));
  rejectButton.addEventListener("click", () => decide("reject"));
  load();
})();
