(function () {
  const subjectToSlug = {
    共通: "kyotsu",
    自然観察: "shizekan",
    気象: "kishou",
    救急: "kyukyu",
    インターハイ: "inhai",
    県総体: "kensotai",
  };

  const rootButton = document.getElementById("pick-root-button");
  const rootLabel = document.getElementById("root-label");
  const form = document.getElementById("upload-form");
  const subjectSelect = document.getElementById("subject-select");
  const fileInput = document.getElementById("pdf-file");
  const filenameInput = document.getElementById("filename-input");
  const titleInput = document.getElementById("title-input");
  const uploaderInput = document.getElementById("uploader-input");
  const targetPath = document.getElementById("target-path");
  const titlePreview = document.getElementById("title-preview");
  const uploaderPreview = document.getElementById("uploader-preview");
  const categoryTitles = document.getElementById("category-titles");
  const uploadStatus = document.getElementById("upload-status");
  const uploadNote = document.getElementById("upload-note");

  let rootHandle = null;
  let pdfData = { papers: [] };
  let titleWasEdited = false;
  let filenameWasEdited = false;

  function slugForSubject(subject) {
    return subjectToSlug[subject] || "";
  }

  function stripPdfExtension(name) {
    return String(name || "").replace(/\.pdf$/i, "");
  }

  function setStatus(message, kind) {
    uploadStatus.className = `upload-status ${kind ? `is-${kind}` : ""}`.trim();
    uploadStatus.textContent = message;
  }

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function currentSubjectEntries(subject) {
    const list = Array.isArray(pdfData.papers) ? pdfData.papers : [];
    return list.filter((paper) => paper && paper.category === subject);
  }

  function existingEntry(subject, filename) {
    const slug = slugForSubject(subject);
    const path = `pdf/kadai/${slug}/${filename}`;
    return currentSubjectEntries(subject).find(
      (paper) => paper.path === path || paper.filename === filename,
    );
  }

  function suggestTitle(subject, filename) {
    const matched = existingEntry(subject, filename);
    if (matched && matched.title) {
      return String(matched.title);
    }
    const base = stripPdfExtension(filename);
    if (base) {
      return base;
    }
    return subject || "未設定";
  }

  function updateCategoryPreview() {
    const subject = subjectSelect.value;
    const filename = normalizeText(filenameInput.value) || (fileInput.files[0] && fileInput.files[0].name) || "";
    const slug = slugForSubject(subject);
    const path = subject && filename ? `pdf/kadai/${slug}/${filename}` : "未設定";
    targetPath.textContent = path;

    const title = normalizeText(titleInput.value) || (subject && filename ? suggestTitle(subject, filename) : "未設定");
    titlePreview.textContent = title || "未設定";
    uploaderPreview.textContent = normalizeText(uploaderInput.value) || "未設定";

    const entries = subject ? currentSubjectEntries(subject) : [];
    categoryTitles.innerHTML = "";
    if (!subject) {
      categoryTitles.textContent = "科目を選ぶと既存タイトルを表示します。";
      return;
    }
    if (entries.length === 0) {
      categoryTitles.textContent = "まだ登録がありません。";
      return;
    }
    for (const paper of entries.slice(0, 30)) {
      const tag = document.createElement("span");
      tag.className = "upload-tag";
      tag.textContent = paper.title || paper.filename || "無題";
      categoryTitles.appendChild(tag);
    }
  }

  async function loadDataJson() {
    const response = await fetch("pdf/data.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("pdf/data.json を読み込めませんでした。");
    }
    pdfData = await response.json();
    if (!pdfData || typeof pdfData !== "object") {
      pdfData = { papers: [] };
    }
    updateCategoryPreview();
  }

  async function pickRootDirectory() {
    if (!window.showDirectoryPicker) {
      throw new Error("このブラウザでは保存先フォルダの選択に対応していません。");
    }
    rootHandle = await window.showDirectoryPicker({ mode: "readwrite" });
    rootLabel.textContent = rootHandle.name || "選択済み";
    uploadNote.textContent = "保存先ルートを選択しました。pdf フォルダを含むプロジェクトルートを選んでください。";
  }

  async function resolvePdfDirectory() {
    if (!rootHandle) {
      throw new Error("先に保存先フォルダを選んでください。");
    }
    if (rootHandle.name === "pdf") {
      return rootHandle;
    }
    try {
      return await rootHandle.getDirectoryHandle("pdf", { create: false });
    } catch {
      throw new Error("選択した保存先の中に pdf フォルダが見つかりません。");
    }
  }

  async function ensureDirectory(parent, name) {
    return parent.getDirectoryHandle(name, { create: true });
  }

  async function writeDataJson(pdfDirectory, nextData) {
    const dataHandle = await pdfDirectory.getFileHandle("data.json", { create: false });
    const writable = await dataHandle.createWritable();
    await writable.write(JSON.stringify(nextData, null, 2));
    await writable.close();
  }

  async function handleUpload(event) {
    event.preventDefault();

    const subject = normalizeText(subjectSelect.value);
    const file = fileInput.files && fileInput.files[0];
    const filename = normalizeText(filenameInput.value) || (file && file.name) || "";
    const title = normalizeText(titleInput.value) || suggestTitle(subject, filename);
    const uploader = normalizeText(uploaderInput.value);

    if (!subject) {
      setStatus("担当科目を選んでください。", "error");
      return;
    }
    if (!file) {
      setStatus("アップロードする PDF を選んでください。", "error");
      return;
    }
    if (!/\.pdf$/i.test(filename)) {
      setStatus("保存ファイル名は .pdf で終わるようにしてください。", "error");
      return;
    }
    if (!uploader) {
      setStatus("アップロード者名を入力してください。", "error");
      return;
    }

    try {
      const pdfDirectory = await resolvePdfDirectory();
      const subjectSlug = slugForSubject(subject);
      const kadaiDirectory = await ensureDirectory(pdfDirectory, "kadai");
      const subjectDirectory = await ensureDirectory(kadaiDirectory, subjectSlug);

      const fileHandle = await subjectDirectory.getFileHandle(filename, { create: true });
      const fileWriter = await fileHandle.createWritable();
      await fileWriter.write(file);
      await fileWriter.close();

      const dataHandle = await pdfDirectory.getFileHandle("data.json", { create: false });
      const dataFile = await dataHandle.getFile();
      const currentData = JSON.parse(await dataFile.text());
      const papers = Array.isArray(currentData.papers) ? currentData.papers.slice() : [];
      const path = `pdf/kadai/${subjectSlug}/${filename}`;
      const mtime = new Date(file.lastModified || Date.now()).toISOString();
      const entry = {
        filename,
        path,
        title,
        category: subject,
        size: file.size,
        mtime,
        ext: "pdf",
        uploader,
      };

      const index = papers.findIndex((paper) => paper && (paper.path === path || paper.filename === filename));
      if (index >= 0) {
        papers[index] = { ...papers[index], ...entry };
      } else {
        papers.push(entry);
      }

      currentData.papers = papers;
      await writeDataJson(pdfDirectory, currentData);

      pdfData = currentData;
      updateCategoryPreview();
      setStatus(`保存しました: ${path}`, "success");
    } catch (error) {
      console.error(error);
      setStatus(error && error.message ? error.message : "保存に失敗しました。", "error");
    }
  }

  rootButton.addEventListener("click", async () => {
    try {
      await pickRootDirectory();
      setStatus("保存先ルートを選びました。", "info");
    } catch (error) {
      console.error(error);
      setStatus(error && error.message ? error.message : "保存先ルートの選択を中止しました。", "error");
    }
  });

  subjectSelect.addEventListener("change", () => {
    if (!filenameWasEdited && fileInput.files[0]) {
      filenameInput.value = fileInput.files[0].name;
    }
    if (!titleWasEdited && fileInput.files[0]) {
      titleInput.value = suggestTitle(subjectSelect.value, filenameInput.value || fileInput.files[0].name);
    }
    updateCategoryPreview();
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      return;
    }
    if (!filenameWasEdited) {
      filenameInput.value = file.name;
    }
    if (!titleWasEdited) {
      titleInput.value = suggestTitle(subjectSelect.value, filenameInput.value || file.name);
    }
    updateCategoryPreview();
  });

  filenameInput.addEventListener("input", () => {
    filenameWasEdited = true;
    if (!titleWasEdited) {
      titleInput.value = suggestTitle(subjectSelect.value, filenameInput.value);
    }
    updateCategoryPreview();
  });

  titleInput.addEventListener("input", () => {
    titleWasEdited = true;
    updateCategoryPreview();
  });

  uploaderInput.addEventListener("input", updateCategoryPreview);

  form.addEventListener("submit", handleUpload);

  loadDataJson().catch((error) => {
    console.error(error);
    pdfData = { papers: [] };
    updateCategoryPreview();
    setStatus("pdf/data.json の読み込みに失敗しました。", "error");
  });

  updateCategoryPreview();
})();