import { Link } from "../routing";

export default function NotFoundPage(props: { pathname: string }) {
  return (
    <div
      style={{
        width: "100vw",
        minHeight: "100vh",
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <h1 style={{ margin: "0 0 12px" }}>Not Found</h1>
        <p style={{ margin: "0 0 24px", opacity: 0.8 }}>
          No route matches <code>{props.pathname}</code>.
        </p>
        <Link to="/">Go home</Link>
      </div>
    </div>
  );
}
