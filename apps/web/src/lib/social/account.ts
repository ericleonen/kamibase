import { socialClient } from "./supabase";

/**
 * The settings that belong to an account rather than to a profile.
 *
 * A profile is what other people see: a name, a picture, a bio. These are the
 * decisions you make about the account itself, and they are separate for the
 * same reason the two pages are: nobody editing their bio is also deciding
 * whether to be emailed about comments.
 */
export interface AccountSettings {
  readonly isPrivate: boolean;
  readonly notifyFollows: boolean;
  readonly notifyFolds: boolean;
  readonly notifyComments: boolean;
}

export const DEFAULT_ACCOUNT: AccountSettings = {
  isPrivate: false,
  notifyFollows: true,
  notifyFolds: true,
  notifyComments: true,
};

export const ACCOUNT_COLUMNS = "is_private, notify_follows, notify_folds, notify_comments";

interface AccountRow {
  is_private: boolean | null;
  notify_follows: boolean | null;
  notify_folds: boolean | null;
  notify_comments: boolean | null;
}

function mapAccount(row: AccountRow): AccountSettings {
  return {
    isPrivate: row.is_private ?? false,
    notifyFollows: row.notify_follows ?? true,
    notifyFolds: row.notify_folds ?? true,
    notifyComments: row.notify_comments ?? true,
  };
}

/**
 * Read an account's settings, or the defaults.
 *
 * A deployment that has not run `0003_settings.sql` has none of these columns,
 * and the query fails. That is not a reason to break a page: the defaults are
 * exactly the behaviour the site had before the migration existed — public, and
 * every notification on — so falling back to them keeps an un-migrated
 * deployment working as it always did. `settingsAvailable` is what the settings
 * page uses to say so out loud rather than silently discarding a change.
 */
export async function getAccountSettings(userId: string): Promise<AccountSettings> {
  const supabase = await socialClient();
  if (!supabase) return DEFAULT_ACCOUNT;

  const { data, error } = await supabase
    .from("profiles")
    .select(ACCOUNT_COLUMNS)
    .eq("id", userId)
    .maybeSingle<AccountRow>();

  if (error || !data) return DEFAULT_ACCOUNT;
  return mapAccount(data);
}

/** Whether `0003_settings.sql` has been run against this database. */
export async function settingsAvailable(): Promise<boolean> {
  const supabase = await socialClient();
  if (!supabase) return false;
  const { error } = await supabase.from("profiles").select("is_private").limit(1);
  return !error;
}

export async function updateAccountSettings(
  userId: string,
  patch: Partial<AccountSettings>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await socialClient();
  if (!supabase) return { ok: false, error: "Accounts are not configured on this deployment." };

  const row: Record<string, boolean> = {};
  if (patch.isPrivate !== undefined) row["is_private"] = patch.isPrivate;
  if (patch.notifyFollows !== undefined) row["notify_follows"] = patch.notifyFollows;
  if (patch.notifyFolds !== undefined) row["notify_folds"] = patch.notifyFolds;
  if (patch.notifyComments !== undefined) row["notify_comments"] = patch.notifyComments;
  if (Object.keys(row).length === 0) return { ok: true };

  const { error } = await supabase.from("profiles").update(row).eq("id", userId);
  if (error) {
    return {
      ok: false,
      error:
        "Could not save that. If this deployment has not run supabase/migrations/0003_settings.sql yet, that is why.",
    };
  }
  return { ok: true };
}
