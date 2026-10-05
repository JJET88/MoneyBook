import { Fragment } from "react";

/**
 * A translated sentence with elements inside it, so each language can put
 * the link where its grammar wants it:
 *   <Rich text={t("hint.needStart")} settings={<Link href="/settings">Settings</Link>} />
 */
export default function Rich({ text, ...parts }) {
  return text.split(/(\{\w+\})/).map((piece, i) => {
    const name = /^\{(\w+)\}$/.exec(piece)?.[1];
    return <Fragment key={i}>{name && name in parts ? parts[name] : piece}</Fragment>;
  });
}
