"use client";

import { useActionState } from "react";
import { AVATAR_MAX_EDGE } from "@/lib/social/image";
import type { Profile } from "@/lib/social/types";
import { BIO_MAX, DISPLAY_NAME_MAX, HANDLE_MAX } from "@/lib/social/validate";
import { updateProfileAction, type ActionState } from "@/lib/social/actions";
import { ImagePicker } from "./ImagePicker";
import { SubmitButton } from "./SubmitButton";

const fieldStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
} as const;

/** Edit your own profile: picture, name, handle, bio, link. */
export function ProfileForm({ profile }: { readonly profile: Profile }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    updateProfileAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-5">
      <ImagePicker
        name="avatar"
        label="Profile picture"
        hint="Square works best. Leave it empty to keep the one you have."
        maxEdge={AVATAR_MAX_EDGE}
        shape="circle"
        {...(profile.avatarUrl === undefined ? {} : { currentUrl: profile.avatarUrl })}
      />

      <label className="block">
        <span className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Name
        </span>
        <input
          name="displayName"
          type="text"
          maxLength={DISPLAY_NAME_MAX}
          defaultValue={profile.displayName}
          placeholder="What people should call you"
          className="w-full rounded-xl px-3 py-2 text-sm"
          style={fieldStyle}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Handle
        </span>
        <div className="flex items-center gap-1">
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            kamibase.app/u/
          </span>
          <input
            name="handle"
            type="text"
            required
            maxLength={HANDLE_MAX}
            defaultValue={profile.handle}
            className="min-w-0 flex-1 rounded-xl px-3 py-2 font-mono text-sm"
            style={fieldStyle}
          />
        </div>
        <span className="mt-1 block text-xs" style={{ color: "var(--text-faint)" }}>
          Lowercase letters, numbers and underscores. Changing it changes your
          profile link, and the old one stops working.
        </span>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          About you
        </span>
        <textarea
          name="bio"
          rows={4}
          maxLength={BIO_MAX}
          defaultValue={profile.bio}
          placeholder="What you fold, how long you have been at it, what you are working on."
          className="w-full rounded-xl px-3 py-2 text-sm"
          style={fieldStyle}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Link <span style={{ color: "var(--text-faint)" }}>(optional)</span>
        </span>
        <input
          name="website"
          type="text"
          inputMode="url"
          defaultValue={profile.website ?? ""}
          placeholder="your-site.com"
          className="w-full rounded-xl px-3 py-2 text-sm"
          style={fieldStyle}
        />
      </label>

      {state.error && (
        <p className="text-sm" role="alert" style={{ color: "#b4261f" }}>
          {state.error}
        </p>
      )}
      {state.notice && (
        <p
          className="rounded-xl p-3 text-sm"
          role="status"
          style={{ background: "var(--brand-soft)", color: "var(--text)" }}
        >
          {state.notice}
        </p>
      )}

      <SubmitButton label="Save profile" pendingLabel="Saving…" />
    </form>
  );
}
