"use client";

import { useEffect, useState } from "react";
import { AppleIcon, PlayCircleIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppDownloadBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const isDismissed = localStorage.getItem("app-banner-dismissed");
    if (!isDismissed) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("app-banner-dismissed", "true");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="sticky top-0 z-[100] flex w-full flex-col items-center justify-between gap-4 border-b border-primary/10 bg-primary/5 px-6 py-3 backdrop-blur-md md:flex-row md:py-2">
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <PlayCircleIcon className="size-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-950">
            TuitionTrack is now on mobile!
          </p>
          <p className="text-xs text-slate-500">
            Manage your tuition workspace from anywhere.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-lg px-3 text-xs"
          render={
            <a
              href="https://apps.apple.com/app/tuitiontrack"
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          <AppleIcon className="size-3.5" />
          iOS
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-lg px-3 text-xs"
          render={
            <a
              href="https://play.google.com/store/apps/details?id=com.tuitiontrack.app"
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          <PlayCircleIcon className="size-3.5" />
          Android
        </Button>
        <button
          onClick={handleDismiss}
          className="ml-2 rounded-full p-1 text-slate-400 hover:bg-slate-200/50 hover:text-slate-600 transition-colors"
          aria-label="Dismiss banner"
        >
          <XIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}
