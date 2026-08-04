(function(){
  fetch('release.json')
    .then(r=>r.json())
    .then(data=>{
      const recent = document.getElementById('recent-table');
      const upcoming = document.getElementById('upcoming-table');
      const authors = document.getElementById('authors-table');
      const fileAuthors = document.getElementById('file-authors-table');

      if (recent && Array.isArray(data.recent)){
        const tbody = recent.querySelector('tbody');
        tbody.innerHTML = '';
        data.recent.forEach(row => {
          const tr = document.createElement('tr');
          const tdDate = document.createElement('td'); tdDate.textContent = row.date || '';
          const tdNote = document.createElement('td'); tdNote.textContent = row.note || '';
          tr.appendChild(tdDate); tr.appendChild(tdNote);
          tbody.appendChild(tr);
        });
      }

      if (upcoming && Array.isArray(data.upcoming)){
        const tbody = upcoming.querySelector('tbody');
        tbody.innerHTML = '';
        data.upcoming.forEach(row => {
          const tr = document.createElement('tr');
          const td = document.createElement('td'); td.textContent = row.note || '';
          tr.appendChild(td);
          tbody.appendChild(tr);
        });
      }

      if (authors && Array.isArray(data.authors)){
        const tbody = authors.querySelector('tbody');
        tbody.innerHTML = '';
        data.authors.forEach(a => {
          const tr = document.createElement('tr');
          const tdName = document.createElement('td'); tdName.textContent = a.name || '';
          const tdRole = document.createElement('td'); tdRole.textContent = a.role || '';
          tr.appendChild(tdName); tr.appendChild(tdRole);
          tbody.appendChild(tr);
        });
      }

      if (fileAuthors && Array.isArray(data.fileAuthors)){
        const tbody = fileAuthors.querySelector('tbody');
        tbody.innerHTML = '';
        if (data.fileAuthors.length === 0){
          const tr = document.createElement('tr');
          const td = document.createElement('td');
          td.colSpan = 3;
          td.textContent = 'まだ登録されていません。';
          tr.appendChild(td);
          tbody.appendChild(tr);
        } else {
          data.fileAuthors.forEach(row => {
            const tr = document.createElement('tr');
            const tdFile = document.createElement('td'); tdFile.textContent = row.file || '';
            const tdCreator = document.createElement('td'); tdCreator.textContent = row.creator || '';
            const tdNote = document.createElement('td'); tdNote.textContent = row.note || '';
            tr.appendChild(tdFile); tr.appendChild(tdCreator); tr.appendChild(tdNote);
            tbody.appendChild(tr);
          });
        }
      }

      const publicFileCount = document.getElementById('public-file-count');
      const filenameList = document.getElementById('filename-list');
      if (publicFileCount || filenameList){
        fetch('pdf/data.json')
          .then(r => r.json())
          .then(pdfData => {
            const papers = Array.isArray(pdfData.papers) ? pdfData.papers : [];
            if (publicFileCount){
              publicFileCount.innerHTML = `公開中ファイル数：${papers.length}件 詳しくは <a href="#filename-list" style="width:fit-content">こちら</a>`;
            }
            const labels = papers
              .map(p => {
                const title = p && p.title ? String(p.title) : '';
                const ext = p && p.ext ? String(p.ext).replace(/^\./, '') : '';
                if (!title) return '';
                return ext ? `${title}.${ext}` : title;
              })
              .filter(Boolean)
              .sort((a, b) => a.localeCompare(b, 'ja', { numeric: true }));
            if (filenameList){
              filenameList.textContent = labels.length ? labels.join(', ') : '該当ファイルがありません。';
            }
          })
          .catch(err => {
            if (publicFileCount){
              publicFileCount.textContent = '読み込みに失敗しました。';
            }
            if (filenameList){
              filenameList.textContent = '読み込みに失敗しました。';
            }
            console.error('failed load pdf/data.json', err);
          });
      }
    })
    .catch(err=>{
      console.error('failed load release.json', err);
    });
})();
