import { Backup, StartAgain, StartingBalance } from "@/components/SettingsForms";
import { requireUser } from "@/lib/auth/current-user";
import { getT } from "@/lib/i18n/server";
import { getSettings, monthTotals } from "@/lib/repos/book";

export async function generateMetadata() {
  const t = await getT();
  return { title: `${t("tabs.settings")} · ${t("app.name")}` };
}

export default async function SettingsPage() {
  const user = await requireUser();
  const [settings, months, t] = await Promise.all([getSettings(user.id), monthTotals(user.id), getT()]);
  return (
    <>
      {/* key: after a restore or an erase the saved settings differ, so the form starts over from them */}
      <StartingBalance key={JSON.stringify(settings)} settings={settings} />
      <Backup monthsInBook={months.length} />
      <StartAgain />
      <p className="hint account">{t("settings.loggedInAs", { name: user.name, email: user.email })}</p>
    </>
  );
}
