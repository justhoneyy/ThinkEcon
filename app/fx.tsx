"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Pause, Play } from "lucide-react";

/** Thin progress bar showing how far down the page the reader is. */
export function ScrollBar() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let f = 0;
    const on = () => { if (f) return; f = requestAnimationFrame(() => { f = 0; const h = document.documentElement; const p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight); ref.current?.style.setProperty("--p", String(p)); }); };
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return <div className="scrollbar" ref={ref} aria-hidden />;
}

/** Counts up once when scrolled into view. */
function Count({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null); const [n, setN] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; io.disconnect();
      const t0 = performance.now();
      const step = (t: number) => { const k = Math.min(1, (t - t0) / 1400); setN(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }, { threshold: 0.6 });
    io.observe(el); return () => io.disconnect();
  }, [to]);
  return <span ref={ref}>{n}{suffix}</span>;
}

type Counts = { heads?: number; posts?: number; podcasts?: number; events?: number };

/** Editorial About: scroll-lit statement + an animated supply/demand chart + a numbers ledger (all counts are live). */
export function About({ text, counts }: { text: string; counts?: Counts }) {
  const root = useRef<HTMLElement>(null); const words = text.split(/\s+/).filter(Boolean);
  useEffect(() => {
    const el = root.current; if (!el) return;
    const spans = Array.from(el.querySelectorAll<HTMLElement>(".about-word"));
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { spans.forEach((w) => w.classList.add("on")); el.classList.add("in"); return; }
    let f = 0;
    const update = () => {
      f = 0; const r = el.querySelector(".about-text")!.getBoundingClientRect(); const vh = innerHeight;
      const p = Math.min(1, Math.max(0, (vh * 0.88 - r.top) / (r.height + vh * 0.35)));
      const n = Math.round(p * spans.length * 1.15);
      spans.forEach((w, k) => w.classList.toggle("on", k < n));
    };
    const on = () => { if (!f) f = requestAnimationFrame(update); };
    update(); addEventListener("scroll", on, { passive: true }); addEventListener("resize", on);
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add("in"); io.disconnect(); } }, { threshold: 0.25 });
    io.observe(el);
    return () => { removeEventListener("scroll", on); removeEventListener("resize", on); io.disconnect(); };
  }, [text]);
  const cells = ([[counts?.heads, "Student leaders"], [counts?.posts, "Essays published"], [counts?.podcasts, "Podcast episodes"], [counts?.events, "Events hosted"]] as [number | undefined, string][]).filter(([n]) => n && n > 0);
  return <section className="about" id="about" ref={root}>
    <div className="about-grid">
      <div>
        <p className="about-label"><i />About ThinkEconomics</p>
        <h2 className="about-text" aria-label={text}>{words.map((w, k) => <span key={k} className="about-word" aria-hidden>{w} </span>)}</h2>
      </div>
      <figure className="about-chart">
        <svg viewBox="0 0 400 300" role="img" aria-label="Supply and demand curves meeting at the equilibrium point">
          <g className="grid">{[60, 120, 180, 240].map((y) => <line key={y} x1="40" x2="370" y1={y} y2={y} />)}{[120, 200, 280, 360].map((x) => <line key={x} y1="30" y2="270" x1={x} x2={x} />)}</g>
          <path className="axis" d="M40 24V270H372" />
          <path className="curve supply" d="M40 260C140 230 240 130 360 40" pathLength="1" />
          <path className="curve demand" d="M40 40C140 70 240 170 360 260" pathLength="1" />
          <line className="guide" x1="221" y1="150" x2="221" y2="270" /><line className="guide" x1="40" y1="150" x2="221" y2="150" />
          <circle className="pulse" cx="221" cy="150" r="8" /><circle className="dot" cx="221" cy="150" r="7" />
          <text x="46" y="18" className="t">Price</text><text x="372" y="288" className="t" textAnchor="end">Quantity</text>
          <text x="330" y="30" className="t lime" textAnchor="end">Supply</text><text x="330" y="262" className="t" textAnchor="end">Demand</text>
          <text x="236" y="136" className="t strong">Equilibrium</text>
        </svg>
        <figcaption>Where supply meets demand, ideas find their price.</figcaption>
      </figure>
    </div>
    {cells.length > 1 && <div className="ledger" style={{ "--cols": cells.length } as React.CSSProperties}>{cells.map(([n, l], k) => <div key={l}><small>{String(k + 1).padStart(2, "0")}</small><strong><Count to={n!} suffix="+" /></strong><span>{l}</span></div>)}</div>}
  </section>;
}

/** Cinematic video band: autoplays muted only while visible, with a pause control. */
export function FilmBand() {
  const v = useRef<HTMLVideoElement>(null); const [playing, setPlaying] = useState(true);
  useEffect(() => {
    const el = v.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && playing) el.play().catch(() => {}); else el.pause(); }, { threshold: 0.35 });
    io.observe(el); return () => io.disconnect();
  }, [playing]);
  return <section className="film">
    <video ref={v} src="/discussion/debate-competition-web.mp4" muted loop playsInline preload="metadata" poster="/discussion/debate-1-web.jpg" />
    <div className="film-shade" />
    <div className="film-copy"><p>On the floor</p><h2>Where arguments<br />get sharper.</h2><Link href="/discussion">See the debates <ArrowUpRight size={18} /></Link></div>
    <button className="film-toggle" onClick={() => { setPlaying(!playing); if (playing) v.current?.pause(); }} aria-label={playing ? "Pause video" : "Play video"}>{playing ? <Pause size={18} /> : <Play size={18} />}</button>
  </section>;
}
