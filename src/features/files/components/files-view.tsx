"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Download, FolderPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FolderTree } from "@/components/shared/folder-tree";
import { FileTable } from "@/components/shared/file-table";
import { PreviewDrawer } from "@/components/shared/preview-drawer";
import { EmptyState } from "@/components/shared/empty-state";
import type { FileEntry, FolderNode, Visibility as SharedVisibility } from "@/components/shared/types";
import { UploadDropzone } from "@/features/files/components/upload-dropzone";
import { FilePreview } from "@/features/files/components/file-preview";
import { kindFromMime, formatFileSize } from "@/features/files/format";
import type { ApiFolderNode, ApiFile, FolderTreeResponse, FileDetail } from "@/features/files/types";

interface FilesViewProps {
  projectId: string;
  role: "ADMIN" | "CLIENT";
}

const VIRTUALIZE_THRESHOLD = 200;

function toFolderNode(node: ApiFolderNode): FolderNode {
  return {
    id: node.id,
    name: node.name,
    children: node.children.length > 0 ? node.children.map(toFolderNode) : undefined,
  };
}

function toFileEntry(file: ApiFile): FileEntry {
  return {
    id: file.id,
    name: file.name,
    version: file.latestVersion?.version ?? 1,
    sizeLabel: file.latestVersion ? formatFileSize(file.latestVersion.size) : "—",
    updatedAt: new Date(file.latestVersion?.createdAt ?? file.createdAt).toLocaleDateString(),
    visibility: file.visibility,
    validUntil: file.validUntil,
    commentCount: file.commentCount,
    kind: kindFromMime(file.latestVersion?.mimeType),
  };
}

function findFolder(nodes: ApiFolderNode[], id: string): ApiFolderNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findFolder(node.children, id);
    if (found) return found;
  }
  return null;
}

/**
 * Two-pane Files view (spec/06-ui-ux.md §3.4): folder tree left, file table right; drop
 * anywhere to upload into the open folder; preview drawer from the right with a comment
 * thread placeholder underneath (comments themselves are WP-6's `src/features/comments`).
 */
export function FilesView({ projectId, role }: FilesViewProps) {
  const t = useTranslations("files");
  const [tree, setTree] = useState<FolderTreeResponse | null>(null);
  const loading = tree === null;
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined);
  const [previewFile, setPreviewFile] = useState<FileDetail | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/folders`, { cache: "no-store" }).then(async (res) => {
      if (cancelled) return;
      if (!res.ok) {
        toast.error(t("errors.loadFailed"));
        setTree((prev) => prev ?? { folders: [], rootFiles: [] });
        return;
      }
      const data = (await res.json()) as FolderTreeResponse;
      if (!cancelled) setTree(data);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, t, refreshKey]);

  /** Triggers a re-fetch of the folder tree (bumps the effect's dependency). */
  const load = useCallback(() => setRefreshKey((n) => n + 1), []);

  const folderNodes = useMemo<FolderNode[]>(() => tree?.folders.map(toFolderNode) ?? [], [tree]);

  const currentFolder = useMemo(() => {
    if (!tree || !selectedFolderId) return null;
    return findFolder(tree.folders, selectedFolderId);
  }, [tree, selectedFolderId]);

  const filesInView: ApiFile[] = useMemo(() => {
    if (!tree) return [];
    if (!selectedFolderId) return tree.rootFiles;
    return currentFolder?.files ?? [];
  }, [tree, selectedFolderId, currentFolder]);

  const fileEntries = useMemo(() => filesInView.map(toFileEntry), [filesInView]);

  const isFromClientFolder = currentFolder?.systemKey === "from_client";
  const canUploadHere = role === "ADMIN" || isFromClientFolder;

  const handleFiles = useCallback(
    async (files: File[]) => {
      setUploading(true);
      try {
        const formData = new FormData();
        if (selectedFolderId) formData.set("folderId", selectedFolderId);
        for (const file of files) formData.append("files", file);

        const res = await fetch(`/api/projects/${projectId}/files`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          toast.error(body?.error?.message ?? t("errors.uploadFailed"));
          return;
        }

        const body = (await res.json()) as { uploaded: unknown[]; rejected: { fileName: string; reason: string }[] };
        if (body.rejected.length > 0) {
          for (const r of body.rejected) {
            toast.error(`${r.fileName}: ${r.reason}`);
          }
        }
        if (body.uploaded.length > 0) {
          toast.success(t("upload.success", { count: body.uploaded.length }));
        }
        load();
      } catch {
        toast.error(t("errors.uploadFailed"));
      } finally {
        setUploading(false);
      }
    },
    [projectId, selectedFolderId, load, t],
  );

  const handleCreateFolder = useCallback(async () => {
    const name = window.prompt(t("createFolder.prompt"));
    if (!name || !name.trim()) return;
    setCreatingFolder(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), parentId: selectedFolderId ?? null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? t("errors.createFolderFailed"));
        return;
      }
      toast.success(t("createFolder.success"));
      load();
    } finally {
      setCreatingFolder(false);
    }
  }, [projectId, selectedFolderId, load, t]);

  const handleToggleVisibility = useCallback(
    async (fileId: string, next: SharedVisibility) => {
      const res = await fetch(`/api/files/${fileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: next }),
      });
      if (!res.ok) {
        toast.error(t("errors.saveFailed"));
        return;
      }
      toast.success(t("visibilityUpdated"));
      load();
    },
    [load, t],
  );

  const handleSelectFile = useCallback(
    async (entry: FileEntry) => {
      const res = await fetch(`/api/files/${entry.id}`, { cache: "no-store" });
      if (!res.ok) {
        toast.error(t("errors.loadFailed"));
        return;
      }
      const data = (await res.json()) as { file: FileDetail };
      setPreviewFile(data.file);
      setPreviewOpen(true);
    },
    [t],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-lg text-foreground">{t("title")}</h2>
        <div className="flex items-center gap-2">
          {role === "ADMIN" && (
            <Button variant="outline" size="sm" onClick={handleCreateFolder} disabled={creatingFolder}>
              <FolderPlus className="size-4" />
              {t("createFolder.action")}
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/projects/${projectId}/files/zip`} download>
              <Download className="size-4" />
              {t("downloadAll")}
            </a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[240px_1fr]">
        <div className="rounded-xl border border-border p-2">
          <button
            type="button"
            onClick={() => setSelectedFolderId(undefined)}
            className={`mb-1 w-full rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors duration-150 ${
              !selectedFolderId ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60"
            }`}
          >
            {t("rootFolder")}
          </button>
          <FolderTree nodes={folderNodes} selectedId={selectedFolderId} onSelect={setSelectedFolderId} />
        </div>

        <div className="flex flex-col gap-4">
          {canUploadHere && (
            <UploadDropzone onFiles={handleFiles} disabled={uploading} />
          )}
          {!canUploadHere && (
            <p className="text-xs text-muted-foreground">{t("uploadRestricted")}</p>
          )}

          {fileEntries.length === 0 ? (
            <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
          ) : (
            <FileTable
              files={fileEntries}
              onSelect={handleSelectFile}
              onToggleVisibility={role === "ADMIN" ? handleToggleVisibility : undefined}
            />
          )}
          {fileEntries.length > VIRTUALIZE_THRESHOLD && (
            <p className="text-xs text-muted-foreground">{t("virtualizedNotice", { count: fileEntries.length })}</p>
          )}
        </div>
      </div>

      <PreviewDrawer
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={previewFile?.name ?? ""}
      >
        {previewFile && <FilePreview file={previewFile} />}
      </PreviewDrawer>
    </div>
  );
}
