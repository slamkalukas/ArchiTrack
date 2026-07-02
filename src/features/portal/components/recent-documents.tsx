import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FileText, Image as ImageIcon, File as FileIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import type { PortalDocument } from "@/features/portal/types";

interface RecentDocumentsProps {
  documents: PortalDocument[];
}

function IconFor({ kind }: { kind: PortalDocument["kind"] }) {
  if (kind === "pdf") return <FileText className="size-4" />;
  if (kind === "image") return <ImageIcon className="size-4" />;
  return <FileIcon className="size-4" />;
}

/** "Najnovšie dokumenty" — 5 latest client-visible files with type icons (spec/06-ui-ux.md §3.6 step 4). */
export async function RecentDocuments({ documents }: RecentDocumentsProps) {
  const t = await getTranslations("portal.home");

  if (documents.length === 0) {
    return <EmptyState title={t("noDocumentsTitle")} description={t("noDocumentsDescription")} className="py-10" />;
  }

  return (
    <ul className="flex flex-col gap-1">
      {documents.map((doc) => (
        <li key={doc.id}>
          <Link
            href="/portal/documents"
            className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors duration-150 hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="text-muted-foreground">
              <IconFor kind={doc.kind} />
            </span>
            <span className="min-w-0 flex-1 truncate text-foreground">{doc.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {new Date(doc.updatedAt).toLocaleDateString()}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
