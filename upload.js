(function () {
  const subjectToSlug = {
    共通: "kyotsu",
    自然観察: "shizekan",
    気象: "kishou",
    救急: "kyukyu",
    インターハイ: "inhai",
    県総体: "kensotai",
  };

  const subjectToTitlePrefix = {
    共通: "共通",
    自然観察: "自然観察",
    気象: "気象",
    救急: "救急",
    インターハイ: "インターハイ",
    県総体: "県総体",
  };

  const rootButton = document.getElementById("pick-root-button");
  const form = document.getElementById("upload-form");
  const endpointInput = document.getElementById("endpoint-input");
  const subjectSelect = document.getElementById("subject-select");
  const fileInput = document.getElementById("pdf-file");
  const filenameInput = document.getElementById("filename-input");
  const titleInput = document.getElementById("title-input");
  const uploaderInput = document.getElementById("uploader-input");
  const pathHidden = document.getElementById("path-hidden");
  const targetPath = document.getElementById("target-path");
  const titlePreview = document.getElementById("title-preview");
  const uploaderPreview = document.getElementById("uploader-preview");
  const categoryTitles = document.getElementById("category-titles");
  const uploadStatus = document.getElementById("upload-status");
  const uploadNote = document.getElementById("upload-note");

  let pdfData = { papers: [] };
  const endpointKey = "upload-endpoint-url";

  function slugForSubject(subject) {
    return subjectToSlug[subject] || "";
  }

  function titlePrefixForSubject(subject) {
    return subjectToTitlePrefix[subject] || subject || "";
  }

  function formatJapaneseNumber(number) {
    if (number >= 1 && number <= 9) {
      return ["１", "２", "３", "４", "５", "６", "７", "８", "９"][number - 1];
    }
    return String(number);
  }

  function stripPdfExtension(name) {
    return String(name || "").replace(/\.pdf$/i, "");
  }

  function splitFilename(name) {
    const fileName = String(name || "").trim();
    const match = fileName.match(/^(.*?)(\.pdf)$/i);
    if (!match) {
      return { base: fileName, ext: "" };
    }
    return { base: match[1], ext: match[2] };
  }

  function setStatus(message, kind) {
    uploadStatus.className = `upload-status ${kind ? `is-${kind}` : ""}`.trim();
    uploadStatus.textContent = message;
  }

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function loadSavedEndpoint() {
    try {
      return localStorage.getItem(endpointKey) || "";
    } catch {
      return "";
    }
  }

  function saveEndpoint(value) {
    try {
      localStorage.setItem(endpointKey, value);
    } catch {
      // ignore
    }
  }

  function getUsedNumbers(subject) {
    const slug = slugForSubject(subject);
    const regex = new RegExp(`^${slug}(\\d+)\\.pdf$`, "i");
    const numbers = new Set();
    for (const paper of Array.isArray(pdfData.papers) ? pdfData.papers : []) {
      if (!paper || paper.category !== subject) continue;
      const filename = String(paper.filename || "");
      const match = filename.match(regex);
      if (match) {
        numbers.add(Number(match[1]));
      }
    }
    return numbers;
  }

  function getUsedFilenames(subject) {
    const filenames = new Set();
    for (const paper of Array.isArray(pdfData.papers) ? pdfData.papers : []) {
      if (!paper || paper.category !== subject) continue;
      if (paper.filename) {
        filenames.add(String(paper.filename).toLowerCase());
      }
    }
    return filenames;
  }

  function getUsedTitles() {
    const titles = new Set();
    for (const paper of Array.isArray(pdfData.papers) ? pdfData.papers : []) {
      if (!paper || !paper.title) continue;
      titles.add(String(paper.title).toLowerCase());
    }
    return titles;
  }

  function makeUniqueFilename(subject, filename) {
    const baseInput = normalizeText(filename);
    if (!baseInput) {
      return "";
    }
    const { base, ext } = splitFilename(baseInput);
    const subjectSlug = slugForSubject(subject);
    const usedFilenames = getUsedFilenames(subject);
    let candidate = `${base}${ext || ".pdf"}`;
    if (!usedFilenames.has(candidate.toLowerCase())) {
      return candidate;
    }

    let counter = 2;
    while (true) {
      candidate = `${base}-${counter}${ext || ".pdf"}`;
      if (!usedFilenames.has(candidate.toLowerCase())) {
        return candidate;
      }
      counter += 1;
    }
  }

  function makeUniqueTitle(title) {
    const base = normalizeText(title);
    if (!base) {
      return "";
    }
    const usedTitles = getUsedTitles();
    let candidate = base;
    if (!usedTitles.has(candidate.toLowerCase())) {
      return candidate;
    }

    let counter = 2;
    while (true) {
      candidate = `${base}（${counter}）`;
      if (!usedTitles.has(candidate.toLowerCase())) {
        return candidate;
      }
      counter += 1;
    }
  }

  function getNextNumber(subject) {
    const usedNumbers = getUsedNumbers(subject);
    let number = 1;
    while (usedNumbers.has(number)) {
      number += 1;
    }
    return number;
  }

  function buildGeneratedName(subject) {
    const slug = slugForSubject(subject);
    if (!slug) {
      return { filename: "", title: "" };
    }
    const number = getNextNumber(subject);
    const base = `${slug}${number}`;
    return {
      filename: `${base}.pdf`,
      title: `${titlePrefixForSubject(subject)}${formatJapaneseNumber(number)}`,
      number,
    };
  }

  function buildAutoFilename(subject) {
    if (subject === "共通") {
      const typedName = stripPdfExtension(normalizeText(filenameInput.value));
      const fallbackName = stripPdfExtension(normalizeText(fileInput.files && fileInput.files[0] ? fileInput.files[0].name : ""));
      const baseName = typedName || fallbackName;
      if (!baseName) {
        return "";
      }
      if (/^kyoutsu-/i.test(baseName)) {
        return `${baseName}.pdf`;
      }
      return `kyoutsu-${baseName}.pdf`;
    }
    if (subject === "気象" || subject === "救急") {
      return buildGeneratedName(subject).filename;
    }
    return normalizeText(filenameInput.value) || normalizeText(fileInput.files && fileInput.files[0] ? fileInput.files[0].name : "") || "";
  }

  function subjectUsesAutoTitle(subject) {
    return subject === "気象" || subject === "救急";
  }

  function buildDefaultFilename(subject, fileName) {
    if (!subject) {
      return "";
    }
    if (subject === "共通") {
      return makeUniqueFilename(subject, buildAutoFilename(subject) || `kyoutsu-${stripPdfExtension(normalizeText(fileName))}.pdf`);
    }
    if (subjectUsesAutoTitle(subject)) {
      return makeUniqueFilename(subject, buildAutoFilename(subject));
    }
    return makeUniqueFilename(subject, buildAutoFilename(subject) || normalizeText(fileName) || "");
  }

  function buildDefaultTitle(subject, filename) {
    if (!subject) {
      return "";
    }
    if (subjectUsesAutoTitle(subject)) {
      return makeUniqueTitle(buildGeneratedName(subject).title);
    }
    return makeUniqueTitle(normalizeText(titleInput.value) || stripPdfExtension(filename) || "");
  }

  function currentSubjectEntries(subject) {
    const list = Array.isArray(pdfData.papers) ? pdfData.papers : [];
    return list.filter((paper) => paper && paper.category === subject);
  }

  function syncSubjectFieldModes(subject) {
    if (subject === "気象" || subject === "救急") {
      filenameInput.readOnly = true;
      filenameInput.placeholder = "kyukyu3.pdf";
    } else if (subject === "共通" || subject === "自然観察") {
      filenameInput.readOnly = false;
      filenameInput.placeholder = "山名を入力して kyoutsu- を付けます";
    } else {
      filenameInput.readOnly = false;
      filenameInput.placeholder = "山名や任意のファイル名";
    }

    if (subjectUsesAutoTitle(subject)) {
      titleInput.readOnly = true;
      titleInput.placeholder = `${subject}4`;
    } else {
      titleInput.readOnly = false;
      titleInput.placeholder = "変更できます";
    }
  }

  function updateCategoryPreview() {
    const subject = subjectSelect.value;
    const slug = slugForSubject(subject);
    syncSubjectFieldModes(subject);

    const fileName = fileInput.files && fileInput.files[0] ? fileInput.files[0].name : "";
    const filename = buildDefaultFilename(subject, fileName);
    const title = buildDefaultTitle(subject, filename);
    const path = subject && filename ? `pdf/kadai/${slug}/${filename}` : "未設定";
    targetPath.textContent = path;
    pathHidden.value = path === "未設定" ? "" : path;

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

  async function handleUpload(event) {
    event.preventDefault();

    const subject = normalizeText(subjectSelect.value);
    const file = fileInput.files && fileInput.files[0];
    const uploader = normalizeText(uploaderInput.value);
    const endpoint = normalizeText(endpointInput.value) || loadSavedEndpoint();
    const defaultFilename = buildDefaultFilename(subject, file && file.name);
    const defaultTitle = buildDefaultTitle(subject, defaultFilename);
    const filename = makeUniqueFilename(subject, normalizeText(filenameInput.value) || defaultFilename);
    const title = makeUniqueTitle(normalizeText(titleInput.value) || defaultTitle);

    if (!subject) {
      setStatus("担当科目を選んでください。", "error");
      return;
    }
    if (!file) {
      setStatus("アップロードする PDF を選んでください。", "error");
      return;
    }
    if (!uploader) {
      setStatus("アップロード者名を入力してください。", "error");
      return;
    }
    if (!filename) {
      setStatus("filename を入力してください。", "error");
      return;
    }
    if (!endpoint) {
      setStatus("送信先 API URL を入力してください。", "error");
      return;
    }

    try {
      saveEndpoint(endpoint);
      filenameInput.value = filename;
      titleInput.value = title;
      pathHidden.value = `pdf/kadai/${slugForSubject(subject)}/${filename}`;
      form.action = endpoint;
      form.method = "post";
      form.enctype = "multipart/form-data";
      form.target = "upload-result-frame";
      form.submit();

      endpointInput.value = endpoint;
      updateCategoryPreview();
      setStatus("送信しました。受信後にこちらで手動追加してください。", "success");
    } catch (error) {
      console.error(error);
      setStatus(error && error.message ? error.message : "送信に失敗しました。", "error");
    }
  }

  endpointInput.value = loadSavedEndpoint();
  if (endpointInput.value) {
    uploadNote.textContent = "送信先 API を保存済みです。担当科目に応じた連番を自動で送信します。";
  }

  endpointInput.addEventListener("input", () => {
    saveEndpoint(endpointInput.value.trim());
  });

  subjectSelect.addEventListener("change", () => {
    updateCategoryPreview();
  });

  fileInput.addEventListener("change", () => {
    const subject = normalizeText(subjectSelect.value);
    const file = fileInput.files && fileInput.files[0];
    if (file && !normalizeText(filenameInput.value)) {
      filenameInput.value = buildDefaultFilename(subject, file.name);
    }
    if (!subjectUsesAutoTitle(subject) && file && !normalizeText(titleInput.value)) {
      titleInput.value = stripPdfExtension(normalizeText(filenameInput.value) || file.name);
    }
    updateCategoryPreview();
  });

  filenameInput.addEventListener("input", updateCategoryPreview);
  titleInput.addEventListener("input", updateCategoryPreview);
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