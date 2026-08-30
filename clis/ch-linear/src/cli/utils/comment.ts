interface CommentLike {
  id: string;
  body: string;
  createdAt?: string | number | Date;
  updatedAt?: string | number | Date;
  user?: { displayName?: string | null; name?: string | null } | null;
}

interface CommentTsvOptions {
  timestamp?: 'createdAt' | 'updatedAt';
}

export function commentToTsv(
  comment: CommentLike,
  opts: CommentTsvOptions = {}
): string {
  const userName = comment.user?.displayName ?? comment.user?.name ?? '';
  const tsField: 'createdAt' | 'updatedAt' = opts.timestamp ?? 'createdAt';
  const rawTs =
    tsField === 'createdAt'
      ? (comment.createdAt ?? comment.updatedAt)
      : (comment.updatedAt ?? comment.createdAt);
  const iso = rawTs
    ? rawTs instanceof Date
      ? rawTs.toISOString()
      : new Date(rawTs).toISOString()
    : '';
  const snippet = comment.body.replace(/\s+/g, ' ').slice(0, 60);
  return `${comment.id}\t${userName}\t${iso}\t${snippet}`;
}
