import { z } from 'zod';

const IsoDate = z.coerce.date();

export const GitHubIssueSchema = z.object({
  id: z.coerce.number().int().positive(),
  number: z.coerce.number().int().positive(),

  title: z.coerce.string().transform((s) => s.trim()),

  body: z.coerce
    .string()
    .nullish()
    .transform((s) => {
      const trimmed = s?.trim();
      return trimmed ? trimmed : null;
    }),

  state: z.coerce
    .string()
    .transform((s) => s.trim().toLowerCase())
    .pipe(z.enum(['open', 'closed'])),


  user: z.object({ login: z.coerce.string() }).nullish(),

  created_at: IsoDate,
  updated_at: IsoDate,
  closed_at: IsoDate.nullish(),

  pull_request: z.unknown().optional(),
});

export type GitHubIssue = z.infer<typeof GitHubIssueSchema>;

/** One row ready to be written to the `issue` table. */
export type IssueRow = {
  repo_id: number;
  external_id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  author: string | null;
  created_at: Date;
  updated_at: Date;
  closed_at: Date | null;
  raw_payload_location: string;
};

export type AdaptResult =
  | { ok: true; row: IssueRow; warnings: string[] }
  | { ok: false; errors: string[] };

export function isPullRequest(item: unknown): boolean {
  return (
    typeof item === "object" &&
    item !== null &&
    "pull_request" in item &&
    (item as { pull_request?: unknown }).pull_request != null
  );
}

export type FetchResult = {
  items: unknown[];
  rateLimit: { remaining: string | null; limit: string | null; resetAt: Date | null };
};

export async function fetchIssuesPage(
  owner: string,
  name: string,
  page: number,
  token: string,
): Promise<FetchResult> {
  const url = new URL(`https://api.github.com/repos/${owner}/${name}/issues`);
  url.searchParams.set("state", "all");       // default is open only
  url.searchParams.set("per_page", "100");
  url.searchParams.set("sort", "created");    // oldest first: pages never shift
  url.searchParams.set("direction", "asc");
  url.searchParams.set("page", String(page));

  const res = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });

  const reset = res.headers.get("x-ratelimit-reset");
  const rateLimit = {
    remaining: res.headers.get("x-ratelimit-remaining"),
    limit: res.headers.get("x-ratelimit-limit"),
    resetAt: reset ? new Date(Number(reset) * 1000) : null,
  };

  if (!res.ok) {
    throw new Error(`GitHub ${res.status} ${res.statusText}: ${(await res.text()).slice(0, 300)}`);
  }

  const body = await res.json();
  if (!Array.isArray(body)) {
    throw new Error(`GitHub returned a non-array: ${JSON.stringify(body).slice(0, 300)}`);
  }

  return { items: body, rateLimit };
}

export function toIssueRow(
  raw: unknown,
  repoId: unknown,
  rawPayloadLocation: unknown,
): AdaptResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const repoIdResult = z.coerce.number().int().positive().safeParse(repoId);
  if (!repoIdResult.success) {
    errors.push(`repoId: expected a positive integer, got ${JSON.stringify(repoId)}`);
  } else if (typeof repoId !== 'number') {
    warnings.push(`repoId coerced from ${typeof repoId} to number`);
  }

  const locationResult = z.string().min(1).safeParse(rawPayloadLocation);
  if (!locationResult.success) {
    errors.push(`rawPayloadLocation: expected a non-empty string, got ${JSON.stringify(rawPayloadLocation)}`);
  }

  const parsed = GitHubIssueSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const item = parsed.data!;

  const source = raw as Record<string, unknown>;
  if (typeof source.id !== 'number') warnings.push(`id coerced from ${typeof source.id}`);
  if (typeof source.title === 'string' && source.title !== item.title) {
    warnings.push('title trimmed');
  }
  if (typeof source.state === 'string' && source.state !== item.state) {
    warnings.push(`state normalised from "${source.state}" to "${item.state}"`);
  }
  if (typeof source.body === 'string' && source.body.trim() === '' ) {
    warnings.push('empty body normalised to null');
  }
  if (!item.title) warnings.push('title is empty after trimming');

  return {
    ok: true,
    warnings,
    row: {
      repo_id: repoIdResult.data!,
      external_id: item.id,
      number: item.number,
      title: item.title,
      body: item.body ?? null,
      state: item.state,
      author: item.user?.login ?? null,
      created_at: item.created_at,
      updated_at: item.updated_at,
      closed_at: item.closed_at ?? null,
      raw_payload_location: locationResult.data!,
    },
  };
}
