import { KeyRoundIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function SetupAlert() {
  return (
    <Card className="border-amber-200 bg-amber-50 shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-900">
          <KeyRoundIcon className="size-5" />
          Supabase configuration required
        </CardTitle>
        <CardDescription className="text-amber-800">
          Add your Supabase project URL and anon key before using the live TuitionTrack portal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-amber-800">
        <p>`NEXT_PUBLIC_SUPABASE_URL`</p>
        <p>`NEXT_PUBLIC_SUPABASE_ANON_KEY`</p>
      </CardContent>
    </Card>
  );
}
