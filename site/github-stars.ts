/** The repo's star count, fetched when the site builds. Null when unavailable or still small. */
export async function githubStars(): Promise<string | null> {
  try {
    const res = await fetch("https://api.github.com/repos/SoftwareSavants/tendkit", { headers: { accept: "application/vnd.github+json" } });
    if (!res.ok) return null;
    const { stargazers_count: count } = (await res.json()) as { stargazers_count?: number };
    if (!count || count < 10) return null;
    return count >= 1000 ? `${(count / 1000).toFixed(count >= 10_000 ? 0 : 1)}k` : String(count);
  } catch {
    return null;
  }
}
