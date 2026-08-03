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
              注意自然観察: "chuishizekan-list",
              問題自然観察: "mondaishizekan-list",
              自然観察: "shizekan-list",
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
              items.sort((a, b) => (a.title || '').localeCompare((b.title || ''), 'ja', { numeric: true }));
              const table = document.createElement("table");
              const thead = document.createElement("thead");
              thead.innerHTML =
                "<tr><th>タイトル</th><th>ダウンロード</th></tr>";
              table.appendChild(thead);
              const tbody = document.createElement("tbody");
              for (const p of items) {
                const tr = document.createElement("tr");
                const tdTitle = document.createElement("td");
                let t = p.title.replace(/\.(pdf)$/i, "");
                if (p.mtime);
                tdTitle.textContent = t;
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

            renderTable("shizekan-list", buckets["shizekan-list"]);
            renderTable("chuishizekan-list", buckets["chuishizekan-list"]);
            renderTable("mondaishizekan-list", buckets["mondaishizekan-list"]);
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