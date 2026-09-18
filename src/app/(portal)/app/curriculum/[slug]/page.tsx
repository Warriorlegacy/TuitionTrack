import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuthContext } from "@/lib/auth";
import {
  getOfficialChapterBySlug,
  getOfficialSyllabus,
} from "@/lib/curriculum/official-registry";
import {
  getChapterFAQs,
  getChapterMindMap,
} from "@/lib/curriculum/chapter-knowledge";
import { ChapterFAQAccordion } from "@/components/curriculum/chapter-faq-accordion";
import { InteractiveMindMap } from "@/components/curriculum/interactive-mind-map";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpenIcon,
  ExternalLinkIcon,
  SparklesIcon,
  GraduationCapIcon,
  ChevronLeftIcon,
  CheckCircle2Icon,
  LayersIcon,
  FileTextIcon,
} from "lucide-react";

export default async function ChapterHubPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const authContext = await requireAuthContext();
  const { slug } = await params;
  const chapter = getOfficialChapterBySlug(slug);

  if (!chapter) {
    notFound();
  }

  const syllabus = getOfficialSyllabus(chapter.classLevel, chapter.subject);
  const faqs = getChapterFAQs(chapter);
  const mindMap = getChapterMindMap(chapter);

  return (
    <div className="space-y-6 pb-12">
      {/* Back to Curriculum & Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href="/app/curriculum"
          className="flex items-center gap-1 hover:text-foreground"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Curriculum & NCERT
        </Link>
        <span>/</span>
        <span>Class {chapter.classLevel}</span>
        <span>/</span>
        <span>{chapter.subject}</span>
        <span>/</span>
        <span className="font-medium text-foreground">Chapter {chapter.chapterNumber}</span>
      </div>

      {/* Chapter Hero Card */}
      <div className="rounded-2xl border bg-gradient-to-r from-primary/10 via-primary/5 to-background p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-primary text-primary-foreground">
                Class {chapter.classLevel} {chapter.subject}
              </Badge>
              <Badge variant="outline">Chapter {chapter.chapterNumber}</Badge>
              <Badge variant="secondary">{chapter.bookTitle} ({chapter.bookCode})</Badge>
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                CBSE & NCERT 2026-27 Authoritative
              </Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {chapter.title}
            </h1>
            <p className="max-w-3xl text-sm text-muted-foreground leading-relaxed">
              Official textbook curriculum node aligned with the latest CBSE rationalized syllabus. Includes certified learning competencies, source-grounded chapter FAQs, and interactive concept mind map.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {authContext.canManage && (
              <Link
                href={`/app/homework/studio?class=${chapter.classLevel}&subject=${encodeURIComponent(
                  chapter.subject
                )}&chapter=${chapter.chapterNumber}`}
                className={buttonVariants({ className: "gap-1.5 shadow-md" })}
              >
                <SparklesIcon className="h-4 w-4" />
                Generate AI Homework
              </Link>
            )}
            <a
              href={chapter.officialReaderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", className: "gap-1.5" })}
            >
              <BookOpenIcon className="h-4 w-4 text-primary" />
              Read on NCERT Portal
              <ExternalLinkIcon className="h-3 w-3 opacity-60" />
            </a>
          </div>
        </div>

        {/* Quick Metadata Pill Bar */}
        <div className="mt-6 flex flex-wrap items-center gap-4 border-t pt-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <GraduationCapIcon className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">Authority:</span> CBSE Academic Unit & NCERT
          </span>
          <span className="flex items-center gap-1.5">
            <FileTextIcon className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">Syllabus Doc:</span>{" "}
            <a
              href={syllabus?.cbseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/80"
            >
              CBSE Academic Year 2026-27
            </a>
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2Icon className="h-4 w-4 text-emerald-600" />
            <span className="font-semibold text-foreground">Status:</span> Active Curriculum Truth
          </span>
        </div>
      </div>

      {/* Main Tabs: Overview, FAQs, Mind Map */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[480px]">
          <TabsTrigger value="overview">Overview & Objectives</TabsTrigger>
          <TabsTrigger value="faqs">Chapter FAQs (7)</TabsTrigger>
          <TabsTrigger value="mindmap">Concept Mind Map</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Learning Objectives */}
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <h3 className="flex items-center gap-2 font-semibold text-foreground">
                <CheckCircle2Icon className="h-5 w-5 text-primary" />
                Prescribed Learning Objectives
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                CBSE competency mandates for Class {chapter.classLevel} examinations.
              </p>
              <ul className="mt-4 space-y-2.5">
                {chapter.learningObjectives.map((obj, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                      {i + 1}
                    </span>
                    <span className="pt-0.5 leading-relaxed">{obj}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Bloom Competency Framework */}
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <h3 className="flex items-center gap-2 font-semibold text-foreground">
                <LayersIcon className="h-5 w-5 text-indigo-600" />
                NEP Competencies & Bloom Taxonomy
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Target cognitive levels mapped to assessment blueprints.
              </p>
              <div className="mt-4 space-y-3">
                {chapter.competencies.map((comp) => (
                  <div
                    key={comp.code}
                    className="rounded-lg border bg-muted/20 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-primary">{comp.code}</span>
                      <Badge variant="outline" className="text-[10px]">
                        Bloom: {comp.bloomLevel}
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-muted-foreground leading-relaxed">
                      {comp.statement}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Key Topics & Prerequisites */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <h4 className="font-semibold text-foreground">Core Syllabus Topics</h4>
              <div className="mt-3 flex flex-wrap gap-2">
                {chapter.keyTopics.map((topic, i) => (
                  <span
                    key={i}
                    className="rounded-lg border bg-accent/30 px-3 py-1.5 text-xs font-medium text-foreground"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <h4 className="font-semibold text-foreground">Prerequisites & Baseline Knowledge</h4>
              <ul className="mt-3 space-y-2">
                {chapter.prerequisites.map((req, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </TabsContent>

        {/* FAQs Tab */}
        <TabsContent value="faqs" className="space-y-4">
          <ChapterFAQAccordion faqs={faqs} chapterTitle={chapter.title} />
        </TabsContent>

        {/* Mind Map Tab */}
        <TabsContent value="mindmap" className="space-y-4">
          <InteractiveMindMap mindMap={mindMap} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
