// The backend of MemorySmith's frontend, answered from the demonstration notebooks instead of an
// API. Copied into a checkout of MemorySmith at the commit the renderer was extracted from, where
// it replaces `src/shared/api/backend.ts` for the reference page; every other export is the real
// one, and none of them is called.

// @ts-nocheck — compiled by the checkout's Vite, against the checkout's types.
export * from '@real-backend';
import { splitFrontmatter } from '../src/shared/api/markdown';
import notebooks from './notebooks.json';

interface File {
  readonly slug: string;
  readonly path: string;
  readonly markdown: string;
}

const files: File[] = notebooks.files;
const kept: Record<string, string[]> = notebooks.kept;

/** A ULID of the notebook, made of the slug, so a notebook keeps one identifier. */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function ulid(seed: string): string {
  let hash = 2166136261;
  for (const character of seed) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  let out = '01J8X2K9QZ3M4N5P';
  for (let i = 0; i < 10; i++) {
    out += CROCKFORD[(hash >>> (i * 3)) & 31];
    hash = Math.imul(hash ^ i, 2246822519) >>> 0;
  }
  return out;
}

export const notebookIdOf = (slug: string): string => ulid(`notebook:${slug}`);
const noteIdOf = (file: File): string => ulid(`note:${file.slug}/${file.path}`);
const folderIdOf = (slug: string, folder: string): string => ulid(`folder:${slug}/${folder}`);
const slugOf = (notebookId: string): string => files.find((file) => notebookIdOf(file.slug) === notebookId)?.slug ?? '';

function nameOf(file: File): string | null {
  const { frontmatter, lists } = splitFrontmatter(file.markdown);
  if (lists.has('name')) return null;
  const name = (frontmatter['name'] ?? '').normalize('NFC').trim();
  return name.length === 0 || /[#[\]|]/.test(name) ? null : name;
}

function aliasesOf(file: File): string[] {
  const { frontmatter } = splitFrontmatter(file.markdown);
  return (frontmatter['aliases'] ?? '')
    .split(',')
    .map((alias) => alias.normalize('NFC').trim())
    .filter(Boolean);
}

const notesOf = (notebookId: string): File[] => files.filter((file) => file.slug === slugOf(notebookId));

export async function getNotebookStructure(notebookId: string) {
  const slug = slugOf(notebookId);
  const notes = notesOf(notebookId);
  const folders = [...new Set(notes.map((file) => file.path.split('/').slice(0, -1).join('/')))].sort();
  return {
    notebook: { id: notebookId, slug, name: slug, description: '', noteCount: notes.length, updatedAt: '2026-10-12T00:00:00.000Z', effectiveRole: 'OWNER' },
    guidance: null,
    guidanceRevision: null,
    effectiveRole: 'OWNER',
    folders: folders.map((folder, position) => ({
      id: folderIdOf(slug, folder),
      parentId: null,
      name: folder,
      slug: folder,
      description: '',
      position,
      noteOrder: 'manual',
      hasTemplate: false,
      noteCount: 0,
      notes: notes
        .filter((file) => file.path.split('/').slice(0, -1).join('/') === folder)
        .map((file) => ({ id: noteIdOf(file), name: nameOf(file), folderId: folderIdOf(slug, folder) })),
      children: [],
    })),
  };
}

export async function getNotebookNames(notebookId: string) {
  const slug = slugOf(notebookId);
  return notesOf(notebookId).map((file) => ({
    noteId: noteIdOf(file),
    name: nameOf(file),
    aliases: aliasesOf(file),
    folderId: folderIdOf(slug, file.path.split('/').slice(0, -1).join('/')),
  }));
}

export async function getNotebookFiles(notebookId: string) {
  return (kept[slugOf(notebookId)] ?? []).map((name) => ({
    fileId: ulid(`file:${slugOf(notebookId)}/${name}`),
    name,
    description: '',
    mimeType: name.endsWith('.png') ? 'image/png' : 'application/octet-stream',
    tags: [],
    path: '/',
    bytes: 1000,
    sha256: '0'.repeat(64),
    updatedAt: '2026-10-12T00:00:00.000Z',
    authorship: { author: null, coAuthor: null },
  }));
}

export async function linkToFile(notebookId: string, fileId: string) {
  const slug = slugOf(notebookId);
  const name = (kept[slug] ?? []).find((each) => ulid(`file:${slug}/${each}`) === fileId) ?? '';
  const url = `/notes/${encodeURIComponent(slug)}/assets/${encodeURIComponent(name)}`;
  return { url, downloadUrl: url, opens: true, expiresAt: '2099-01-01T00:00:00.000Z' };
}

export async function getNote(notebookId: string, noteId: string) {
  const file = notesOf(notebookId).find((each) => noteIdOf(each) === noteId);
  if (!file) throw new Error(`no note ${noteId}`);
  const { frontmatter, lists, body } = splitFrontmatter(file.markdown);
  return {
    id: noteId,
    notebookId,
    folderId: folderIdOf(file.slug, file.path.split('/').slice(0, -1).join('/')),
    name: nameOf(file),
    folderNames: file.path.split('/').slice(0, -1),
    frontmatter,
    listProperties: [...lists],
    body,
    raw: file.markdown,
    revision: 'r1',
    updatedAt: '2026-10-12T00:00:00.000Z',
  };
}

export async function resolveLinkTarget(notebookId: string, target: string) {
  const wanted = target.normalize('NFC');
  const notes = notesOf(notebookId);
  const named = notes.filter((file) => nameOf(file) === wanted);
  const matched = named.length > 0 ? named : notes.filter((file) => aliasesOf(file).includes(wanted));
  return {
    target: wanted,
    by: named.length > 0 ? 'name' : matched.length > 0 ? 'alias' : null,
    notes: matched.map((file) => ({ noteId: noteIdOf(file), name: nameOf(file) })),
  };
}

/** The file of a page address, `/notes/<slug>/<path>`. */
export function fileAt(pathname: string): File | null {
  const [slug, ...rest] = pathname.replace(/^\/notes\//, '').split('/').map((segment) => decodeURIComponent(segment));
  return files.find((file) => file.slug === slug && file.path === `${rest.join('/')}.md`) ?? null;
}
