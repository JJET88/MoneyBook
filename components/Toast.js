"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const ToastContext = createContext(() => {});

/**
 * A short confirmation at the bottom of the screen ("Added food 65").
 * toast(text, { label, run }) adds a button, such as Undo, and stays a little longer.
 */
export const useToast = () => useContext(ToastContext);

export default function ToastProvider({ children }) {
  const [shown, setShown] = useState(null);
  const timer = useRef(null);
  const toast = useCallback((text, action = null) => {
    setShown({ text, action, key: Date.now() });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShown(null), action ? 7000 : 3200);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  function act() {
    const { run } = shown.action;
    clearTimeout(timer.current);
    setShown(null);
    run();
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Always in the page, so screen readers announce the text when it changes. */}
      <div className="toast" role="status" hidden={!shown}>
        {shown && <span key={shown.key}>{shown.text}</span>}
        {shown?.action && <button type="button" onClick={act}>{shown.action.label}</button>}
      </div>
    </ToastContext.Provider>
  );
}
