import { useEffect } from "react";

export default function DynamicStyle({ css, styleId }) {
  useEffect(() => {
    if (!css) return;

    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }

    style.innerHTML = css;

    return () => {
      style.remove();
    };
  }, [css, styleId]);

  return null;
}
