export interface GitHubUser {
    id: number;
    login: string;
    name: string | null;
    avatarUrl: string;
    htmlUrl: string;
    bio: string | null;
    company: string | null;
    location: string | null;
    publicRepos: number;
    followers: number;
    following: number;
    createdAt: string;
}