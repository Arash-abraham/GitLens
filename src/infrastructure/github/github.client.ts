import type { GitHubUser } from "../../modules/users/user.types";

interface GitHubApiUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
}

export async function fetchGitHubUser(
  username: string
): Promise<GitHubUser> {
  const response = await fetch(
    `https://api.github.com/users/${encodeURIComponent(username)}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "GitLens",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `GitHub API returned ${response.status}`
    );
  }

  const data = (await response.json()) as GitHubApiUser;

  return {
    id: data.id,
    login: data.login,
    name: data.name,
    avatarUrl: data.avatar_url,
    htmlUrl: data.html_url,
    bio: data.bio,
    company: data.company,
    location: data.location,
    publicRepos: data.public_repos,
    followers: data.followers,
    following: data.following,
    createdAt: data.created_at,
  };
}