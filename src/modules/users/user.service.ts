import { fetchGitHubUser } from "../../infrastructure/github/github.client";
import { findUser, saveUser } from "./user.repository";
import type { GitHubUser } from "./user.types";

export async function importUser(
  username: string
): Promise<GitHubUser> {
  const user = await fetchGitHubUser(username);

  await saveUser(user);

  return user;
}

export async function getUser(
  username: string
): Promise<GitHubUser | null> {
  return findUser(username);
}