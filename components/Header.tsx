import Link from "next/link";
import Image from "next/image";

export function Header() {
  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link href="/" className="brand"><Image src="/autoface-logo.png" alt="AutoFace" width={42} height={42} className="brand-logo" /><span>AutoFace</span></Link>
        <nav className="nav-links">
          <Link href="/how-it-works">How it works</Link>
          <Link href="/trust">Trust & Privacy</Link>
          <Link href="/dashboard">Authenticity Centre</Link>
          <Link href="/sign-in">Sign in</Link>
          <Link className="btn btn-primary" href="/register">Create account</Link>
        </nav>
      </div>
    </header>
  );
}
