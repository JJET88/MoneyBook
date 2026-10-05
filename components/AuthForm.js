"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { logIn, signUp } from "@/app/actions";
import { useT } from "./I18n";

export default function AuthForm({ mode }) {
  const signup = mode === "signup";
  const t = useT();
  // useActionState runs the Server Action when the form is sent and gives
  // back what it returned (here, an error to show) and whether it is running.
  const [state, action, pending] = useActionState(signup ? signUp : logIn, {});
  // Controlled inputs keep what was typed when the server answers with an error.
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  return (
    <form action={action} className="panel form auth">
      <h2>{t(signup ? "auth.signupTitle" : "auth.loginTitle")}</h2>
      <p className="hint">{t(signup ? "app.description" : "auth.loginIntro")}</p>
      {signup && (
        <label className="field">{t("auth.name")}
          <input className="input" name="name" autoComplete="name" maxLength={40} value={form.name} onChange={set("name")} />
        </label>
      )}
      <label className="field">{t("auth.email")}
        <input className="input" name="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} />
      </label>
      <label className="field">{t(signup ? "auth.newPassword" : "auth.password")}
        <input className="input" name="password" type="password" autoComplete={signup ? "new-password" : "current-password"}
          value={form.password} onChange={set("password")} />
      </label>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      <button type="submit" className="primary" disabled={pending}>{t(signup ? "auth.create" : "auth.logIn")}</button>
      <p className="hint">
        {t(signup ? "auth.haveBook" : "auth.newHere")}{" "}
        <Link href={signup ? "/login" : "/signup"}>{t(signup ? "auth.logIn" : "auth.startBook")}</Link>
      </p>
    </form>
  );
}
