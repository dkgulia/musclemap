"use client";

import Link from "next/link";
import Image from "next/image";
import { ThemeProvider } from "@/context/ThemeContext";
import ThemeToggle from "@/components/ThemeToggle";

const stats = [
  { value: "10K+", label: "Scans completed" },
  { value: "98%", label: "Accuracy rate" },
  { value: "4.9", label: "User rating" },
  { value: "<30s", label: "Per scan" },
];

const steps = [
  {
    num: "01",
    title: "Pick a Pose Template",
    desc: "Choose from guided templates for consistent, comparable scans.",
    img: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=600&q=80&fit=crop",
  },
  {
    num: "02",
    title: "Align & Scan",
    desc: "Match the overlay, hold steady, and capture your scan.",
    img: "https://images.unsplash.com/photo-1605296867424-35fc25c9212a?w=600&q=80&fit=crop",
  },
  {
    num: "03",
    title: "Compare & Track Trends",
    desc: "See your progress over weeks and months with real data.",
    img: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=600&q=80&fit=crop",
  },
];

const features = [
  {
    title: "Pose-Based Scanning",
    desc: "No tape measure. AI detects landmarks and calculates indices from a single photo.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" />
        <path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    title: "Side-by-Side Compare",
    desc: "Drag-to-compare slider shows before and after. See exactly what changed.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="8" height="18" rx="2" />
        <rect x="14" y="3" width="8" height="18" rx="2" />
      </svg>
    ),
  },
  {
    title: "Progress Charts",
    desc: "Track development over 30, 60, 90 day windows. Numbers don't lie.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    title: "Weekly AI Insights",
    desc: "Personalized recommendations based on your muscle development patterns.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a10 10 0 1 0 10 10" /><path d="M12 2v10l7-4" />
      </svg>
    ),
  },
];

export default function LandingPage() {
  return (
    <ThemeProvider defaultTheme="light">
      <div className="min-h-screen bg-bg transition-colors overflow-x-hidden">
        {/* Nav */}
        <nav className="sticky top-0 z-50 bg-bg/80 backdrop-blur-xl border-b border-border">
          <div className="flex items-center justify-between px-6 py-4 max-w-[1100px] mx-auto">
            <span className="font-display text-lg font-bold tracking-tight text-text">
              MuscleMap
            </span>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Link
                href="/app/scan"
                className="hidden sm:inline-flex px-5 py-2 rounded-full bg-accent text-accent-fg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Open App
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="px-6 pt-12 sm:pt-20 pb-6 max-w-[1100px] mx-auto">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border text-xs text-text2 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Pose-based physique tracking
              </div>
              <h1 className="font-display text-[2.75rem] sm:text-5xl md:text-[3.75rem] font-bold text-text tracking-tight leading-[1.05]">
Track muscle progress with pose scans              <br />
                <span className="text-muted">with AI</span>
              </h1>
              <p className="text-base sm:text-lg text-text2 mt-6 leading-relaxed max-w-[420px]">
                Guided pose scans &rarr; muscle indexes &rarr; progress trends.
                Built for consistency, not guesses.
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-9">
                <Link
                  href="/app/scan"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-accent text-accent-fg text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-accent/10"
                >
                  Start scanning
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </Link>
                <span className="text-sm text-muted">Free to try &middot; No account needed &middot; Privacy-first</span>
              </div>

              {/* Social proof */}
              <div className="flex items-center gap-3 mt-7">
                <div className="flex -space-x-2">
                  {[
                    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face",
                    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=face",
                    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face",
                    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=face",
                  ].map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt=""
                      className="w-8 h-8 rounded-full border-2 border-bg object-cover"
                    />
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill="var(--text)" stroke="none">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted mt-0.5">Trusted by 10K+ athletes</p>
                </div>
              </div>
            </div>

            {/* Hero image */}
            <div className="relative">
              <div className="relative rounded-[2rem] overflow-hidden aspect-[4/5] shadow-2xl shadow-black/10">
                <Image
                  src="https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=800&q=80&fit=crop"
                  alt="Muscular athlete flexing"
                  fill
                  className="object-cover"
                  priority
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />

                {/* Floating score card */}
                <div className="absolute bottom-5 left-5 right-5 bg-white/10 backdrop-blur-2xl rounded-2xl p-4 border border-white/20">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center ring-2 ring-white/25">
                      <span className="text-base font-bold text-white">87</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">Front Biceps Index</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1 rounded-full bg-white/20 overflow-hidden">
                          <div className="h-full w-[87%] bg-white rounded-full" />
                        </div>
                        <span className="text-[10px] text-white/70 font-medium">+4.2%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="px-6 py-8 mt-4">
          <div className="max-w-[1100px] mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8 border border-border rounded-2xl py-8 px-6">
            {stats.map((s, i) => (
              <div key={s.label} className={`text-center ${i < 3 ? "sm:border-r sm:border-border" : ""}`}>
                <p className="font-display text-3xl sm:text-4xl font-bold text-text">{s.value}</p>
                <p className="text-sm text-muted mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="px-6 py-14 max-w-[1100px] mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">How it works</p>
            <h2 className="font-display text-3xl sm:text-[2.75rem] font-bold text-text tracking-tight leading-tight">
              Three steps to track
              <br />
              <span className="text-muted">your physique</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((step) => (
              <div key={step.num} className="group">
                <div className="relative rounded-2xl overflow-hidden aspect-[3/4] mb-5">
                  <Image
                    src={step.img}
                    alt={step.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <div className="absolute top-4 left-4">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white text-black text-xs font-bold">
                      {step.num}
                    </span>
                  </div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-xl font-bold text-white mb-1">{step.title}</h3>
                    <p className="text-sm text-white/70">{step.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="px-6 py-14 bg-surface2">
          <div className="max-w-[1100px] mx-auto">
            <div className="text-center mb-10">
              <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">Features</p>
              <h2 className="font-display text-3xl sm:text-[2.75rem] font-bold text-text tracking-tight">
                Everything you need
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="bg-bg rounded-2xl border border-border p-6 card-hover"
                >
                  <div className="w-11 h-11 rounded-xl bg-surface2 border border-border flex items-center justify-center mb-4">
                    {f.icon}
                  </div>
                  <h3 className="text-base font-semibold text-text mb-1.5">{f.title}</h3>
                  <p className="text-sm text-text2 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Transformation */}
        <section className="px-6 py-14 max-w-[1100px] mx-auto">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="grid grid-cols-2 gap-4">
              <div className="relative rounded-2xl overflow-hidden aspect-[3/4] shadow-xl shadow-black/10">
                <Image
                  src="https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&q=80&fit=crop"
                  alt="Week 1 physique"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, 25vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <span className="absolute bottom-3 left-3 text-xs font-semibold text-white bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-lg">
                  Week 1
                </span>
              </div>
              <div className="relative rounded-2xl overflow-hidden aspect-[3/4] shadow-xl shadow-black/10 ring-2 ring-accent/10">
                <Image
                  src="https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=400&q=80&fit=crop"
                  alt="Week 12 physique"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, 25vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <span className="absolute bottom-3 left-3 text-xs font-semibold text-white bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-lg">
                  Week 12
                </span>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">Results</p>
              <h2 className="font-display text-3xl sm:text-[2.5rem] font-bold text-text tracking-tight leading-tight">
                Real results,
                <br />
                <span className="text-muted">backed by data</span>
              </h2>
              <p className="text-base text-text2 mt-4 leading-relaxed max-w-[440px]">
                MuscleMap doesn&apos;t just show photos. It calculates muscle indices and
                tracks development with real metrics over time.
              </p>
              <div className="grid grid-cols-3 gap-3 mt-8">
                {[
                  { val: "+12%", label: "Shoulder" },
                  { val: "+8%",  label: "V-Taper" },
                  { val: "+15%", label: "Arms" },
                ].map((m) => (
                  <div key={m.label} className="rounded-xl border border-border p-3 text-center card-hover">
                    <p className="font-display text-2xl font-bold text-text">{m.val}</p>
                    <p className="text-[11px] text-muted mt-0.5">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Testimonial */}
        <section className="px-6 py-12 border-y border-border">
          <div className="max-w-[680px] mx-auto text-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="var(--border)" className="mx-auto mb-6">
              <path d="M11.3 2.5c-2.4 1.2-4.3 2.7-5.7 4.5S3.5 10.8 3.5 13c0 1.9.6 3.4 1.7 4.5 1.2 1.2 2.6 1.7 4.3 1.7 1.4 0 2.6-.5 3.5-1.4.9-1 1.4-2.1 1.4-3.4 0-1.3-.4-2.3-1.3-3.2-.8-.8-1.9-1.2-3.2-1.2-.4 0-.9.1-1.4.2.5-1.5 1.4-2.9 2.5-4.1l-2.2-1.3-.5-.3zm9.6 0c-2.4 1.2-4.3 2.7-5.7 4.5-1.4 1.8-2.1 3.8-2.1 6 0 1.9.6 3.4 1.7 4.5 1.2 1.2 2.6 1.7 4.3 1.7 1.4 0 2.6-.5 3.5-1.4.9-1 1.4-2.1 1.4-3.4 0-1.3-.4-2.3-1.3-3.2-.8-.8-1.9-1.2-3.2-1.2-.4 0-.9.1-1.4.2.5-1.5 1.4-2.9 2.5-4.1l-2.2-1.3-.5-.3z" />
            </svg>
            <p className="text-lg sm:text-xl text-text leading-relaxed font-medium">
              I&apos;ve been tracking my physique for 3 months with MuscleMap. The data-driven
              approach completely changed how I think about progress. No more guessing.
            </p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <img
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face"
                alt=""
                className="w-10 h-10 rounded-full object-cover"
              />
              <div className="text-left">
                <p className="text-sm font-semibold text-text">Marcus T.</p>
                <p className="text-xs text-muted">Natural Bodybuilder</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 py-8 max-w-[1100px] mx-auto">
          <div className="relative rounded-3xl overflow-hidden">
            <Image
              src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80&fit=crop"
              alt="Gym"
              fill
              className="object-cover"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-black/75" />
            <div className="relative z-10 text-center py-16 px-6">
              <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight">
                Start your transformation
              </h2>
              <p className="text-base text-white/50 mt-3 mb-7 max-w-[400px] mx-auto">
                Free to use. No account required. Your data stays on your device.
              </p>
              <Link
                href="/app/scan"
                className="inline-flex items-center gap-2 px-10 py-4 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors shadow-xl"
              >
                Open MuscleMap
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-6 py-6 text-center">
          <p className="text-xs text-muted">
            &copy; {new Date().getFullYear()} MuscleMap. Built for physique tracking.
          </p>
        </footer>
      </div>
    </ThemeProvider>
  );
}
