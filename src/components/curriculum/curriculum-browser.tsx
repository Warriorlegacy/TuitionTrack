"use client";

import { useState } from "react";
import Link from "next/link";
import type { OfficialChapter, NCERTTextbook } from "@/lib/curriculum/official-registry";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  BookOpenIcon,
  SearchIcon,
  SparklesIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  GraduationCapIcon,
  FileCheck2Icon,
} from "lucide-react";

export function CurriculumBrowser({
  allChapters,
  allTextbooks,
  canManage,
}: {
  allChapters: OfficialChapter[];
  allTextbooks: NCERTTextbook[];
  canManage: boolean;
}) {
  const [selectedClass, setSelectedClass] = useState<number>(10);
  const [selectedSubject, setSelectedSubject] = useState<string>("All");
  const [search, setSearch] = useState("");

  const availableClasses = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  // Filter subjects for the selected class
  const classChapters = allChapters.filter((c) => c.classLevel === selectedClass);
  const classSubjects = Array.from(new Set(classChapters.map((c) => c.subject)));

  // Filter textbooks for the selected class
  const classTextbooks = allTextbooks.filter((b) => b.classLevel === selectedClass);

  // Filter chapters by subject and search query
  const filteredChapters = classChapters.filter((c) => {
    if (selectedSubject !== "All" && c.subject !== selectedSubject) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        c.title.toLowerCase().includes(q) ||
        c.keyTopics.some((t) => t.toLowerCase().includes(q)) ||
        c.bookTitle.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Class Level Selector Bar */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4 pb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <GraduationCapIcon className="h-4 w-4 text-primary" />
            Select Academic Standard (CBSE & NCERT)
          </span>
          <Badge variant="outline" className="text-xs border-primary/30 text-primary">
            Academic Year 2026-27
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableClasses.map((cls) => (
            <button
              key={cls}
              onClick={() => {
                setSelectedClass(cls);
                setSelectedSubject("All");
              }}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                selectedClass === cls
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              Class {cls}
            </button>
          ))}
        </div>
      </div>

      {/* Class Textbooks Showcase */}
      {classTextbooks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BookOpenIcon className="h-4 w-4 text-primary" />
            Prescribed NCERT Textbooks (Class {selectedClass})
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {classTextbooks.map((tb) => (
              <Card key={tb.bookCode} className="border transition hover:border-primary/40">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <Badge variant="outline" className="text-[10px] uppercase font-mono">
                      {tb.bookCode}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">{tb.language}</span>
                  </div>
                  <h4 className="font-semibold text-sm text-foreground line-clamp-1">{tb.title}</h4>
                  <p className="text-xs text-muted-foreground">{tb.subject}</p>
                  <a
                    href={tb.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline pt-1"
                  >
                    Read Online (ncert.nic.in)
                    <ExternalLinkIcon className="h-3 w-3" />
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Subject Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedSubject("All")}
            className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
              selectedSubject === "All"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            All Subjects ({classChapters.length})
          </button>
          {classSubjects.map((sub) => (
            <button
              key={sub}
              onClick={() => setSelectedSubject(sub)}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                selectedSubject === sub
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {sub}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
          <SearchIcon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chapters or topics..."
            className="pl-8 text-xs h-8"
          />
        </div>
      </div>

      {/* Chapters Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing <strong className="text-foreground">{filteredChapters.length}</strong> official chapters for Class {selectedClass}
          </span>
          <span className="flex items-center gap-1">
            <FileCheck2Icon className="h-3.5 w-3.5 text-emerald-600" />
            Rationalized CBSE 2026-27 Aligned
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filteredChapters.map((ch) => (
            <Card
              key={ch.slug}
              className="flex flex-col justify-between border transition hover:border-primary/40 hover:shadow-md"
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    Chapter {ch.chapterNumber}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {ch.subject}
                  </Badge>
                </div>

                <div>
                  <h4 className="font-semibold text-sm text-foreground line-clamp-1">
                    {ch.title}
                  </h4>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                    {ch.bookTitle} ({ch.bookCode})
                  </p>
                </div>

                {/* Topics preview */}
                <div className="flex flex-wrap gap-1">
                  {ch.keyTopics.slice(0, 2).map((t, idx) => (
                    <span
                      key={idx}
                      className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground line-clamp-1"
                    >
                      {t}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t pt-3">
                  <Link
                    href={`/app/curriculum/${ch.slug}`}
                    className={buttonVariants({ variant: "ghost", size: "sm", className: "h-7 text-xs px-2 gap-1" })}
                  >
                    Explore Knowledge
                    <ChevronRightIcon className="h-3 w-3" />
                  </Link>

                  {canManage && (
                    <Link
                      href={`/app/homework/studio?class=${ch.classLevel}&subject=${encodeURIComponent(
                        ch.subject
                      )}&chapter=${ch.chapterNumber}`}
                      className={buttonVariants({ size: "sm", className: "h-7 text-xs px-2 gap-1" })}
                    >
                      <SparklesIcon className="h-3 w-3" />
                      Assign
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
