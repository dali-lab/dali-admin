const BASE_URL = import.meta.env.VITE_DALI_DB_URL ?? "http://localhost:3001";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HiredRole {
  id?: string;
  role: string;
  level?: string | null;
}

export interface TermRef {
  name: string;
}

// Raw member shape (GET /members without format=team)
export interface Member {
  id: string;
  daliEmail: string | null;
  fullName: string | null;
  classYear: string | null;
  major: string | null;
  minor: string | null;
  linkedinUrl: string | null;
  imageUrl: string | null;
  isActive: boolean;
  isAlum: boolean;
  hiredRoles: HiredRole[];
  termsInDali: TermRef[];
  joinedTerm: TermRef | null;
  memberTermRoles?: Array<{ term: { name: string }; project: { id?: string; name: string } }>;
  team?: { project: { name: string }; term: { name: string } } | null;
  roles?: string[];
  currentRole?: string | null;
  notionPageId?: string | null;
}

// Team-format member (GET /members?format=team)
export interface TeamMember {
  id: string;
  name: string | null;
  role: string;
  roles: string[];
  hiredRoles: string[];
  coreRoleNames: string[];
  currentRole: string;
  year: string;
  majorMinor: string;
  termsInDali: string[];
  profileImage: string;
  linkedinUrl: string;
  isAlum: boolean;
  isActive: boolean;
  notionPageId: string | null;
}

export interface MemberPatch {
  isActive: boolean;
  isAlum: boolean;
  classYear: string;
  major: string;
  minor: string;
  linkedinUrl: string;
  imageUrl: string;
  daliEmail: string;
}

export interface ProjectRepo {
  id: string;
  type: string;
  url: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  tags: string[];
  sectors: string[];
  product: string[];
  techStack: string[];
  term: string;
  teamMembers: string[];
  teamsByTerm?: Array<{ term: string; members: string[] }>;
  coverImage: string;
  projectUrls: Array<{ label: string; url: string }>;
  isPublic: boolean;
  notionPageId: string | null;
  publicNotionPageId: string | null;
  slackChannelId: string | null;
  githubTeamSlug: string | null;
  partnerNames?: string[];
  repos?: ProjectRepo[];
}

export interface ProjectPatch {
  name?: string;
  isPublic: boolean;
  status: string;
  description: string;
  coverImage?: string | null;
  publicNotionPageId?: string | null;
  slackChannelId?: string | null;
  githubTeamSlug?: string | null;
  projectUrls?: Array<{ label: string; url: string }>;
  sectors?: string[];
  product?: string[];
  techStack?: string[];
  partnerNames?: string[];
}

export interface Bid {
  id: string;
  memberId: string;
  termId: string;
  projectPref1Id: string | null;
  projectPref2Id: string | null;
  projectPref3Id: string | null;
  assignedProjectId: string | null;
  assignedRole: string | null;
  rolePref1: string | null;
  rolePref2: string | null;
  rolePref3: string | null;
  preference: string | null;
  hoursPerWeek: string | null;
  isMentorThisTerm: boolean;
  mentorOptOut: boolean | null;
  mentorId: string | null;
  mentor: { id: string; fullName: string | null; daliEmail: string | null; imageUrl: string | null } | null;
  externalMentor: string | null;
  interest: string | null;
  roleQuestion1: string | null;
  roleQuestion2: string | null;
  roleQuestion3: string | null;
  preferWith: string | null;
  preferNotWith: string | null;
  readyToMigrate: boolean;
  addedToAssignments: boolean;
  submittedAt: string | null;
  member: { id: string; fullName: string | null; daliEmail: string | null; imageUrl: string | null; hiredRoles?: HiredRole[] } | null;
  term: { name: string } | null;
  projectPref1: { id: string; name: string } | null;
  projectPref2: { id: string; name: string } | null;
  projectPref3: { id: string; name: string } | null;
  assignedProject: { id: string; name: string } | null;
}

export interface BidPatch {
  assignedProjectId: string | null;
  assignedRole: string | null;
  mentorOptOut?: boolean | null;
  mentorId?: string | null;
  externalMentor?: string | null;
}

export interface MemberCreate {
  dartmouthEmail: string;
  daliEmail: string;
  joinedTermName: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  classYear?: string;
  major?: string;
  minor?: string;
  linkedinUrl?: string;
  imageUrl?: string;
}

export interface BidCreate {
  memberId: string;
  termId: string;
  rolePref1?: string;
  hoursPerWeek?: string;
}

export interface Term {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      q.set(k, String(v));
    }
  }
  const str = q.toString();
  return str ? `?${str}` : "";
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Members ──────────────────────────────────────────────────────────────────

export async function getMembers(params?: {
  term?: string;
  role?: string;
  active?: boolean;
  page?: number;
  limit?: number;
}): Promise<Member[]> {
  const query = buildQuery({
    term: params?.term,
    role: params?.role,
    active: params?.active,
    page: params?.page,
    limit: params?.limit ?? 1000,
  });
  const data = await apiFetch<Member[] | { members: Member[] }>(`/members${query}`);
  // Raw endpoint returns array directly
  return Array.isArray(data) ? data : data.members;
}

export async function getMember(id: string): Promise<Member> {
  return apiFetch<Member>(`/members/${id}`);
}

export async function createMember(data: MemberCreate): Promise<Member> {
  return apiFetch<Member>("/members", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function patchMember(id: string, data: Partial<MemberPatch>): Promise<Member> {
  return apiFetch<Member>(`/members/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function addHiredRole(memberId: string, role: string, level: string): Promise<HiredRole> {
  return apiFetch<HiredRole>(`/members/${memberId}/roles`, {
    method: "POST",
    body: JSON.stringify({ role, level }),
  });
}

export async function updateHiredRole(memberId: string, roleId: string, level: string): Promise<HiredRole> {
  return apiFetch<HiredRole>(`/members/${memberId}/roles/${roleId}`, {
    method: "PATCH",
    body: JSON.stringify({ level }),
  });
}

export async function deleteHiredRole(memberId: string, roleId: string): Promise<void> {
  await apiFetch<void>(`/members/${memberId}/roles/${roleId}`, { method: "DELETE" });
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function createProject(data: { name: string; status?: string; term?: string }): Promise<Project> {
  return apiFetch<Project>("/projects", { method: "POST", body: JSON.stringify(data) });
}

export async function getProjects(params?: {
  term?: string;
  status?: string;
}): Promise<Project[]> {
  const query = buildQuery({ term: params?.term, status: params?.status });
  const data = await apiFetch<{ projects: Project[] }>(`/projects${query}`);
  return data.projects;
}

export async function getProject(id: string): Promise<Project> {
  return apiFetch<Project>(`/projects/${id}`);
}

export async function patchProject(id: string, data: Partial<ProjectPatch>): Promise<Project> {
  return apiFetch<Project>(`/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteProject(id: string): Promise<void> {
  await apiFetch<void>(`/projects/${id}`, { method: "DELETE" });
}

export async function createRepo(projectId: string, data: { type: string; url: string }): Promise<ProjectRepo> {
  return apiFetch<ProjectRepo>(`/projects/${projectId}/repos`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteRepo(projectId: string, repoId: string): Promise<void> {
  await apiFetch<void>(`/projects/${projectId}/repos/${repoId}`, { method: "DELETE" });
}

// ─── Bids ─────────────────────────────────────────────────────────────────────

export async function getBids(params?: {
  term?: string;
  memberId?: string;
}): Promise<Bid[]> {
  const query = buildQuery({ term: params?.term, memberId: params?.memberId });
  const data = await apiFetch<Bid[] | { bids: Bid[] }>(`/bids${query}`);
  return Array.isArray(data) ? data : data.bids ?? [];
}

export async function createBid(data: BidCreate): Promise<Bid> {
  return apiFetch<Bid>("/bids", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function patchBid(id: string, data: Partial<BidPatch>): Promise<Bid> {
  return apiFetch<Bid>(`/bids/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteBid(id: string): Promise<void> {
  await apiFetch<void>(`/bids/${id}`, { method: "DELETE" });
}

export async function checkTeam(projectId: string, term: string): Promise<{ exists: boolean; memberCount: number; members: string[] }> {
  return apiFetch(`/bids/check-team?projectId=${encodeURIComponent(projectId)}&term=${encodeURIComponent(term)}`);
}

export async function publishBids(projectId: string, term: string): Promise<{ teamId: string; memberCount: number }> {
  return apiFetch("/bids/publish", {
    method: "POST",
    body: JSON.stringify({ projectId, term }),
  });
}

export async function notifySlack(projectId: string, term: string, channelName?: string): Promise<{ sent: number; total: number; channelId?: string; channelName?: string; results: { member: string; status: string; error?: string }[]; firstFailure?: { member: string; status: string; error?: string } }> {
  return apiFetch("/bids/notify-slack", {
    method: "POST",
    body: JSON.stringify({ projectId, term, channelName }),
  });
}

export async function updateGithub(projectId: string, term: string): Promise<{ updated: number; total: number; teamSlug?: string; results?: { member: string; status: string; error?: string }[] }> {
  return apiFetch("/bids/update-github", {
    method: "POST",
    body: JSON.stringify({ projectId, term }),
  });
}

// ─── Terms ────────────────────────────────────────────────────────────────────

export async function getTerms(): Promise<Term[]> {
  return apiFetch<Term[]>("/terms");
}

export async function getCurrentTerm(): Promise<Term | null> {
  try {
    return await apiFetch<Term>("/terms/current");
  } catch {
    return null;
  }
}

export async function createTerm(data: { name: string; startDate: string; endDate: string }): Promise<Term> {
  return apiFetch<Term>("/terms", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ─── Applications ─────────────────────────────────────────────────────────────

export interface ApplicationUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  dartmouthEmail: string;
}

export interface Application {
  id: string;
  userId: string;
  user: ApplicationUser;
  termId: string;
  term: { id: string; name: string };
  status: "PENDING" | "UNDER_REVIEW" | "ACCEPTED" | "REJECTED";
  rolesApplied: string[];
  portfolioUrl: string | null;
  resumeUrl: string | null;
  statement: string | null;
  reviewerNotes: string | null;
  submittedAt: string;
  updatedAt: string;
}

export async function getApplications(params?: {
  term?: string;
  status?: string;
}): Promise<Application[]> {
  const query = buildQuery({ term: params?.term, status: params?.status });
  return apiFetch<Application[]>(`/applications${query}`);
}

export async function patchApplicationStatus(
  id: string,
  data: { status: string; reviewerNotes?: string }
): Promise<Application> {
  return apiFetch<Application>(`/applications/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ─── Access Groups ─────────────────────────────────────────────────────────────

export interface AccessGroupMemberInfo {
  id: string;
  daliEmail: string;
  fullName: string | null;
  imageUrl: string | null;
  hiredRoles: { role: string; level: string }[];
}

export interface AccessGroupMember {
  groupId: string;
  memberId: string;
  addedAt: string;
  member: AccessGroupMemberInfo;
}

export interface AccessGroup {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
  members: AccessGroupMember[];
}

export async function getAccessGroups(): Promise<AccessGroup[]> {
  return apiFetch<AccessGroup[]>("/access-groups");
}

export async function createAccessGroup(data: { name: string; description?: string; permissions?: string[] }): Promise<AccessGroup> {
  return apiFetch<AccessGroup>("/access-groups", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function patchAccessGroup(id: string, data: { name?: string; description?: string; permissions?: string[] }): Promise<AccessGroup> {
  return apiFetch<AccessGroup>(`/access-groups/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteAccessGroup(id: string): Promise<void> {
  await apiFetch<void>(`/access-groups/${id}`, { method: "DELETE" });
}

export async function addAccessGroupMember(groupId: string, memberId: string): Promise<AccessGroup> {
  return apiFetch<AccessGroup>(`/access-groups/${groupId}/members`, {
    method: "POST",
    body: JSON.stringify({ memberId }),
  });
}

export async function removeAccessGroupMember(groupId: string, memberId: string): Promise<void> {
  await apiFetch<void>(`/access-groups/${groupId}/members/${memberId}`, { method: "DELETE" });
}
