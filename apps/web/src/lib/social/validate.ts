/**
 * Input rules for the social layer.
 *
 * These are pure functions with no Supabase in sight, so they are unit-tested
 * directly and reused by both the form and the server action. The database
 * enforces the same rules again as CHECK constraints: this layer exists to
 * produce a sentence a person can act on, not to be the only guard.
 */

/** What a validator hands back. Never throws, in the house style. */
export type Validated<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

function ok<T>(value: T): Validated<T> {
  return { ok: true, value };
}

function bad<T>(error: string): Validated<T> {
  return { ok: false, error };
}

// ---------------------------------------------------------------------------
// Handles
// ---------------------------------------------------------------------------

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 24;

/** Reserved because they are (or will be) top-level routes or role words. */
const RESERVED_HANDLES = new Set([
  "about",
  "admin",
  "api",
  "auth",
  "docs",
  "edit",
  "editor",
  "explore",
  "feed",
  "help",
  "kamibase",
  "login",
  "logout",
  "new",
  "p",
  "settings",
  "sim",
  "signup",
  "support",
  "u",
  "upload",
]);

/**
 * Fold a typed handle into its canonical form: lowercase, spaces and dots to
 * underscores, everything else dropped.
 *
 * Someone typing "Eric Leonen" should get `eric_leonen` rather than an error
 * about characters they did not know were forbidden.
 */
export function normalizeHandle(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s.\-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, HANDLE_MAX);
}

export function validateHandle(input: string): Validated<string> {
  const handle = normalizeHandle(input);
  if (handle.length < HANDLE_MIN) {
    return bad(`Handles need at least ${HANDLE_MIN} letters or numbers.`);
  }
  if (RESERVED_HANDLES.has(handle)) {
    return bad(`"${handle}" is reserved. Pick another one.`);
  }
  return ok(handle);
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

export const DISPLAY_NAME_MAX = 60;
export const BIO_MAX = 500;
export const WEBSITE_MAX = 200;

export interface ProfileDraft {
  readonly handle: string;
  readonly displayName: string;
  readonly bio: string;
  readonly website?: string;
}

/**
 * Accept only http(s) links.
 *
 * A profile link is rendered as an anchor, so `javascript:` and `data:` URLs
 * would be a stored-XSS vector dressed up as a personal website.
 */
export function normalizeWebsite(input: string): Validated<string | undefined> {
  const raw = input.trim();
  if (raw === "") return ok(undefined);
  if (raw.length > WEBSITE_MAX) {
    return bad(`Keep the link under ${WEBSITE_MAX} characters.`);
  }
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return bad("That does not look like a web address.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return bad("Links have to start with http:// or https://.");
  }
  if (!url.hostname.includes(".")) {
    return bad("That does not look like a web address.");
  }
  return ok(url.toString());
}

export function validateProfileDraft(input: {
  handle: string;
  displayName: string;
  bio: string;
  website: string;
}): Validated<ProfileDraft> {
  const handle = validateHandle(input.handle);
  if (!handle.ok) return bad(handle.error);

  const displayName = input.displayName.trim().slice(0, DISPLAY_NAME_MAX);
  const bio = input.bio.trim();
  if (bio.length > BIO_MAX) {
    return bad(`Keep the bio under ${BIO_MAX} characters. That one is ${bio.length}.`);
  }

  const website = normalizeWebsite(input.website);
  if (!website.ok) return bad(website.error);

  return ok({
    handle: handle.value,
    displayName,
    bio,
    ...(website.value === undefined ? {} : { website: website.value }),
  });
}

// ---------------------------------------------------------------------------
// Folds
// ---------------------------------------------------------------------------

export const CAPTION_MAX = 1000;
export const PAPER_MAX = 80;

export interface FoldDraft {
  readonly caption: string;
  readonly paper?: string;
  readonly sizeMm?: number;
  readonly minutes?: number;
  readonly difficulty?: number;
}

/** Parse an optional integer field from a form, with a range. */
function optionalInteger(
  raw: string,
  label: string,
  min: number,
  max: number,
): Validated<number | undefined> {
  const trimmed = raw.trim();
  if (trimmed === "") return ok(undefined);
  const value = Number(trimmed);
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return bad(`${label} has to be a whole number.`);
  }
  if (value < min || value > max) {
    return bad(`${label} has to be between ${min} and ${max}.`);
  }
  return ok(value);
}

export function validateFoldDraft(input: {
  caption: string;
  paper: string;
  sizeMm: string;
  minutes: string;
  difficulty: string;
}): Validated<FoldDraft> {
  const caption = input.caption.trim();
  if (caption.length > CAPTION_MAX) {
    return bad(`Keep the caption under ${CAPTION_MAX} characters.`);
  }

  const paper = input.paper.trim().slice(0, PAPER_MAX);
  const sizeMm = optionalInteger(input.sizeMm, "Paper size", 10, 2000);
  if (!sizeMm.ok) return bad(sizeMm.error);
  const minutes = optionalInteger(input.minutes, "Time taken", 1, 100_000);
  if (!minutes.ok) return bad(minutes.error);
  const difficulty = optionalInteger(input.difficulty, "Difficulty", 1, 10);
  if (!difficulty.ok) return bad(difficulty.error);

  return ok({
    caption,
    ...(paper === "" ? {} : { paper }),
    ...(sizeMm.value === undefined ? {} : { sizeMm: sizeMm.value }),
    ...(minutes.value === undefined ? {} : { minutes: minutes.value }),
    ...(difficulty.value === undefined ? {} : { difficulty: difficulty.value }),
  });
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export const COMMENT_MAX = 2000;

export function validateCommentBody(input: string): Validated<string> {
  const body = input.trim();
  if (body === "") return bad("Write something first.");
  if (body.length > COMMENT_MAX) {
    return bad(`Comments cap out at ${COMMENT_MAX} characters. That one is ${body.length}.`);
  }
  return ok(body);
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number];

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const FOLD_PHOTO_MAX_BYTES = 8 * 1024 * 1024;

const EXTENSIONS: Record<ImageMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export interface UploadedImage {
  readonly type: ImageMimeType;
  readonly size: number;
  readonly extension: string;
}

/**
 * Check an uploaded image before it reaches storage.
 *
 * The bucket enforces the same MIME and size limits, so this is not the only
 * guard. It exists so the person gets "that photo is 14MB, the limit is 8"
 * rather than an opaque storage rejection.
 */
export function validateImageUpload(
  file: { readonly type?: string; readonly size?: number; readonly name?: string } | null,
  maxBytes: number,
): Validated<UploadedImage> {
  if (!file || !file.size) return bad("Pick an image first.");

  const type = (file.type ?? "").toLowerCase() as ImageMimeType;
  if (!IMAGE_MIME_TYPES.includes(type)) {
    return bad("Images have to be JPEG, PNG or WebP.");
  }
  if (file.size > maxBytes) {
    return bad(
      `That image is ${formatBytes(file.size)}. The limit is ${formatBytes(maxBytes)}.`,
    );
  }
  return ok({ type, size: file.size, extension: EXTENSIONS[type] });
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}

/**
 * Where an image lands in its bucket.
 *
 * The first path segment is the uploader's id, which is exactly what the
 * storage policy checks. Getting this wrong is not a silent bug: the upload is
 * rejected.
 */
export function objectPath(userId: string, id: string, extension: string): string {
  return `${userId}/${id}.${extension}`;
}
