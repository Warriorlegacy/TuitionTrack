import Link from "next/link";
import { requireAuthContext } from "@/lib/auth";
import { getChapterNote } from "@/lib/learn/chapter-notes";
import { ChapterNoteView } from "@/components/learn/chapter-note-view";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ChapterNotePage({
  params,
}: {
  params: { slug: string };
}) {
  await requireAuthContext();

  const note = getChapterNote(params.slug);

  if (!note) {
    return (
      <div className="max-w-md mx-auto my-16 text-center space-y-4 p-8 bg-white rounded-3xl border border-slate-200">
        <h2 className="text-xl font-bold text-slate-900">Notes Not Found</h2>
        <p className="text-sm text-slate-600">
          The requested chapter revision note could not be found or does not exist.
        </p>
        <div className="pt-2">
          <Link href="/app/videos">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeftIcon className="size-4" />
              <span>Back to Learning Videos</span>
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="container py-6 px-4">
      <ChapterNoteView note={note} />
    </main>
  );
}
