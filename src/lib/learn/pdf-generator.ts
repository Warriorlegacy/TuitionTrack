"use client";

// High-fidelity client-side PDF generator using jsPDF
// Formats Chapter Revision Notes into crisp, multi-page, study-optimized PDFs.
import { jsPDF } from "jspdf";
import type { ChapterNote } from "./chapter-notes";

export function generateChapterPdf(note: ChapterNote) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Helper: check page bounds and auto-page-break
  function ensureSpace(heightNeeded: number) {
    if (y + heightNeeded > pageHeight - 16) {
      doc.addPage();
      y = margin + 10;
      drawRunningHeader();
    }
  }

  function drawRunningHeader() {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140, 150, 165);
    doc.text(`TuitionTrack Academic Notes · Class ${note.classLevel} ${note.subject} · Ch ${note.chapterNumber}: ${note.title.slice(0, 35)}`, margin, margin);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, margin + 2, pageWidth - margin, margin + 2);
  }

  // Helper: add text with auto-wrapping
  function addWrappedText(text: string, x: number, maxWidth: number, lineHeight: number = 4.5): number {
    const lines = doc.splitTextToSize(text, maxWidth);
    ensureSpace(lines.length * lineHeight);
    doc.text(lines, x, y);
    y += lines.length * lineHeight;
    return lines.length;
  }

  // --- Title Banner (Page 1) ---
  // Gradient/colored accent box
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(margin, y, contentWidth, 24, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text("TUITIONTRACK · OFFICIAL REVISION NOTES", margin + 5, y + 6);

  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(`Chapter ${note.chapterNumber}: ${note.title}`, margin + 5, y + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Class ${note.classLevel} · ${note.subject}  |  ${note.board}  |  ${note.syllabusTag}`, margin + 5, y + 20);

  y += 28;

  // --- Chapter Overview ---
  ensureSpace(20);
  doc.setFillColor(241, 245, 249); // Slate 100
  doc.rect(margin, y, contentWidth, 1.5, "F");
  y += 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Chapter Overview & Scope", margin, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  addWrappedText(note.overview, margin, contentWidth, 4.2);
  y += 3;

  // Learning Objectives
  if (note.learningObjectives?.length) {
    ensureSpace(18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text("Key Learning Outcomes:", margin, y);
    y += 4.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    for (const obj of note.learningObjectives) {
      ensureSpace(6);
      doc.text("•", margin + 2, y);
      addWrappedText(obj, margin + 6, contentWidth - 6, 4);
      y += 1;
    }
  }
  y += 4;

  // --- Section 1: Core Topics & Detailed Explanations ---
  ensureSpace(12);
  doc.setFillColor(79, 70, 229); // Indigo 600
  doc.rect(margin, y, 3, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("1. Core Conceptual Analysis", margin + 6, y + 4.5);
  y += 9;

  for (const topic of note.coreTopics) {
    ensureSpace(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text(topic.title, margin, y);
    y += 4.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    addWrappedText(topic.summary, margin, contentWidth, 4);
    y += 2;

    if (topic.keyPoints?.length) {
      for (const pt of topic.keyPoints) {
        ensureSpace(6);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(79, 70, 229);
        doc.text("→", margin + 2, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(51, 65, 85);
        addWrappedText(pt, margin + 6, contentWidth - 6, 4);
        y += 1;
      }
    }

    if (topic.exampleOrApplication) {
      ensureSpace(8);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, y, contentWidth, 7, 1, 1, "FD");
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Application: ${topic.exampleOrApplication}`, margin + 3, y + 4.5);
      y += 10;
    } else {
      y += 3;
    }
  }

  // --- Section 2: Formulas, Laws & Governing Rules ---
  if (note.formulasAndRules?.length) {
    ensureSpace(14);
    doc.setFillColor(16, 185, 129); // Emerald 500
    doc.rect(margin, y, 3, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("2. Key Formulas, Laws & Identity Rules", margin + 6, y + 4.5);
    y += 9;

    for (const item of note.formulasAndRules) {
      ensureSpace(18);
      doc.setFillColor(240, 253, 244); // Emerald 50
      doc.setDrawColor(187, 247, 208);
      doc.roundedRect(margin, y, contentWidth, 14, 1.5, 1.5, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(21, 128, 61); // Emerald 700
      doc.text(item.name, margin + 4, y + 4.5);

      doc.setFont("courier", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(item.expression, margin + 4, y + 9);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(item.description, margin + 4, y + 12.5);

      y += 17;
    }
  }

  // --- Section 3: Solved Board-Pattern Examples ---
  if (note.solvedExamples?.length) {
    ensureSpace(14);
    doc.setFillColor(234, 88, 12); // Orange 600
    doc.rect(margin, y, 3, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("3. Solved Step-by-Step Exam Examples", margin + 6, y + 4.5);
    y += 9;

    for (const ex of note.solvedExamples) {
      ensureSpace(24);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      addWrappedText(ex.question, margin, contentWidth, 4.2);
      y += 1.5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      for (const step of ex.stepByStepSolution) {
        ensureSpace(6);
        addWrappedText(step, margin + 4, contentWidth - 4, 3.8);
      }

      ensureSpace(8);
      doc.setFillColor(254, 243, 199); // Amber 100
      doc.setDrawColor(251, 191, 36);
      doc.roundedRect(margin + 4, y, contentWidth - 4, 6, 1, 1, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(180, 83, 9);
      doc.text(`Answer: ${ex.finalAnswer}`, margin + 6, y + 4.2);
      y += 9;
    }
  }

  // --- Section 4: Common Mistakes ("Watch Out") ---
  if (note.commonMistakes?.length) {
    ensureSpace(14);
    doc.setFillColor(225, 29, 72); // Rose 600
    doc.rect(margin, y, 3, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("4. Common Traps & Pitfalls (Where Marks Are Lost)", margin + 6, y + 4.5);
    y += 9;

    for (const cm of note.commonMistakes) {
      ensureSpace(20);
      doc.setFillColor(255, 241, 242); // Rose 50
      doc.setDrawColor(254, 205, 211);
      doc.roundedRect(margin, y, contentWidth, 16, 1.5, 1.5, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(190, 18, 60);
      doc.text(`⚠ Common Mistake: ${cm.mistake}`, margin + 3, y + 4.5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Why: ${cm.whyItHappens}`, margin + 3, y + 8.5);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 118, 110);
      doc.text(`Correct Approach: ${cm.correctMethod}`, margin + 3, y + 13);

      y += 19;
    }
  }

  // --- Section 5: High-Yield Exam Tips ---
  if (note.highYieldExamTips?.length) {
    ensureSpace(14);
    doc.setFillColor(14, 165, 233); // Sky 500
    doc.rect(margin, y, 3, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("5. High-Yield Exam Tips & Scoring Guidelines", margin + 6, y + 4.5);
    y += 9;

    for (const tip of note.highYieldExamTips) {
      ensureSpace(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(14, 165, 233);
      doc.text("★", margin + 2, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      addWrappedText(tip, margin + 6, contentWidth - 6, 4);
      y += 2;
    }
    y += 3;
  }

  // --- Section 6: Self-Assessment Practice Questions ---
  if (note.practiceQuestions?.length) {
    ensureSpace(14);
    doc.setFillColor(168, 85, 247); // Purple 500
    doc.rect(margin, y, 3, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("6. Self-Assessment Practice Questions", margin + 6, y + 4.5);
    y += 9;

    for (let i = 0; i < note.practiceQuestions.length; i++) {
      const q = note.practiceQuestions[i];
      ensureSpace(15);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(126, 34, 206);
      doc.text(`Q${i + 1} [${q.type}]`, margin, y);
      y += 4;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      addWrappedText(q.question, margin, contentWidth, 4);
      y += 1.5;

      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Hint/Guide: ${q.hintOrGuidance}`, margin + 3, y);
      y += 5;
    }
  }

  // --- Draw Footers on All Pages ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);

    doc.text("TuitionTrack Academic Suite · Comprehensive Revision Notes", margin, pageHeight - 7);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 15, pageHeight - 7);
  }

  // Sanitize filename for download
  const cleanTitle = note.title.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30);
  const fileName = `TuitionTrack_Class${note.classLevel}_${note.subject}_Ch${note.chapterNumber}_${cleanTitle}.pdf`;

  // Trigger browser download
  doc.save(fileName);
}
