import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/admin");
  if (!(await isAdmin(supabase, user.id))) redirect("/?error=unauthorized");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/admin" className="font-logo text-primary">
            Localist Admin
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin" className="text-muted-foreground hover:text-foreground">
              Cities
            </Link>
            <Link href="/admin/onboard" className="text-muted-foreground hover:text-foreground">
              Add with AI
            </Link>
            <Link href="/admin/settings" className="text-muted-foreground hover:text-foreground">
              Settings
            </Link>
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              App
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
