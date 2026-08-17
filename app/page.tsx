'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  RiSparkling2Line,
  RiShirtLine,
  RiArrowRightLine,
} from '@remixicon/react';
import { ThemeToggle } from '@/components/theme-toggle';
import { StartLookButton } from '@/components/start-look-button';
import { AuthNav } from '@/components/auth-nav';

function HeroSlider() {
  const [split, setSplit] = useState(50);

  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-2xl border shadow-lg sm:aspect-[3/4]">
      {/* Skin side */}
      <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-br from-primary/25 via-primary/10 to-background p-6">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">
          <RiSparkling2Line className="size-3.5" />
          Skin
        </span>
        <div className="space-y-2">
          <div className="h-2 w-3/4 rounded-full bg-primary/20">
            <div className="h-2 w-[68%] rounded-full bg-primary" />
          </div>
          <div className="h-2 w-1/2 rounded-full bg-primary/20">
            <div className="h-2 w-[82%] rounded-full bg-primary" />
          </div>
          <p className="pt-2 text-xs text-muted-foreground">
            Redness down, texture even — ready by Friday.
          </p>
        </div>
      </div>

      {/* Outfit side, clipped by the slider */}
      <div
        className="absolute inset-0 flex flex-col justify-between bg-gradient-to-bl from-accent/25 via-accent/10 to-background p-6"
        style={{ clipPath: `inset(0 0 0 ${split}%)` }}
      >
        <span className="ml-auto inline-flex w-fit items-center gap-1.5 rounded-full bg-accent/20 px-2.5 py-1 text-xs font-medium text-accent-foreground">
          <RiShirtLine className="size-3.5" />
          Outfit
        </span>
        <div className="ml-auto space-y-2 text-right">
          <p className="text-xs text-muted-foreground">
            Navy blazer — complements your undertone
          </p>
          <div className="ml-auto h-24 w-16 rounded-lg bg-accent/30" />
        </div>
      </div>

      {/* Divider handle */}
      <div
        className="absolute inset-y-0 w-0.5 bg-foreground/40"
        style={{ left: `${split}%` }}
      />

      <input
        type="range"
        min={0}
        max={100}
        value={split}
        onChange={(e) => setSplit(Number(e.target.value))}
        aria-label="Compare skin analysis and outfit try-on"
        className="absolute inset-x-0 bottom-3 mx-6 h-1 w-[calc(100%-3rem)] cursor-ew-resize appearance-none rounded-full bg-foreground/20 accent-foreground"
      />
    </div>
  );
}

const STEPS = [
  {
    n: '01',
    title: 'Tell Mirror the occasion',
    body: '"Job interview Friday." Mirror reads the formality and the timeframe.',
  },
  {
    n: '02',
    title: 'Skin and outfit, analyzed together',
    body: 'One skin scan, one set of outfit matches — picked to complement each other, not generated separately.',
  },
  {
    n: '03',
    title: 'Get a plan, not a report',
    body: 'A short-term skin routine and a chosen outfit, timed to when you actually need them.',
  },
];

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="flex items-center gap-2 font-serif text-lg">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <RiSparkling2Line className="size-4" />
          </span>
          Mirror
        </span>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <AuthNav />
          <StartLookButton>Start a look</StartLookButton>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 sm:py-24 lg:grid-cols-2">
          <div className="space-y-6">
            <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
              Know your skin.
              <br />
              Know your look.
            </h1>
            <p className="max-w-md text-lg text-muted-foreground">
              Mirror reads the occasion, then brings your skin and your outfit into one plan — not two separate reports.
            </p>
            <div className="flex items-center gap-3">
              <StartLookButton size="lg">
                Start a look
                <RiArrowRightLine className="size-4" />
              </StartLookButton>
            </div>
          </div>
          <HeroSlider />
        </section>

        <section className="border-t bg-muted/40 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="mb-10 font-serif text-2xl sm:text-3xl">
              How Mirror gets there
            </h2>
            <div className="grid gap-8 sm:grid-cols-3">
              {STEPS.map((step) => (
                <div key={step.n} className="space-y-2">
                  <span className="font-serif text-sm text-muted-foreground">
                    {step.n}
                  </span>
                  <h3 className="text-lg font-medium">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border bg-primary/5 p-8">
              <RiSparkling2Line className="mb-4 size-6 text-primary" />
              <h3 className="mb-2 font-serif text-xl">Skin AI</h3>
              <p className="text-sm text-muted-foreground">
                A single selfie, scored on what actually matters for your timeframe — not a 12-week plan when you need results by Friday.
              </p>
            </div>
            <div className="rounded-2xl border bg-accent/5 p-8">
              <RiShirtLine className="mb-4 size-6 text-accent-foreground" />
              <h3 className="mb-2 font-serif text-xl">Apparel try-on</h3>
              <p className="text-sm text-muted-foreground">
                See the outfit on you, not on a model — matched to the occasion and to what your skin scan says about your tone.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t px-6 py-8 text-center text-sm text-muted-foreground">
        Built with the YouCam API. Photos are processed for your session and not shared.
      </footer>
    </div>
  );
}