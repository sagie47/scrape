const form = document.getElementById("upload-form");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");

let pollTimer = null;

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  resultsEl.innerHTML = "";
  statusEl.textContent = "Uploading...";

  const formData = new FormData(form);
  form.querySelector("button").disabled = true;

  try {
    const response = await fetch("/upload", {
      method: "POST",
      body: formData
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Upload failed.");
    }
    statusEl.textContent = `Job started: ${data.jobId}`;
    startPolling(data.jobId);
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
  } finally {
    form.querySelector("button").disabled = false;
  }
});

function startPolling(jobId) {
  if (pollTimer) {
    clearInterval(pollTimer);
  }
  pollTimer = setInterval(async () => {
    try {
      const response = await fetch(`/status/${jobId}`);
      const status = await response.json();
      if (!response.ok) {
        throw new Error(status.error || "Status failed.");
      }
      statusEl.textContent = `${status.status} (${status.processed}/${status.total})`;
      renderResults(status.results || []);

      if (status.status === "done" || status.status === "error") {
        clearInterval(pollTimer);
      }
    } catch (err) {
      statusEl.textContent = `Error: ${err.message}`;
      clearInterval(pollTimer);
    }
  }, 2000);
}

function renderResults(results) {
  resultsEl.innerHTML = "";
  results.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card";

    const title = document.createElement("div");
    title.textContent = `Row ${item.row} - ${item.url}`;

    const imageLink = document.createElement("a");
    imageLink.href = item.screenshot;
    imageLink.target = "_blank";
    imageLink.rel = "noopener noreferrer";

    const image = document.createElement("img");
    image.src = item.screenshot;
    image.alt = `Row ${item.row} screenshot`;
    image.loading = "lazy";
    imageLink.appendChild(image);

    const report = buildReport(item.report, item.error);

    card.appendChild(title);
    card.appendChild(imageLink);
    card.appendChild(report);
    resultsEl.appendChild(card);
  });
}

function buildReport(report, error) {
  const details = document.createElement("details");
  details.className = "report";
  details.open = false;

  const summary = document.createElement("summary");
  summary.textContent = "Report";
  details.appendChild(summary);

  const body = document.createElement("div");
  body.className = "report-body";
  details.appendChild(body);

  if (error) {
    body.textContent = `Error: ${error}`;
    return details;
  }
  if (!report) {
    body.textContent = "No report yet.";
    return details;
  }
  if (report.raw) {
    const pre = document.createElement("pre");
    pre.textContent = report.raw;
    body.appendChild(pre);
    return details;
  }

  if (report.summary) {
    const summaryEl = document.createElement("p");
    summaryEl.innerHTML = `<strong>Summary:</strong> ${report.summary}`;
    body.appendChild(summaryEl);
  }

  if (Array.isArray(report.issues) && report.issues.length) {
    const issuesTitle = document.createElement("div");
    issuesTitle.className = "report-title";
    issuesTitle.textContent = "Issues";
    const list = document.createElement("ul");
    report.issues.forEach((issue) => {
      const li = document.createElement("li");
      li.textContent = issue;
      list.appendChild(li);
    });
    body.appendChild(issuesTitle);
    body.appendChild(list);
  }

  if (Array.isArray(report.quick_wins) && report.quick_wins.length) {
    const winsTitle = document.createElement("div");
    winsTitle.className = "report-title";
    winsTitle.textContent = "Quick wins";
    const list = document.createElement("ul");
    report.quick_wins.forEach((win) => {
      const li = document.createElement("li");
      li.textContent = win;
      list.appendChild(li);
    });
    body.appendChild(winsTitle);
    body.appendChild(list);
  }

  if (report.confidence) {
    const confidence = document.createElement("div");
    confidence.className = "report-confidence";
    confidence.textContent = `Confidence: ${report.confidence}`;
    body.appendChild(confidence);
  }

  return details;
}
