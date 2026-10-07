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

export function Stats({ heads, posts }: { heads: number; posts: number }) {
  const items: [number, string, string][] = [[heads || 18, "+", "Student leaders"], [6, "", "Departments"], [Math.max(posts, 1), "+", "Essays published"], [100, "%", "Student-led"]];
  return <section className="stats">{items.map(([n, s, l]) => <div key={l}><strong><Count to={n} suffix={s} /></strong><span>{l}</span></div>)}</section>;
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
