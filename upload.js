(function () {
  // ----------------------------------------------------
  // 送信先 Worker API URL をここに設定します
  // ----------------------------------------------------
  const DEFAULT_ENDPOINT = "https://pdf-upload-api.yamadai.workers.dev/"; // ←ご自身の Worker URL に変更してください

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

  const form = document.getElementById("upload-form");
  const endpointInput = document.getElementById("endpoint-input");
  const subjectSelect = document.getElementById("subject-select");
  const mountainInput = document.getElementById("mountain-input");
  const mountainLabel =
    document.getElementById("mountain-label") ||
    (mountainInput && mountainInput.parentElement);
  const mountainEnInput = document.getElementById("mountain-en-input");
  const mountainEnLabel =
    document.getElementById("mountain-en-label") ||
    (mountainEnInput && mountainEnInput.parentElement);
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
  const uploadButton = document.getElementById("upload-button");

  let pdfData = { papers: [] };
  let isMountainEnManuallyEdited = false;
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

  // かな・カタカナ・アルファベットをヘボン式ローマ字へ簡易変換する関数
  function kanaToRomaji(str) {
    if (!str) return "";
    let text = str
      .normalize("NFKC")
      .replace(/[\u30a1-\u30f6]/g, (m) =>
        String.fromCharCode(m.charCodeAt(0) - 0x60),
      )
      .toLowerCase();

    const comboMap = {
      きゃ: "kya",
      きゅ: "kyu",
      きょ: "kyo",
      しゃ: "sha",
      しゅ: "shu",
      しょ: "sho",
      ちゃ: "cha",
      ちゅ: "chu",
      ちょ: "cho",
      にゃ: "nya",
      にゅ: "nyu",
      にょ: "nyo",
      ひゃ: "hya",
      ひゅ: "hyu",
      ひょ: "hyo",
      みゃ: "mya",
      みゅ: "myu",
      みょ: "myo",
      りゃ: "rya",
      りゅ: "ryu",
      りょ: "ryo",
      ぎゃ: "gya",
      ぎゅ: "gyu",
      ぎょ: "gyo",
      じゃ: "ja",
      じゅ: "ju",
      じょ: "jo",
      びゃ: "bya",
      びゅ: "byu",
      びょ: "byo",
      ぴゃ: "pya",
      ぴゅ: "pyu",
      ぴょ: "pyo",
    };

    const singleMap = {
      あ: "a",
      い: "i",
      う: "u",
      え: "e",
      お: "o",
      か: "ka",
      き: "ki",
      く: "ku",
      け: "ke",
      こ: "ko",
      さ: "sa",
      し: "shi",
      す: "su",
      せ: "se",
      そ: "so",
      た: "ta",
      ち: "chi",
      つ: "tsu",
      て: "te",
      と: "to",
      な: "na",
      に: "ni",
      ぬ: "nu",
      ね: "ne",
      の: "no",
      は: "ha",
      ひ: "hi",
      ふ: "fu",
      へ: "he",
      ほ: "ho",
      ま: "ma",
      み: "mi",
      む: "mu",
      め: "me",
      も: "mo",
      や: "ya",
      ゆ: "yu",
      よ: "yo",
      ら: "ra",
      り: "ri",
      る: "ru",
      れ: "re",
      ろ: "ro",
      わ: "wa",
      を: "o",
      ん: "n",
      が: "ga",
      ぎ: "gi",
      ぐ: "gu",
      げ: "ge",
      ご: "go",
      ざ: "za",
      じ: "ji",
      ず: "zu",
      ぜ: "ze",
      ぞ: "zo",
      だ: "da",
      ぢ: "ji",
      づ: "zu",
      で: "de",
      ど: "do",
      ば: "ba",
      び: "bi",
      ぶ: "bu",
      べ: "be",
      ぼ: "bo",
      ぱ: "pa",
      ぴ: "pi",
      ぷ: "pu",
      ぺ: "pe",
      ぽ: "po",
      ー: "",
    };

    for (const [key, val] of Object.entries(comboMap)) {
      text = text.replaceAll(key, val);
    }
    for (const [key, val] of Object.entries(singleMap)) {
      text = text.replaceAll(key, val);
    }
    text = text.replace(/っ([a-z])/g, "$1$1");

    return text.replace(/[^a-z0-9-]/g, "");
  }

  function getEndpoint() {
    if (endpointInput && normalizeText(endpointInput.value)) {
      return normalizeText(endpointInput.value);
    }
    try {
      const saved = localStorage.getItem(endpointKey);
      if (saved) return saved;
    } catch {
      // ignore
    }
    return DEFAULT_ENDPOINT;
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
      // 重複時はカッコを付けず全角数字を付与（例: 富士山２）
      candidate = `${base}${formatJapaneseNumber(counter)}`;
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

  function subjectUsesMountainInput(subject) {
    return subject === "共通" || subject === "自然観察";
  }

  function subjectUsesAutoTitle(subject) {
    return subject === "気象" || subject === "救急";
  }

  function buildAutoFilename(subject) {
    const mountainEn = mountainEnInput
      ? stripPdfExtension(normalizeText(mountainEnInput.value))
      : "";
    const mountain = mountainInput
      ? stripPdfExtension(normalizeText(mountainInput.value))
      : "";
    const typedFilename = stripPdfExtension(normalizeText(filenameInput.value));
    const fallbackName = stripPdfExtension(
      normalizeText(
        fileInput.files && fileInput.files[0] ? fileInput.files[0].name : "",
      ),
    );

    const baseName = mountainEn || mountain || typedFilename || fallbackName;

    if (subject === "共通") {
      if (!baseName) return "";
      if (/^kyoutsu-/i.test(baseName)) {
        return `${baseName}.pdf`;
      }
      return `kyoutsu-${baseName}.pdf`;
    }

    if (subject === "自然観察") {
      if (!baseName) return "";
      if (/^shizekan-/i.test(baseName)) {
        return `${baseName}.pdf`;
      }
      return `shizekan-${baseName}.pdf`;
    }

    if (subject === "気象" || subject === "救急") {
      return buildGeneratedName(subject).filename;
    }

    return (
      normalizeText(filenameInput.value) ||
      normalizeText(
        fileInput.files && fileInput.files[0] ? fileInput.files[0].name : "",
      ) ||
      ""
    );
  }

  function buildDefaultFilename(subject, fileName) {
    if (!subject) {
      return "";
    }
    if (subject === "共通") {
      return makeUniqueFilename(
        subject,
        buildAutoFilename(subject) ||
          `kyoutsu-${stripPdfExtension(normalizeText(fileName))}.pdf`,
      );
    }
    if (subject === "自然観察") {
      return makeUniqueFilename(
        subject,
        buildAutoFilename(subject) ||
          `shizekan-${stripPdfExtension(normalizeText(fileName))}.pdf`,
      );
    }
    if (subjectUsesAutoTitle(subject)) {
      return makeUniqueFilename(subject, buildAutoFilename(subject));
    }
    return makeUniqueFilename(
      subject,
      buildAutoFilename(subject) || normalizeText(fileName) || "",
    );
  }

  function buildDefaultTitle(subject, filename) {
    if (!subject) {
      return "";
    }
    if (subjectUsesAutoTitle(subject)) {
      return makeUniqueTitle(buildGeneratedName(subject).title);
    }

    const mountain = mountainInput ? normalizeText(mountainInput.value) : "";
    if (subjectUsesMountainInput(subject) && mountain) {
      // タイトルには日本語の山名を設定（例: 富士山）
      return makeUniqueTitle(mountain);
    }

    return makeUniqueTitle(
      normalizeText(titleInput.value) || stripPdfExtension(filename) || "",
    );
  }

  function currentSubjectEntries(subject) {
    const list = Array.isArray(pdfData.papers) ? pdfData.papers : [];
    return list.filter((paper) => paper && paper.category === subject);
  }

  function syncSubjectFieldModes(subject) {
    // 山の名前（日本語）項目の表示・非表示
    if (mountainLabel) {
      if (subjectUsesMountainInput(subject)) {
        mountainLabel.style.display = "";
        if (mountainInput) {
          mountainInput.required = true;
          mountainInput.placeholder = "例: 富士山 または ふじさん";
        }
      } else {
        mountainLabel.style.display = "none";
        if (mountainInput) {
          mountainInput.required = false;
          mountainInput.value = "";
        }
      }
    }

    // 山の名前（英語・ローマ字）項目の表示・非表示
    if (mountainEnLabel) {
      if (subjectUsesMountainInput(subject)) {
        mountainEnLabel.style.display = "";
        if (mountainEnInput) {
          mountainEnInput.required = true;
          mountainEnInput.placeholder =
            subject === "共通" ? "例: fuji" : "例: fuji";
        }
      } else {
        mountainEnLabel.style.display = "none";
        if (mountainEnInput) {
          mountainEnInput.required = false;
          mountainEnInput.value = "";
        }
      }
    }

    // filename / title のリードオンリー制御
    if (subject === "気象" || subject === "救急") {
      filenameInput.readOnly = true;
      filenameInput.placeholder = "自動補完されます";
      titleInput.readOnly = true;
      titleInput.placeholder = "自動補完されます";
    } else if (subjectUsesMountainInput(subject)) {
      filenameInput.readOnly = false;
      filenameInput.placeholder = "英語名から自動生成（手動修正可）";
      titleInput.readOnly = false;
      titleInput.placeholder = "日本語名から自動生成（手動修正可）";
    } else {
      filenameInput.readOnly = false;
      filenameInput.placeholder = "ファイル名を入力";
      titleInput.readOnly = false;
      titleInput.placeholder = "タイトルを入力";
    }
  }

  function updateCategoryPreview() {
    const subject = subjectSelect.value;
    const slug = slugForSubject(subject);
    syncSubjectFieldModes(subject);

    const fileName =
      fileInput.files && fileInput.files[0] ? fileInput.files[0].name : "";
    const filename = buildDefaultFilename(subject, fileName);
    const title = buildDefaultTitle(subject, filename);

    // 自動補完対象の科目の場合、フォーム入力欄にもリアルタイムで反映
    if (subjectUsesAutoTitle(subject)) {
      filenameInput.value = filename;
      titleInput.value = title;
    } else if (subjectUsesMountainInput(subject)) {
      const mountain = mountainInput ? normalizeText(mountainInput.value) : "";
      const mountainEn = mountainEnInput
        ? normalizeText(mountainEnInput.value)
        : "";
      if (mountain || mountainEn) {
        filenameInput.value = filename;
        titleInput.value = title;
      }
    }

    const path =
      subject && filename ? `pdf/kadai/${slug}/${filename}` : "未設定";
    targetPath.textContent = path;
    pathHidden.value = path === "未設定" ? "" : path;

    titlePreview.textContent = title || "未設定";
    uploaderPreview.textContent =
      normalizeText(uploaderInput.value) || "未設定";

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
    const endpoint = getEndpoint();
    const defaultFilename = buildDefaultFilename(subject, file && file.name);
    const defaultTitle = buildDefaultTitle(subject, defaultFilename);
    const filename = makeUniqueFilename(
      subject,
      normalizeText(filenameInput.value) || defaultFilename,
    );
    const title = makeUniqueTitle(
      normalizeText(titleInput.value) || defaultTitle,
    );
    const path = `pdf/kadai/${slugForSubject(subject)}/${filename}`;

    if (!subject) {
      setStatus("担当科目を選んでください。", "error");
      return;
    }
    if (subjectUsesMountainInput(subject)) {
      if (mountainInput && !normalizeText(mountainInput.value)) {
        setStatus("山の名前（日本語）を入力してください。", "error");
        return;
      }
      if (mountainEnInput && !normalizeText(mountainEnInput.value)) {
        setStatus("山の名前（英語/ローマ字）を入力してください。", "error");
        return;
      }
    }
    if (!file) {
      setStatus("PDF をアップロードしてください。", "error");
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
      setStatus("今使えねぇはごめんね", "error");
      return;
    }

    try {
      uploadButton.disabled = true;
      setStatus("アップロード中...", "info");

      const bodyData = new FormData();
      bodyData.append("file", file);
      bodyData.append("subject", subject);
      bodyData.append("filename", filename);
      bodyData.append("title", title);
      bodyData.append("uploader", uploader);
      bodyData.append("path", path);

      const res = await fetch(endpoint, {
        method: "POST",
        body: bodyData,
      });

      const result = await res.json();

      if (res.ok && result.success) {
        setStatus(`アップロード完了: ${result.path}`, "success");
        form.reset();
        isMountainEnManuallyEdited = false;
        updateCategoryPreview();
      } else {
        throw new Error(result.error || "アップロードに失敗しました。");
      }
    } catch (error) {
      console.error(error);
      setStatus(
        error && error.message ? error.message : "送信に失敗しました。",
        "error",
      );
    } finally {
      uploadButton.disabled = false;
    }
  }

  if (endpointInput) {
    endpointInput.value = getEndpoint();
    endpointInput.addEventListener("input", () => {
      saveEndpoint(endpointInput.value.trim());
    });
  }

  if (uploadNote) {
    uploadNote.textContent =
      "ファイルをアップロード後１～２日掲載にお時間をいただきます。";
  }

  subjectSelect.addEventListener("change", () => {
    isMountainEnManuallyEdited = false;
    if (mountainInput) mountainInput.value = "";
    if (mountainEnInput) mountainEnInput.value = "";
    filenameInput.value = "";
    titleInput.value = "";
    updateCategoryPreview();
  });

  if (mountainInput) {
    mountainInput.addEventListener("input", () => {
      // 英語欄が手動変更されていない場合は、ひらがな/カタカナ/英字からローマ字へ自動変換して補完
      if (!isMountainEnManuallyEdited && mountainEnInput) {
        const autoRomaji = kanaToRomaji(mountainInput.value);
        if (autoRomaji || mountainInput.value === "") {
          mountainEnInput.value = autoRomaji;
        }
      }
      updateCategoryPreview();
    });
  }

  if (mountainEnInput) {
    mountainEnInput.addEventListener("input", () => {
      // ユーザーが英語欄を直接編集した場合はフラグを立てて自動上書きを停止
      isMountainEnManuallyEdited = true;
      updateCategoryPreview();
    });
  }

  fileInput.addEventListener("change", () => {
    const subject = normalizeText(subjectSelect.value);
    const file = fileInput.files && fileInput.files[0];
    if (file && !normalizeText(filenameInput.value)) {
      filenameInput.value = buildDefaultFilename(subject, file.name);
    }
    if (
      !subjectUsesAutoTitle(subject) &&
      file &&
      !normalizeText(titleInput.value)
    ) {
      titleInput.value = stripPdfExtension(
        normalizeText(filenameInput.value) || file.name,
      );
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
