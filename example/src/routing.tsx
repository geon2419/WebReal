import type { CSSProperties, ReactNode, JSX } from "react";
import { useMemo } from "react";
import { navigate, resolveHref } from "./navigation";

export function Link(props: {
  to: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  title?: string;
}): JSX.Element {
  const href = useMemo(() => resolveHref(props.to), [props.to]);

  return (
    <a
      href={href}
      className={props.className}
      style={props.style}
      title={props.title}
      onClick={(event) => {
        if (event.defaultPrevented) return;
        if (event.button !== 0) return;
        if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey)
          return;
        event.preventDefault();
        navigate(props.to);
      }}
    >
      {props.children}
    </a>
  );
}
