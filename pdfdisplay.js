(function () {
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

  function setCheckedLink(a, p) {
    const key = p.path || p.filename || p.title;
    if (checkedLinks.has(key)) {
      a.classList.add("is-checked");
      a.textContent = "リンク ✓";
    }
    a.addEventListener("click", () => {
      if (checkedLinks.has(key)) return;
      checkedLinks.add(key);
      saveChecked(checkedLinks);
      a.classList.add("is-checked");
      a.textContent = "リンク ✓";
    });
  }

  function mkLink(p) {
    const a = document.createElement("a");
    a.href = p.path;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.download = p.filename;
    a.textContent = p.title;
    return a;
  }
  fetch("pdf/data.json")
    .then((r) => r.json())
    .then((data) => {
      const mapping = {
        "注意自然観察": "shizekan-list",
        "問題自然観察": "shizekan-list",
        "自然観察": "shizekan-list",
        気象: "kisho-list",
        救急: "kyukyu-list",
        共通: "kyotsu-list",
        インターハイ: "inhai-list",
        県総体: "kensotai-list",
      };
      const buckets = {};
      Object.values(mapping).forEach((id) => (buckets[id] = []));
      buckets["other-list"] = [];

      const papers = data.papers || [];
      for (const p of papers) {
        const id =
          mapping[p.category] ||
          (p.path && p.path.indexOf("pdf/kadai/shizekan/") !== -1
            ? "shizekan-list"
            : "other-list");
        buckets[id].push(p);
      }

      function renderTable(containerId, items) {
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
          const priority = ["注意自然観察", "問題自然観察"];
          items.sort((a, b) => {
            const ia = priority.indexOf(a.category);
            const ib = priority.indexOf(b.category);
            const aPri = ia !== -1;
            const bPri = ib !== -1;
            if (aPri && bPri) {
              if (ia !== ib) return ia - ib;
              return (a.title || "").localeCompare(b.title || "", "ja", { numeric: true });
            }
            if (aPri) return -1;
            if (bPri) return 1;
            return (a.title || "").localeCompare(b.title || "", "ja", { numeric: true });
          });
        } else {
          items.sort((a, b) =>
            (a.title || "").localeCompare(b.title || "", "ja", { numeric: true }),
          );
        }
        const table = document.createElement("table");
        const thead = document.createElement("thead");
        thead.innerHTML = "<tr><th>タイトル</th><th>ダウンロード</th></tr>";
        table.appendChild(thead);
        const tbody = document.createElement("tbody");
        for (const p of items) {
          const tr = document.createElement("tr");
          tr.dataset.path = p.path || p.filename || p.title || "";
          tr.dataset.category = p.category || "";
          const tdTitle = document.createElement("td");
          let t = p.title.replace(/\.(pdf)$/i, "");
          if (p.mtime);
          tdTitle.textContent = p.uploader ? `${t}（${p.uploader}）` : t;
          const tdLink = document.createElement("td");
          const a = mkLink(p);
          a.textContent = "リンク";
          a.classList.add("download-link");
          setCheckedLink(a, p);
          tdLink.appendChild(a);
          tr.appendChild(tdTitle);
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
      renderTable("kyotsu-list", buckets["kyotsu-list"]);
      renderTable("inhai-list", buckets["inhai-list"]);
      renderTable("kensotai-list", buckets["kensotai-list"]);
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
        document.querySelector(".details-section").appendChild(details);
        other = div;
      }
      renderTable("other-list", buckets["other-list"]);

      // build search index
      const allPapers = papers.slice();
      const searchInput = document.getElementById('pdf-search');
      const resultsBox = document.getElementById('search-results');
      function renderResults(matches) {
        if (!resultsBox) return;
        resultsBox.style.display = 'block';
        resultsBox.innerHTML = '';
        if (!matches || matches.length === 0) {
          resultsBox.textContent = '一致するファイルはありません。';
          return;
        }
        for (const p of matches) {
          const div = document.createElement('div');
          div.className = 'search-item';
          const uploader = p.uploader ? ` — ${p.uploader}` : '';
          div.textContent = `${p.title.replace(/\.pdf$/i,'')} — ${p.category || ''}${uploader}`;
          div.addEventListener('click', () => {
            // open ancestor details of the target list
            const mapping = {
              "注意自然観察": "shizekan-list",
              "問題自然観察": "shizekan-list",
              "自然観察": "shizekan-list",
              気象: "kisho-list",
              救急: "kyukyu-list",
              共通: "kyotsu-list",
              インターハイ: "inhai-list",
              県総体: "kensotai-list",
            };
            const listId = mapping[p.category] || (p.path && p.path.indexOf('pdf/kadai/shizekan/') !== -1 ? 'shizekan-list' : 'other-list');
            const listDiv = document.getElementById(listId);
            if (listDiv) {
              // open all ancestor details
              let el = listDiv;
              while (el) {
                if (el.tagName && el.tagName.toLowerCase() === 'details') el.open = true;
                el = el.parentElement;
              }
              // find the row
              const selector = `tbody tr[data-path="${p.path}"]`;
              const row = listDiv.querySelector(selector) || listDiv.querySelector(`tbody tr[data-path="${p.filename}"]`);
              if (row) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                row.classList.remove('flash-red');
                // trigger reflow to restart animation
                void row.offsetWidth;
                row.classList.add('flash-red');
                setTimeout(() => row.classList.remove('flash-red'), 3500);
              }
            }
          });
          resultsBox.appendChild(div);
        }
      }

      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          const q = (e.target.value || '').trim().toLowerCase();
          if (!q) { if (resultsBox) { resultsBox.innerHTML = ''; resultsBox.style.display = 'none'; } return; }
          const matches = allPapers.filter(p => {
            return (p.title && p.title.toLowerCase().includes(q)) || (p.filename && p.filename.toLowerCase().includes(q)) || (p.category && p.category.toLowerCase().includes(q));
          }).slice(0, 100);
          renderResults(matches);
        });
      }
    })
    .catch((err) => {
      [
        "shizekan-list",
        "chuishizekan-list",
        "mondaishizekan-list",
        "kisho-list",
        "kyukyu-list",
        "kyotsu-list",
        "inhai-list",
        "kensotai-list",
      ].forEach((id) => {
        const c = document.getElementById(id);
        if (c) c.innerHTML = "<p>読み込みに失敗しました。</p>";
      });
      console.error(err);
    });
})();
