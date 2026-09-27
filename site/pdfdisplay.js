(function () {
  const papersApi = "https://pdf-upload-api.yamadai.workers.dev/data.json";
  const checkedKey = "download-link-checked";
  function loadChecked() {
    try {
      return new Set(JSON.parse(localStorage.getItem(checkedKey) || "[]"));
    } catch {
      return new Set();
    }
  }

  function saveChecked(checked) {
    try {
      localStorage.setItem(checkedKey, JSON.stringify([...checked]));
    } catch {
      // localStorage が使えない環境では無視する
    }
  }

  const checkedLinks = loadChecked();
  const selectedFiles = new Map();
  const bulkShareBar = document.querySelector(".bulk-share-bar");
  const selectedCount = document.getElementById("selected-file-count");
  const shareSelectedButton = document.getElementById("share-selected-files");
  const sharedSection = document.getElementById("shared-list-section");
  const sharedStatus = document.getElementById("shared-list-status");
  const copyListButton = document.getElementById("copy-shared-list");
  const shareListButton = document.getElementById("share-shared-list");
  const incomingIds = [...new Set((new URL(location.href).searchParams.get("share") || "").split(",").filter(Boolean))];
  let sharedUrl = "";
  if (incomingIds.length) sharedSection.hidden = false;

  function updateSelectedFilesUI() {
    const count = selectedFiles.size;
    if (selectedCount) selectedCount.textContent = `${count}件選択中`;
    if (shareSelectedButton) shareSelectedButton.disabled = count === 0;
    if (bulkShareBar) {
      bulkShareBar.classList.toggle("is-visible", count > 0);
      bulkShareBar.setAttribute("aria-hidden", String(count === 0));
    }
    document.body.classList.toggle("has-selected-files", count > 0);
  }

  async function copySharedList() {
    if (!sharedUrl) return;
    try {
      await navigator.clipboard.writeText(sharedUrl);
      sharedStatus.textContent = "共有リストのリンクをコピーしました。";
    } catch {
      sharedStatus.textContent = "コピーできませんでした。アドレスバーのURLをコピーしてください。";
    }
  }

  async function shareList() {
    if (!sharedUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "大会過去問の共有リスト",
          url: sharedUrl,
        });
      } else {
        await copySharedList();
      }
    } catch (error) {
      if (error.name !== "AbortError") alert("共有に失敗しました。");
    }
  }

  copyListButton.addEventListener("click", copySharedList);
  shareListButton.addEventListener("click", shareList);
  // 共有処理を呼び出す関数
  function sharePaper(p) {
    const shareUrl = new URL(p.path, window.location.href).href;
    const shareData = {
      title: p.title,
      text: `大会過去問: ${p.title} (${p.tournament || ""})`,
      url: shareUrl,
    };

    if (navigator.share) {
      navigator.share(shareData).catch((err) => {
        if (err.name !== "AbortError") console.error("共有失敗:", err);
      });
    } else {
      navigator.clipboard
        .writeText(shareUrl)
        .then(() => {
          alert("URLをクリップボードにコピーしました！");
        })
        .catch(() => {
          alert("コピーに失敗しました。");
        });
    }
  }

  // チェック状態を付与する処理
  function setCheckedLink(a, p) {
    const key = p.path || p.filename || p.title;
    if (checkedLinks.has(key)) {
      a.classList.add("is-checked");
    }
    a.addEventListener("click", () => {
      if (checkedLinks.has(key)) return;
      checkedLinks.add(key);
      saveChecked(checkedLinks);
      a.classList.add("is-checked");
    });
  }

  // ダウンロードリンクと共有ボタンを生成してラッパーで返す関数
  function mkLink(p) {
    const wrapper = document.createElement("div");
    wrapper.className = "action-container";

    // ダウンロードリンクの作成
    const a = document.createElement("a");
    const downloadUrl = new URL(p.path, location.href);
    downloadUrl.searchParams.set("download", "1");
    a.href = downloadUrl.href;
    a.setAttribute("aria-label", `${p.title || p.filename}をダウンロード`);
    const downloadLabel = document.createElement("span");
    downloadLabel.className = "action-label";
    downloadLabel.textContent = "ダウンロード";
    a.appendChild(downloadLabel);
    const downloadIcon = document.createElement("img");
    downloadIcon.className = "action-icon";
    downloadIcon.src = "icons/download.svg";
    downloadIcon.alt = "";
    a.appendChild(downloadIcon);
    a.classList.add("download-link");
    setCheckedLink(a, p);
    wrapper.appendChild(a);

    // 共有ボタンの作成
    const shareBtn = document.createElement("button");
    shareBtn.setAttribute("aria-label", `${p.title || p.filename}を共有`);
    const shareLabel = document.createElement("span");
    shareLabel.className = "action-label";
    shareLabel.textContent = "共有";
    shareBtn.appendChild(shareLabel);
    const shareIcon = document.createElement("img");
    shareIcon.className = "action-icon";
    shareIcon.src = "icons/ios-share.svg";
    shareIcon.alt = "";
    shareBtn.appendChild(shareIcon);
    shareBtn.className = "share-btn";
    shareBtn.type = "button";
    shareBtn.addEventListener("click", () => sharePaper(p));
    wrapper.appendChild(shareBtn);

    return wrapper;
  }
  fetch(papersApi, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("PDF一覧を読み込めませんでした。");
      return response.json();
    })
    .then((data) => {
      const mapping = {
        自然観察: "shizekan-list",
        気象: "kisho-list",
        救急: "kyukyu-list",
        天気図: "tenkizu-list",
        混在: "mixed-list",
        共通: "kyotsu-list",
        インターハイ: "inhai-list",
        県総体: "kensotai-list",
        chutaiyosen: "chutaiyosen-list",
      };
      const buckets = {};
      const selfMadeMapping = { 共通: "self-made-kyotsu-list", 自然観察: "self-made-shizekan-list", 気象: "self-made-kisho-list", 救急: "self-made-kyukyu-list" };
      Object.values(mapping).forEach((id) => (buckets[id] = []));
      Object.values(selfMadeMapping).forEach((id) => (buckets[id] = []));
      buckets["other-list"] = [];

      const papers = data.papers || [];
      function listIdFor(p) {
        const id =
          p.fileKind === "self_made"
            ? selfMadeMapping[p.subject || p.category] || "other-list"
            : mapping[p.category] ||
              (p.path && p.path.indexOf("pdf/kadai/shizekan/") !== -1
                ? "shizekan-list"
                : "other-list");
        return document.getElementById(id) ? id : "other-list";
      }
      for (const p of papers) {
        buckets[listIdFor(p)].push(p);
      }

      function renderTable(containerId, items) {
        const isShared = containerId === "shared-list";
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = "";
        if (items.length === 0) {
          container.innerHTML = "<p>該当ファイルがありません。</p>";
          return;
        }
        // For the main natural-observation list, show 注意自然観察 first,
        // then 問題自然観察, then the rest. Otherwise sort by title.
        if (containerId === "shizekan-list") {
          const priority = ["注意点"];
          items.sort((a, b) => {
            const ia = priority.indexOf(a.title);
            const ib = priority.indexOf(b.title);
            const aPri = ia !== -1;
            const bPri = ib !== -1;
            if (aPri && bPri) {
              if (ia !== ib) return ia - ib;
              return (a.title || "").localeCompare(b.title || "", "ja", {
                numeric: true,
              });
            }
            if (aPri) return -1;
            if (bPri) return 1;
            return (a.title || "").localeCompare(b.title || "", "ja", {
              numeric: true,
            });
          });
        } else if (!isShared) {
          items.sort((a, b) =>
            (a.title || "").localeCompare(b.title || "", "ja", {
              numeric: true,
            }),
          );
        }
        const table = document.createElement("table");
        const thead = document.createElement("thead");
        thead.innerHTML =
          `<tr>${isShared ? "" : "<th>選択</th>"}<th>タイトル</th><th>種別</th><th>大会</th><th>ダウンロード</th></tr>`;
        table.appendChild(thead);
        const tbody = document.createElement("tbody");
        for (const p of items) {
          const tr = document.createElement("tr");
          tr.dataset.path = p.path || p.filename || p.title || "";
          tr.dataset.category = p.category || "";

          const tdSelect = document.createElement("td");
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = selectedFiles.has(p.path);
          checkbox.setAttribute("aria-label", `${p.title || p.filename}を選択`);
          checkbox.addEventListener("change", () => {
            if (checkbox.checked) selectedFiles.set(p.path, p);
            else selectedFiles.delete(p.path);
            updateSelectedFilesUI();
          });
          tdSelect.appendChild(checkbox);

          // タイトル列
          const tdTitle = document.createElement("td");
          let t = p.title.replace(/\.(pdf)$/i, "");
          tdTitle.textContent = t;

          // 大会名列
          const tdTournament = document.createElement("td");
          tdTournament.textContent = p.tournament || "-";

          const tdType = document.createElement("td");
          const roleLabels = {
            question: "問題",
            answer: "答え",
            mix: "どちらも",
          };
          const kindLabels = { self_made: "自作", past_exam: "過去問" };
          tdType.textContent =
            [kindLabels[p.fileKind], roleLabels[p.docType]]
              .filter(Boolean)
              .join("・") || "-";

          // ダウンロード＆共有ボタン列
          const tdLink = document.createElement("td");
          // mkLink(p) がリンクとボタンをまとめた div を返すためそのまま append
          tdLink.appendChild(mkLink(p));

          if (!isShared) tr.appendChild(tdSelect);
          tr.appendChild(tdTitle);
          tr.appendChild(tdType);
          tr.appendChild(tdTournament);
          tr.appendChild(tdLink);
          tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        container.appendChild(table);
      }

      // Render natural-observation items together in `shizekan-list`
      renderTable("shizekan-list", buckets["shizekan-list"]);
      renderTable("kisho-list", buckets["kisho-list"]);
      renderTable("kyukyu-list", buckets["kyukyu-list"]);
      renderTable("tenkizu-list", buckets["tenkizu-list"]);
      renderTable("mixed-list", buckets["mixed-list"]);
      renderTable("kyotsu-list", buckets["kyotsu-list"]);
      renderTable("inhai-list", buckets["inhai-list"]);
      renderTable("kensotai-list", buckets["kensotai-list"]);
      renderTable("chutaiyosen-list", buckets["chutaiyosen-list"]);
      Object.values(selfMadeMapping).forEach((id) => renderTable(id, buckets[id]));
      // render any uncategorized files
      // create a container if not present
      let other = document.getElementById("other-list");
      if (!other) {
        const details = document.createElement("details");
        details.className = "accordion";
        const summary = document.createElement("summary");
        summary.className = "accordion__summary";
        summary.textContent = "その他";
        details.appendChild(summary);
        const div = document.createElement("div");
        div.id = "other-list";
        details.appendChild(div);
        document.querySelector(".details-section:not(.shared-list-section)").appendChild(details);
        other = div;
      }
      renderTable("other-list", buckets["other-list"]);

      function showSharedList(ids, scroll = false) {
        const byId = new Map(papers.map((paper) => [paper.id, paper]));
        const items = ids.map((id) => byId.get(id)).filter(Boolean);
        sharedSection.hidden = false;
        const url = new URL(location.href);
        url.search = "";
        url.hash = "";
        url.searchParams.set("share", ids.join(","));
        sharedUrl = url.href;
        history.replaceState(null, "", sharedUrl);
        renderTable("shared-list", items);
        const missing = ids.length - items.length;
        sharedStatus.textContent = `${items.length}件の共有リスト${missing ? `（${missing}件は削除・非公開などのため表示できません）` : ""}`;
        copyListButton.disabled = false;
        shareListButton.disabled = false;
        if (scroll) sharedSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      if (incomingIds.length) showSharedList(incomingIds);
      shareSelectedButton.addEventListener("click", () => {
        const ids = [...selectedFiles.values()].map((paper) => paper.id).filter(Boolean);
        if (ids.length) showSharedList(ids, true);
      });

      // build search index
      const allPapers = papers.slice();
      const searchInput = document.getElementById("pdf-search");
      const resultsBox = document.getElementById("search-results");
      function renderResults(matches) {
        if (!resultsBox) return;
        resultsBox.style.display = "block";
        resultsBox.innerHTML = "";
        if (!matches || matches.length === 0) {
          resultsBox.textContent = "一致するファイルはありません。";
          return;
        }
        for (const p of matches) {
          const div = document.createElement("div");
          div.className = "search-item";
          const tournament = p.tournament ? ` [${p.tournament}]` : "";
          const roleLabels = {
            question: "問題",
            answer: "答え",
            mix: "どちらも",
          };
          const kindLabels = { self_made: "自作", past_exam: "過去問" };
          const typeLabel = [kindLabels[p.fileKind], roleLabels[p.docType]]
            .filter(Boolean)
            .join("・");
          const type = typeLabel ? `・${typeLabel}` : "";
          div.textContent = `${p.title.replace(/\.pdf$/i, "")}${tournament} — ${p.category || ""}${type}`;
          div.addEventListener("click", () => {
            // open ancestor details of the target list
            const listId = listIdFor(p);
            const listDiv = document.getElementById(listId);
            if (listDiv) {
              // open all ancestor details
              let el = listDiv;
              while (el) {
                if (el.tagName && el.tagName.toLowerCase() === "details")
                  el.open = true;
                el = el.parentElement;
              }
              // find the row
              const selector = `tbody tr[data-path="${p.path}"]`;
              const row =
                listDiv.querySelector(selector) ||
                listDiv.querySelector(`tbody tr[data-path="${p.filename}"]`);
              if (row) {
                row.scrollIntoView({ behavior: "smooth", block: "center" });
                row.classList.remove("flash-red");
                // trigger reflow to restart animation
                void row.offsetWidth;
                row.classList.add("flash-red");
                setTimeout(() => row.classList.remove("flash-red"), 3500);
              }
            }
          });
          resultsBox.appendChild(div);
        }
      }

      if (searchInput) {
        searchInput.addEventListener("input", (e) => {
          const q = (e.target.value || "").trim().toLowerCase();
          if (!q) {
            if (resultsBox) {
              resultsBox.innerHTML = "";
              resultsBox.style.display = "none";
            }
            return;
          }
          const matches = allPapers
            .filter((p) => {
              return (
                (p.title && p.title.toLowerCase().includes(q)) ||
                (p.tournament && p.tournament.toLowerCase().includes(q)) ||
                (p.filename && p.filename.toLowerCase().includes(q)) ||
                (p.category && p.category.toLowerCase().includes(q)) ||
                (p.fileKind === "past_exam" && "過去問".includes(q)) ||
                (p.fileKind === "self_made" && "自作".includes(q)) ||
                (p.docType === "question" && "問題".includes(q)) ||
                (p.docType === "answer" && "答え".includes(q))
              );
            })
            .slice(0, 100);
          renderResults(matches);
        });
      }
    })
    .catch((err) => {
      if (incomingIds.length) sharedStatus.textContent = "共有リストを読み込めませんでした。再読み込みしてください。";
      [
        "shizekan-list",
        "kisho-list",
        "kyukyu-list",
        "kyotsu-list",
        "inhai-list",
        "kensotai-list",
        "chutaiyose-list",
      ].forEach((id) => {
        const c = document.getElementById(id);
        if (c) c.innerHTML = "<p>読み込みに失敗しました。</p>";
      });
      console.error(err);
    });
})();
