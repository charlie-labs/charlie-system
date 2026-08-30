interface DocumentLike {
  id: string;
  slugId?: string | null;
  title?: string | null;
  project?: { name?: string | null } | null;
  creator?: { displayName?: string | null; name?: string | null } | null;
  color?: string | null;
}

export function documentToTsv(doc: DocumentLike): string {
  const slugOrId = doc.slugId ?? doc.id;
  const title = (doc.title ?? '').replace(/\s+/g, ' ');
  const projectName = doc.project?.name ?? '';
  const creatorName = doc.creator?.displayName ?? doc.creator?.name ?? '';
  return [slugOrId, title, projectName, creatorName].join('\t');
}
