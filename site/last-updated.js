(function () {
  const target = document.getElementById("last-updated");
  if (!target) return;

  const commitsApi = "https://api.github.com/repos/YamaDai-phy/wangel_mondai-website/commits?per_page=1";

  fetch(commitsApi, {
    headers: { Accept: "application/vnd.github+json" },
    cache: "no-store",
  })
    .then((response) => {
      if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
      return response.json();
    })
    .then((commits) => {
      const timestamp = commits?.[0]?.commit?.committer?.date;
      const date = timestamp ? new Date(timestamp) : null;
      if (!date || Number.isNaN(date.getTime())) throw new Error("Invalid commit date");
      const formatted = new Intl.DateTimeFormat("ja-JP", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Tokyo",
      }).format(date);
      target.textContent = `最終更新日時：${formatted}`;
    })
    .catch((error) => {
      // The timestamp is supplementary information; keep the landing page quiet
      // if GitHub is temporarily unavailable or API rate limited.
      console.warn("Failed to load the latest commit time", error);
      target.hidden = true;
    });
})();
