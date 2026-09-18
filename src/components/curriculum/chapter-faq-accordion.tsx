"use client";

import { useState } from "react";
import type { ChapterFAQItem, FAQCategory } from "@/lib/curriculum/chapter-knowledge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  HelpCircleIcon,
  SearchIcon,
  CheckCircle2Icon,
  BookOpenIcon,
  SparklesIcon,
  PrinterIcon,
} from "lucide-react";

const CATEGORIES: ("All" | FAQCategory)[] = [
  "All",
  "Basics",
  "Conceptual",
  "Formula",
  "Examples",
  "Exam",
  "Common Mistakes",
  "Application",
];

export function ChapterFAQAccordion({
  faqs,
  chapterTitle,
}: {
  faqs: ChapterFAQItem[];
  chapterTitle: string;
}) {
  const [selectedCat, setSelectedCat] = useState<"All" | FAQCategory>("All");
  const [search, setSearch] = useState("");
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({
    [faqs[0]?.id || ""]: true,
  });

  const toggleOpen = (id: string) => {
    setOpenIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredFaqs = faqs.filter((faq) => {
    if (selectedCat !== "All" && faq.category !== selectedCat) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        faq.question.toLowerCase().includes(q) ||
        faq.answer.toLowerCase().includes(q) ||
        faq.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Search & Categories */}
      <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search in "${chapterTitle}" FAQs...`}
              className="pl-9 text-sm"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="gap-1.5"
          >
            <PrinterIcon className="h-4 w-4" />
            Print FAQs
          </Button>
        </div>

        {/* Category Pill Filters */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                selectedCat === cat
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* FAQ Items */}
      <div className="space-y-3">
        {filteredFaqs.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No FAQs found matching your criteria.
          </div>
        ) : (
          filteredFaqs.map((faq) => {
            const isOpen = !!openIds[faq.id];
            return (
              <div
                key={faq.id}
                className="overflow-hidden rounded-xl border bg-card transition hover:border-primary/30"
              >
                <button
                  type="button"
                  onClick={() => toggleOpen(faq.id)}
                  className="flex w-full items-start justify-between gap-4 p-4 text-left font-medium transition hover:bg-muted/40"
                >
                  <div className="flex items-start gap-3">
                    <HelpCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <span className="text-sm font-semibold text-foreground">{faq.question}</span>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {faq.category}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <CheckCircle2Icon className="h-3 w-3 text-emerald-600" />
                          Source Verified
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{isOpen ? "Hide" : "Expand"}</span>
                </button>

                {isOpen && (
                  <div className="border-t bg-muted/20 px-5 py-4 text-sm text-muted-foreground">
                    <p className="whitespace-pre-line text-foreground leading-relaxed">{faq.answer}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <BookOpenIcon className="h-3.5 w-3.5 text-primary" />
                        <span className="font-medium text-foreground">Authoritative Reference:</span>{" "}
                        {faq.sourceReference}
                      </span>
                      <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                        <SparklesIcon className="h-3 w-3" />
                        {Math.round(faq.confidence * 100)}% Confidence
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
