import Link from "next/link";
import Rich from "@/components/Rich";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const t = await getT();
  return (
    <div className="panel stack">
      <h2>{t("notFound.title")}</h2>
      <p className="hint"><Rich text={t("notFound.text")} back={<Link href="/">{t("notFound.back")}</Link>} /></p>
    </div>
  );
}
