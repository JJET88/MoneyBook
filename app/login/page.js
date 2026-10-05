import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const t = await getT();
  return { title: `${t("title.login")} · ${t("app.name")}` };
}

export default async function Page() {
  if (await getCurrentUser()) redirect("/");
  return <AuthForm mode="login" />;
}
