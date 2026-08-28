import type { Metadata } from "next";
import Link from "next/link";
import { SettingsNav } from "@/components/settings/SettingsNav";
import {
  DeleteAccountForm,
  EmailForm,
  PasswordForm,
  PrivacyAndNotifications,
} from "@/components/settings/AccountForms";
import { SocialNotice } from "@/components/social/SocialNotice";
import { getAccountSettings, settingsAvailable } from "@/lib/social/account";
import { isMailConfigured } from "@/lib/mail/send";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Account",
  description: "Your email, your privacy, your notifications, and the way out.",
};

/**
 * The account, as opposed to the profile.
 *
 * Nothing here is about how you look to other people; that is
 * `/settings/profile`. This is the address you sign in with, who may see your
 * work, what reaches your inbox, and how to leave.
 *
 * Rendered per request rather than prerendered: half of it depends on the
 * session and the other half on environment variables that a deployment can add
 * without a rebuild.
 */
export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <SocialNotice
          reason="unconfigured"
          message="Accounts are not configured on this deployment yet, so there is nothing here to change."
        />
      </div>
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-10">
        <h1 className="text-2xl font-black tracking-tight">Account</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          <Link href="/login" className="font-semibold underline">
            Log in
          </Link>{" "}
          to change your account settings. The{" "}
          <Link href="/settings/appearance" className="font-semibold underline">
            appearance settings
          </Link>{" "}
          work without one.
        </p>
      </div>
    );
  }

  const [settings, available] = await Promise.all([
    getAccountSettings(user.id),
    settingsAvailable(),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      <div className="space-y-4">
        <h1 className="text-2xl font-black tracking-tight">Settings</h1>
        <SettingsNav current="/settings/account" />
      </div>

      <Section title="Privacy and notifications">
        {!isMailConfigured() && (
          <p
            className="mb-4 rounded-2xl p-3 text-sm"
            style={{ background: "var(--surface-sunken)", color: "var(--text-muted)" }}
          >
            No mail service is connected to this deployment, so nothing is being
            emailed whatever these say.
          </p>
        )}
        <PrivacyAndNotifications settings={settings} available={available} />
      </Section>

      <Section title="Email">
        <EmailForm current={user.email} />
      </Section>

      <Section title="Password">
        <PasswordForm email={user.email} />
      </Section>

      <Section title="Delete account" danger>
        <DeleteAccountForm />
      </Section>
    </div>
  );
}

function Section({
  title,
  danger,
  children,
}: {
  readonly title: string;
  readonly danger?: boolean;
  readonly children: React.ReactNode;
}) {
  return (
    <section
      className="space-y-4 rounded-2xl p-5"
      style={{
        background: "var(--surface-raised)",
        border: `1px solid ${danger ? "var(--danger)" : "var(--border)"}`,
      }}
    >
      <h2
        className="text-lg font-bold tracking-tight"
        style={danger ? { color: "var(--danger)" } : {}}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
