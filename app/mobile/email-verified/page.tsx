export default function EmailVerifiedPage() {
  return (
    <main style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#07101f",
      color: "#ffffff",
      padding: 24,
      fontFamily: "Arial, sans-serif"
    }}>
      <div style={{
        maxWidth: 420,
        textAlign: "center",
        padding: 32,
        border: "1px solid #27385d",
        borderRadius: 20,
        background: "#111c39"
      }}>
        <h1 style={{ fontSize: 30 }}>AutoFace</h1>
        <div style={{ fontSize: 44, margin: "24px 0" }}>✓</div>
        <h2>Email verification</h2>
        <p style={{ color: "#c7d1e0", lineHeight: 1.7 }}>
          If Firebase has confirmed your email address,
          return to the AutoFace app and tap
          &quot;I've verified&quot; to continue.
        </p>
        <p style={{ color: "#8e9db5", fontSize: 13 }}>
          You can now close this browser window.
        </p>
      </div>
    </main>
  );
}
