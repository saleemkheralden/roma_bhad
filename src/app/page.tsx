import { strings } from "@/lib/strings";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-3xl font-bold">{strings.home.title}</h1>
      <p className="text-lg opacity-80">{strings.home.subtitle}</p>
      <span className="rounded-full border px-3 py-1 text-sm opacity-60">
        {strings.home.comingSoon}
      </span>
    </main>
  );
}
