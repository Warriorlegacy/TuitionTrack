"use client";

import { useState } from "react";
import type { ChapterMindMap, MindMapNode } from "@/lib/curriculum/chapter-knowledge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  BookOpenIcon,
  BrainCircuitIcon,
  AlertTriangleIcon,
  AwardIcon,
  SigmaIcon,
  PrinterIcon,
  SparklesIcon,
  ChevronRightIcon,
} from "lucide-react";

export function InteractiveMindMap({ mindMap }: { mindMap: ChapterMindMap }) {
  const [selectedNode, setSelectedNode] = useState<MindMapNode>(mindMap.centralNode);

  const getCategoryMeta = (cat: MindMapNode["category"]) => {
    switch (cat) {
      case "core":
        return {
          icon: BrainCircuitIcon,
          color: "bg-indigo-500/10 text-indigo-700 border-indigo-200 dark:border-indigo-800 dark:text-indigo-300",
          border: "border-indigo-500",
          label: "Core Theme",
        };
      case "concept":
        return {
          icon: BookOpenIcon,
          color: "bg-sky-500/10 text-sky-700 border-sky-200 dark:border-sky-800 dark:text-sky-300",
          border: "border-sky-500",
          label: "Key Concept",
        };
      case "formula":
        return {
          icon: SigmaIcon,
          color: "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:border-emerald-800 dark:text-emerald-300",
          border: "border-emerald-500",
          label: "Formula / Rule",
        };
      case "trap":
        return {
          icon: AlertTriangleIcon,
          color: "bg-rose-500/10 text-rose-700 border-rose-200 dark:border-rose-800 dark:text-rose-300",
          border: "border-rose-500",
          label: "Common Pitfall",
        };
      case "exam":
        return {
          icon: AwardIcon,
          color: "bg-amber-500/10 text-amber-700 border-amber-200 dark:border-amber-800 dark:text-amber-300",
          border: "border-amber-500",
          label: "CBSE Exam Focus",
        };
    }
  };

  const branches = mindMap.nodes.filter((n) =>
    mindMap.centralNode.children?.includes(n.id)
  );

  return (
    <div className="space-y-6">
      {/* Mind Map Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4 shadow-sm print:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
            <BrainCircuitIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Interactive Concept Mind Map</h3>
            <p className="text-xs text-muted-foreground">
              Click any node to explore key formulas, prerequisites, exam patterns, and common traps.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.print()}
          className="gap-1.5"
        >
          <PrinterIcon className="h-4 w-4" />
          Print / Export A4
        </Button>
      </div>

      {/* Visual Mind Map Graph View */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Graph Layout (Left 2 cols) */}
        <div className="space-y-4 lg:col-span-2">
          {/* Central Root Node */}
          <div
            onClick={() => setSelectedNode(mindMap.centralNode)}
            className={`cursor-pointer rounded-2xl border-2 bg-gradient-to-br from-indigo-500/10 via-card to-background p-5 shadow-md transition hover:scale-[1.01] ${
              selectedNode.id === mindMap.centralNode.id
                ? "border-indigo-600 ring-2 ring-indigo-500/20"
                : "border-border"
            }`}
          >
            <div className="flex items-center justify-between">
              <Badge className="bg-indigo-600 text-white hover:bg-indigo-700">Central Focus</Badge>
              <span className="text-xs text-muted-foreground">Click to inspect</span>
            </div>
            <h4 className="mt-2 text-xl font-bold text-foreground">{mindMap.centralNode.label}</h4>
            <p className="mt-1 text-sm text-muted-foreground">{mindMap.centralNode.description}</p>
          </div>

          {/* Branches Grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {branches.map((branch) => {
              const meta = getCategoryMeta(branch.category);
              const Icon = meta.icon;
              const isSelected = selectedNode.id === branch.id;
              const subNodes = mindMap.nodes.filter((n) => branch.children?.includes(n.id));

              return (
                <div
                  key={branch.id}
                  onClick={() => setSelectedNode(branch)}
                  className={`flex flex-col justify-between cursor-pointer rounded-xl border p-4 transition hover:shadow-md ${
                    isSelected
                      ? `border-l-4 ${meta.border} bg-accent/40 ring-1 ring-primary/20`
                      : "bg-card hover:border-foreground/20"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${meta.color}`}>
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </span>
                      <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <h5 className="mt-2 text-sm font-semibold text-foreground">{branch.label}</h5>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{branch.description}</p>
                  </div>

                  {subNodes.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1 border-t pt-2">
                      {subNodes.map((child) => (
                        <button
                          key={child.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedNode(child);
                          }}
                          className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition ${
                            selectedNode.id === child.id
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {child.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Node Details Panel (Right col) */}
        <div className="space-y-4">
          <Card className="border shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between border-b pb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Node Inspector
                </span>
                <Badge variant="outline">{getCategoryMeta(selectedNode.category).label}</Badge>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <h4 className="text-lg font-bold text-foreground">{selectedNode.label}</h4>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {selectedNode.description}
                  </p>
                </div>

                {selectedNode.formula && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                      Governing Formula:
                    </span>
                    <p className="mt-1 font-mono font-medium text-foreground">{selectedNode.formula}</p>
                  </div>
                )}

                {selectedNode.commonMistake && (
                  <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-xs">
                    <span className="font-semibold text-rose-700 dark:text-rose-300">
                      Common Misconception:
                    </span>
                    <p className="mt-1 text-foreground">{selectedNode.commonMistake}</p>
                  </div>
                )}

                {selectedNode.examWeight && (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs">
                    <span className="font-semibold text-amber-700 dark:text-amber-300">
                      Exam Weightage:
                    </span>
                    <p className="mt-1 text-foreground">{selectedNode.examWeight}</p>
                  </div>
                )}

                <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <SparklesIcon className="h-3.5 w-3.5 text-primary" />
                    AI Teaching Tip
                  </div>
                  <p className="mt-1">
                    When teaching or revising this node, ask students to contrast it with prerequisites before testing numerical variants.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
