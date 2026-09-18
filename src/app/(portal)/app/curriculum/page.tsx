import { requireAuthContext } from "@/lib/auth";
import {
  OFFICIAL_CHAPTERS,
  NCERT_TEXTBOOKS,
} from "@/lib/curriculum/official-registry";
import { CurriculumBrowser } from "@/components/curriculum/curriculum-browser";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { SparklesIcon, BookOpenIcon, ExternalLinkIcon } from "lucide-react";

export default async function CurriculumDirectoryPage() {
  const authContext = await requireAuthContext();

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="NCERT Curriculum & Syllabus"
          description="Authoritative CBSE & NCERT syllabus, official textbook links, learning objectives, mind maps, and FAQs across Classes 1 to 12."
        />
        {authContext.canManage && (
          <Link
            href="/app/homework/studio"
            className={buttonVariants({ className: "gap-1.5 shadow-md" })}
          >
            <SparklesIcon className="h-4 w-4" />
            AI Homework Studio
          </Link>
        )}
      </div>

      {/* Official Registry Authority Alert */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-primary">
        <div className="flex items-center gap-2">
          <BookOpenIcon className="h-4 w-4 shrink-0" />
          <span>
            <strong>Authoritative Source:</strong> CBSE Academic Unit (cbseacademic.nic.in) & NCERT (ncert.nic.in). Curriculum Year 2026-27.
          </span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://cbseacademic.nic.in"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-semibold underline hover:opacity-80"
          >
            CBSE Academic Portal
            <ExternalLinkIcon className="h-3 w-3" />
          </a>
          <a
            href="https://ncert.nic.in/textbook.php"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-semibold underline hover:opacity-80"
          >
            NCERT Portal
            <ExternalLinkIcon className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Interactive Browser */}
      <CurriculumBrowser
        allChapters={OFFICIAL_CHAPTERS}
        allTextbooks={NCERT_TEXTBOOKS}
        canManage={authContext.canManage}
      />
    </div>
  );
}
