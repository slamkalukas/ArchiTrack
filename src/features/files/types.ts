import type { Visibility } from "@prisma/client";

/** Client-side shapes matching the JSON returned by the files/folders API routes. */

export interface ApiFileVersion {
  version: number;
  size: number;
  mimeType: string;
  createdAt: string;
}

export interface ApiFile {
  id: string;
  name: string;
  visibility: Visibility;
  validUntil: string | null;
  createdAt: string;
  latestVersion: ApiFileVersion | null;
  commentCount: number;
}

export interface ApiFolderNode {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
  systemKey: string | null;
  visibility: Visibility;
  children: ApiFolderNode[];
  files: ApiFile[];
}

export interface FolderTreeResponse {
  folders: ApiFolderNode[];
  rootFiles: ApiFile[];
}

export interface FileDetailVersion {
  id: string;
  version: number;
  size: number;
  mimeType: string;
  createdAt: string;
  uploadedBy: string;
}

export interface FileDetail {
  id: string;
  projectId: string;
  folderId: string | null;
  name: string;
  visibility: Visibility;
  validUntil: string | null;
  createdAt: string;
  versions: FileDetailVersion[];
  commentCount: number;
}
