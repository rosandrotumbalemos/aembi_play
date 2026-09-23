import { AppNavbar } from "@/components/app-navbar";

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-col">
      <AppNavbar />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-6">{children}</main>
    </div>
  );
}
