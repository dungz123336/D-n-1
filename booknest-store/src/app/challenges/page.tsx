"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Award, Flame, Target, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const BADGES = [
  { at: 3, name: "First Steps", emoji: "🌱" },
  { at: 12, name: "Steady Reader", emoji: "📖" },
  { at: 24, name: "Book Marathon", emoji: "🏃" },
  { at: 50, name: "Challenge Champion", emoji: "🏆" },
];

export default function ChallengesPage() {
  const year = new Date().getFullYear();
  const [goal, setGoal] = useState(12);
  const [done, setDone] = useState(0);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("bn-challenge") || "{}");
      if (s.goal) setGoal(s.goal);
      if (s.done) setDone(s.done);
      if (s.streak) setStreak(s.streak);
    } catch {
      /* */
    }
  }, []);

  const save = (g: number, d: number, st = streak) => {
    setGoal(g);
    setDone(d);
    setStreak(st);
    localStorage.setItem("bn-challenge", JSON.stringify({ goal: g, done: d, streak: st, year }));
  };

  const pct = Math.min(100, Math.round((done / Math.max(goal, 1)) * 100));
  const unlocked = BADGES.filter((b) => done >= b.at);
  const nextBadge = BADGES.find((b) => done < b.at);

  const monthlyPace = useMemo(() => {
    const month = new Date().getMonth() + 1;
    const expected = Math.round((goal * month) / 12);
    return { expected, ahead: done - expected };
  }, [done, goal]);

  return (
    <div className="py-10">
      <p className="section-kicker">Reading Challenge</p>
      <h1 className="section-title mt-2 text-4xl">Thử thách đọc {year}</h1>
      <p className="mt-2 max-w-xl text-text-secondary">
        Chọn mục tiêu 12 / 24 / 50 cuốn · mở khóa badge · theo dõi streak & pace theo tháng.
      </p>

      <div className="mt-8 flex flex-wrap gap-2">
        {[12, 24, 50].map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => save(g, done)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-bold transition",
              goal === g
                ? "border-primary bg-primary/20 text-primary"
                : "border-white/10 text-muted hover:border-primary/30"
            )}
          >
            {g} books
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-[24px] p-6">
          <div className="flex items-center gap-3">
            <Target className="h-6 w-6 text-primary" />
            <p className="font-bold text-white">
              {done} / {goal} completed
            </p>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-highlight transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-muted">
            {pct}% · pace tháng này: kỳ vọng {monthlyPace.expected} · bạn{" "}
            {monthlyPace.ahead >= 0 ? `+${monthlyPace.ahead} vượt` : `${monthlyPace.ahead} chậm`}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary px-4 py-2 text-sm"
              onClick={() => save(goal, Math.min(goal, done + 1), streak + 1)}
            >
              +1 finished
            </button>
            <button type="button" className="btn-secondary px-4 py-2 text-sm" onClick={() => save(goal, Math.max(0, done - 1))}>
              −1
            </button>
            <button type="button" className="btn-secondary px-4 py-2 text-sm" onClick={() => save(goal, 0, 0)}>
              Reset
            </button>
          </div>
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-text-secondary">
            <Flame className="h-4 w-4 text-highlight" /> Streak: <strong className="text-white">{streak}</strong>{" "}
            sessions
          </p>
          {done >= goal && (
            <p className="mt-4 flex items-center gap-2 text-primary">
              <Trophy className="h-5 w-5" /> Goal {year} unlocked — Challenge Champion
            </p>
          )}
        </div>

        <div className="glass rounded-[24px] p-6">
          <p className="flex items-center gap-2 font-bold text-white">
            <Award className="h-5 w-5 text-primary" /> Badges & rewards
          </p>
          <ul className="mt-4 space-y-3">
            {BADGES.map((b) => {
              const ok = done >= b.at;
              return (
                <li
                  key={b.name}
                  className={cn(
                    "flex items-center justify-between rounded-2xl border px-3 py-2 text-sm",
                    ok ? "border-primary/40 bg-primary/15 text-white" : "border-white/10 text-muted"
                  )}
                >
                  <span>
                    {b.emoji} {b.name}
                  </span>
                  <span className="text-xs">{ok ? "Unlocked" : `${b.at} books`}</span>
                </li>
              );
            })}
          </ul>
          {nextBadge && (
            <p className="mt-4 text-xs text-muted">
              Còn {nextBadge.at - done} cuốn nữa để mở “{nextBadge.name}”.
            </p>
          )}
          {unlocked.length > 0 && (
            <p className="mt-2 text-xs text-primary">Demo reward: voucher đọc thêm 5% khi đạt 12+.</p>
          )}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/bookshelf" className="btn-secondary px-5 py-2.5 text-sm">
          AI Bookshelf
        </Link>
        <Link href="/search" className="btn-primary px-5 py-2.5 text-sm">
          Tìm sách tiếp theo
        </Link>
      </div>
    </div>
  );
}
