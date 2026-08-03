(function(){
  fetch('release.json')
    .then(r=>r.json())
    .then(data=>{
      const recent = document.getElementById('recent-table');
      const upcoming = document.getElementById('upcoming-table');
      const authors = document.getElementById('authors-table');

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
    })
    .catch(err=>{
      console.error('failed load release.json', err);
    });
})();
