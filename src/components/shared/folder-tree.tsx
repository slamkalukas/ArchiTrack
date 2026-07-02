"use client";

import { useState } from "react";
import { ChevronRight, Folder, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FolderNode } from "@/components/shared/types";

interface FolderTreeProps {
  nodes: FolderNode[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  className?: string;
}

/** Two-pane Files view — left pane: folder tree. */
export function FolderTree({ nodes, selectedId, onSelect, className }: FolderTreeProps) {
  return (
    <div role="tree" className={cn("flex flex-col gap-0.5", className)}>
      {nodes.map((node) => (
        <FolderTreeItem
          key={node.id}
          node={node}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function FolderTreeItem({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: FolderNode;
  depth: number;
  selectedId?: string;
  onSelect?: (id: string) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = !!node.children?.length;
  const selected = node.id === selectedId;

  return (
    <div role="treeitem" aria-expanded={hasChildren ? open : undefined} aria-selected={selected}>
      <button
        type="button"
        onClick={() => {
          onSelect?.(node.id);
          if (hasChildren) setOpen((v) => !v);
        }}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-sm transition-colors duration-150",
          selected
            ? "bg-secondary text-foreground font-medium"
            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
        )}
      >
        {hasChildren ? (
          <ChevronRight
            className={cn(
              "size-3.5 shrink-0 transition-transform duration-150",
              open && "rotate-90",
            )}
          />
        ) : (
          <span className="inline-block size-3.5 shrink-0" />
        )}
        {open && hasChildren ? (
          <FolderOpen className="size-4 shrink-0" />
        ) : (
          <Folder className="size-4 shrink-0" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {hasChildren && open && (
        <div>
          {node.children!.map((child) => (
            <FolderTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
