import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { GitHubUser } from "./user.types";

interface UserStorage {
  users: GitHubUser[];
}

const DATA_FILE = resolve("data/users.json");

export async function saveUser(user: GitHubUser): Promise<void> {
  const content = await readFile(DATA_FILE, "utf-8");
  const storage = JSON.parse(content) as UserStorage;

  const existingIndex = storage.users.findIndex(
    (item) => item.login === user.login
  );

  if (existingIndex >= 0) {
    storage.users[existingIndex] = user;
  } else {
    storage.users.push(user);
  }

  await writeFile(
    DATA_FILE,
    JSON.stringify(storage, null, 2),
    "utf-8"
  );
}

export async function findUser(
  username: string
): Promise<GitHubUser | null> {
  const content = await readFile(DATA_FILE, "utf-8");
  const storage = JSON.parse(content) as UserStorage;

  return (
    storage.users.find(
      (user) =>
        user.login.toLowerCase() === username.toLowerCase()
    ) ?? null
  );
}