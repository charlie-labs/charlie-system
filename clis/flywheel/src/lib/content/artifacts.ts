import { parseDaemon, parseDocument, parseSkill } from './artifact-markdown.js';
import type { ParsedFile } from './artifact-types.js';
import { parseCatalog, parseRole } from './artifact-yaml.js';
import type { ClassifiedFile } from './files.js';

export function validateAndParseArtifact(
  classified: ClassifiedFile,
  content: string
): ParsedFile {
  if (classified.category === 'catalog') {
    return parseCatalog(classified, content);
  }
  if (classified.category === 'daemon') {
    return parseDaemon(classified, content);
  }
  if (classified.category === 'document') {
    return parseDocument(classified, content);
  }
  if (classified.category === 'role') {
    return parseRole(classified, content);
  }
  if (classified.category === 'skill') {
    return parseSkill(classified, content);
  }
  return { classified, content, diagnostics: [] };
}
