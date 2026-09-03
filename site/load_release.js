(function () {
  const papersApi = "https://pdf-upload-api.yamadai.workers.dev/papers";

  Promise.all([
    fetch("release.json").then((response) => response.json()),
    fetch(papersApi, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { papers: [] })
      .catch(() => ({ papers: [] })),
  ])
    .then(([data, uploadedData]) => {
      const uploadedPapers = Array.isArray(uploadedData.papers)
        ? uploadedData.papers
        : [];
      const recent = document.getElementById("recent-table");
      const upcoming = document.getElementById("upcoming-table");
      const authors = document.getElementById("authors-table");
      const fileAuthors = document.getElementById("file-authors-table");

      if (recent && Array.isArray(data.recent)) {
        const tbody = recent.querySelector("tbody");
        tbody.innerHTML = "";
        data.recent.forEach((row) => {
          const tr = document.createElement("tr");
          const tdDate = document.createElement("td");
          tdDate.textContent = row.date || "";
          const tdNote = document.createElement("td");
          tdNote.textContent = row.note || "";
          tr.appendChild(tdDate);
          tr.appendChild(tdNote);
          tbody.appendChild(tr);
        });
      }

      if (upcoming && Array.isArray(data.upcoming)) {
        const tbody = upcoming.querySelector("tbody");
        tbody.innerHTML = "";
        data.upcoming.forEach((row) => {
          const tr = document.createElement("tr");
          const td = document.createElement("td");
          td.textContent = row.note || "";
          tr.appendChild(td);
          tbody.appendChild(tr);
        });
      }

      if (authors && Array.isArray(data.authors)) {
        const tbody = authors.querySelector("tbody");
        tbody.innerHTML = "";
        data.authors.forEach((a) => {
          const tr = document.createElement("tr");
          const tdName = document.createElement("td");
          tdName.textContent = a.name || "";
          const tdRole = document.createElement("td");
          tdRole.textContent = a.role || "";
          tr.appendChild(tdName);
          tr.appendChild(tdRole);
          tbody.appendChild(tr);
        });
      }

      if (fileAuthors && Array.isArray(data.fileAuthors)) {
        const tbody = fileAuthors.querySelector("tbody");
        tbody.innerHTML = "";
        const uploadedByAuthor = new Map();
        uploadedPapers.forEach((paper) => {
          const creator = paper && paper.uploader ? String(paper.uploader) : "";
          const file = paper && (paper.title || paper.filename)
            ? String(paper.title || paper.filename).replace(/\.pdf$/i, "")
            : "";
          if (!creator || !file) return;
          if (!uploadedByAuthor.has(creator)) uploadedByAuthor.set(creator, new Set());
          uploadedByAuthor.get(creator).add(file);
        });
        const uploadedFileAuthors = [...uploadedByAuthor].map(([creator, files]) => ({
          creator,
          file: [...files].sort((a, b) => a.localeCompare(b, "ja", { numeric: true })).join("、"),
        }));
        const fileAuthorRows = [...data.fileAuthors, ...uploadedFileAuthors];

        if (fileAuthorRows.length === 0) {
          const tr = document.createElement("tr");
          const td = document.createElement("td");
          td.colSpan = 2;
          td.textContent = "まだ登録されていません。";
          tr.appendChild(td);
          tbody.appendChild(tr);
        } else {
          fileAuthorRows.forEach((row) => {
            const tr = document.createElement("tr");
            const tdCreator = document.createElement("td");
            tdCreator.textContent = row.creator || "";
            const tdFile = document.createElement("td");
            tdFile.textContent = row.file || "";
            tr.appendChild(tdCreator);
            tr.appendChild(tdFile);
            tbody.appendChild(tr);
          });
        }
      }

      const publicFileCount = document.getElementById("public-file-count");
      const filenameList = document.getElementById("filename-list");
      if (publicFileCount || filenameList) {
        fetch("pdf/data.json")
          .then((r) => r.json())
          .then((pdfData) => {
            const localPapers = Array.isArray(pdfData.papers) ? pdfData.papers : [];
            const papers = [...localPapers, ...uploadedPapers];
            if (publicFileCount) {
              publicFileCount.innerHTML = `公開中ファイル数：${papers.length}件 詳しくは <a href="#filename-list" style="width:fit-content">こちら</a>`;
            }
            const labels = papers
              .map((p) => {
                const title = p && p.title ? String(p.title) : "";
                const ext = p && p.ext ? String(p.ext).replace(/^\./, "") : "";
                if (!title) return "";
                return ext ? `${title}.${ext}` : title;
              })
              .filter(Boolean)
              .sort((a, b) => a.localeCompare(b, "ja", { numeric: true }));
            if (filenameList) {
              filenameList.textContent = labels.length
                ? labels.join(", ")
                : "該当ファイルがありません。";
            }
          })
          .catch((err) => {
            if (publicFileCount) {
              publicFileCount.textContent = "読み込みに失敗しました。";
            }
            if (filenameList) {
              filenameList.textContent = "読み込みに失敗しました。";
            }
            console.error("failed load pdf/data.json", err);
          });
      }
    })
    .catch((err) => {
      console.error("failed load release.json", err);
    });
})();
