import { LocaleSwitcher } from "@/components/shared/locale-switcher";

/**
 * Split-screen auth shell — spec/06-ui-ux.md §3.1: left brand panel with large serif
 * wordmark and a duotone architectural motif, right minimal form. Locale switch
 * top-right, visible on every auth screen (login, invite, forgot/reset password).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[var(--ink)] p-10 text-[var(--surface)] lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            backgroundImage:
              "linear-gradient(160deg, rgba(47,93,80,0.55), rgba(26,26,26,0.92)), repeating-linear-gradient(45deg, rgba(250,250,248,0.05) 0px, rgba(250,250,248,0.05) 1px, transparent 1px, transparent 28px)",
          }}
          aria-hidden
        />
        <div className="relative z-10 font-serif text-2xl tracking-tight">ArchiTrack</div>
        <div className="relative z-10 max-w-sm">
          <p className="font-serif text-4xl leading-tight">
            Rodinný dom.
            <br />
            Presne podľa plánu.
          </p>
          <p className="mt-4 text-sm text-[var(--surface)]/70">
            Sledujte priebeh vášho projektu, dokumenty a komunikáciu s architektom na jednom mieste.
          </p>
        </div>
      </div>
      <div className="flex flex-col">
        <div className="flex justify-end p-4">
          <LocaleSwitcher />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-16">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}
