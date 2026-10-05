"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const ToastContext = createContext(() => {});

/** A short confirmation at the bottom of the screen ("Added food 65"). */
export const useToast = () => useContext(ToastContext);

export default function ToastProvider({ children }) {
  const [text, setText] = useState("");
  const timer = useRef(null);
  const toast = useCallback((message) => {
    setText(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setText(""), 3200);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Always in the page, so screen readers announce the text when it changes. */}
      <p className="toast" role="status" hidden={!text}>{text}</p>
    </ToastContext.Provider>
  );
}
