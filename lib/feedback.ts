// A change request from the family becomes a pull request: a branch with one Markdown file under
// feedback/, opened against main, so Rob reviews and merges (or closes) it like any other change.

export const FEEDBACK_REPO = "rjohnson426/family_project";
export const FEEDBACK_MAX = { title: 120, description: 2000 };

export function slug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "request";
}

/** Branch, file path, and file text for one request. `now` is an ISO timestamp. */
export function feedbackFile(title: string, description: string, page: string, now: string) {
  const stamp = now.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z").replace("T", "-").toLowerCase();
  const name = `${stamp}-${slug(title)}`;
  return {
    branch: `feedback/${name}`,
    path: `feedback/${name}.md`,
    content: `# ${title.replace(/\s+/g, " ")}\n\n${description}\n\n---\nPage: ${page || "unknown"}\nSubmitted: ${now}\n`,
  };
}

/** Opens the pull request. Throws with the failing step when GitHub refuses. */
export async function openFeedbackPr(
  token: string,
  repo: string,
  req: { title: string; description: string; page: string },
  now = new Date().toISOString(),
): Promise<string> {
  const gh = async (path: string, init?: RequestInit) => {
    const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "family-photos",
      },
    });
    if (!res.ok) throw new Error(`GitHub ${init?.method ?? "GET"} ${path} failed (${res.status}): ${await res.text()}`);
    return res.json() as Promise<Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  const file = feedbackFile(req.title, req.description, req.page, now);
  const main = await gh("/git/ref/heads/main");
  await gh("/git/refs", { method: "POST", body: JSON.stringify({ ref: `refs/heads/${file.branch}`, sha: main.object.sha }) });
  await gh(`/contents/${file.path}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `Feedback: ${req.title}`,
      content: Buffer.from(file.content).toString("base64"),
      branch: file.branch,
    }),
  });
  const pr = await gh("/pulls", {
    method: "POST",
    body: JSON.stringify({
      title: `Feedback: ${req.title}`,
      head: file.branch,
      base: "main",
      body: `${req.description}\n\n---\nPage: ${req.page || "unknown"}\n\nSubmitted from the Submit Feedback form. The request is saved in \`${file.path}\`; make the change in this branch, then merge. Close the PR to decline.`,
    }),
  });
  return pr.html_url as string;
}
