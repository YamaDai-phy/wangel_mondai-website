(function () {
  const API = "https://pdf-upload-api.yamadai.workers.dev";
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id") || "";
  const token = params.get("token") || "";
  const status = document.getElementById("review-status");
  const content = document.getElementById("review-content");
  const approveButton = document.getElementById("approve-button");
  const rejectButton = document.getElementById("reject-button");

  function endpoint(action) {
    const suffix = action ? `/${action}` : "";
    return `${API}/review/${encodeURIComponent(id)}${suffix}?token=${encodeURIComponent(token)}`;
  }

  function setStatus(message, kind) {
    status.textContent = message;
    status.className = `upload-status is-${kind}`;
  }

  function setButtonsDisabled(disabled) {
    approveButton.disabled = disabled;
    rejectButton.disabled = disabled;
  }

  async function request(action) {
    const response = await fetch(endpoint(action), { method: action ? "POST" : "GET" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "処理に失敗しました。");
    return result;
  }

  async function load() {
    if (!id || !token) {
      setStatus("確認リンクが正しくありません。", "error");
      return;
    }
    try {
      const { submission } = await request("");
      document.getElementById("review-title").textContent = submission.title;
      document.getElementById("review-subject").textContent = submission.subject;
      const typeLabels = { question: "問題", answer: "答え", incomplete: "未完成品" };
      document.getElementById("review-type").textContent = typeLabels[submission.docType] || submission.docType;
      document.getElementById("review-uploader").textContent = submission.uploader;
      document.getElementById("review-filename").textContent = submission.filename;
      document.getElementById("review-size").textContent = `${(submission.size / 1024 / 1024).toFixed(2)} MB`;
      document.getElementById("review-created").textContent = new Date(submission.createdAt).toLocaleString("ja-JP");
      document.getElementById("review-pdf").src = endpoint("file");
      content.hidden = false;
      setStatus("内容を確認して、公開または却下してください。", "info");
    } catch (error) {
      setStatus(error.message, "error");
    }
  }

  approveButton.addEventListener("click", async () => {
    if (!window.confirm("このPDFをサイトで公開しますか？")) return;
    setButtonsDisabled(true);
    try {
      await request("approve");
      document.getElementById("review-pdf").src = "about:blank";
      content.hidden = true;
      window.history.replaceState({}, "", "review.html");
      setStatus("公開しました。PDF一覧へ自動的に表示されます。", "success");
    } catch (error) {
      setStatus(error.message, "error");
      setButtonsDisabled(false);
    }
  });

  rejectButton.addEventListener("click", async () => {
    if (!window.confirm("この投稿を却下してPDFを削除しますか？")) return;
    setButtonsDisabled(true);
    try {
      await request("reject");
      document.getElementById("review-pdf").src = "about:blank";
      content.hidden = true;
      window.history.replaceState({}, "", "review.html");
      setStatus("投稿を却下し、PDFを削除しました。", "success");
    } catch (error) {
      setStatus(error.message, "error");
      setButtonsDisabled(false);
    }
  });

  load();
})();
