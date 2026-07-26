"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, FolderOpen, FileText, Download } from "lucide-react";

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children: Record<string, TreeNode>;
  fileData?: any;
}

interface ArtifactFileTreeProps {
  files: any[];
  activeFileVersions: Record<string, number>;
  setActiveFile: (file: { name: string; code: string } | null) => void;
  setShowArtifactsPanel: (show: boolean) => void;
}

export default function ArtifactFileTree({
  files,
  activeFileVersions,
  setActiveFile,
  setShowArtifactsPanel,
}: ArtifactFileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const buildFileTree = (filesList: any[]) => {
    const root: TreeNode = { name: "root", path: "", isFolder: true, children: {} };

    filesList.forEach((file) => {
      const parts = file.name.split("/");
      let current = root;
      let currentPath = "";

      parts.forEach((part: string, index: number) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const isLast = index === parts.length - 1;

        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            path: currentPath,
            isFolder: !isLast,
            children: {},
            fileData: isLast ? file : undefined,
          };
        }
        current = current.children[part];
      });
    });

    return root;
  };

  const renderTreeNode = (node: TreeNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedFolders[node.path] ?? true;
    const hasChildren = Object.keys(node.children).length > 0;

    if (node.isFolder) {
      return (
        <div key={node.path} className="flex flex-col w-full select-none">
          <div
            onClick={() => {
              setExpandedFolders((prev) => ({ ...prev, [node.path]: !isExpanded }));
            }}
            className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-zinc-800/40 [.light_&]:hover:bg-[#e6dfd8] text-zinc-400 [.light_&]:text-[#3d3d3a] hover:text-zinc-200 [.light_&]:hover:text-[#141413] cursor-pointer text-[13.5px] font-sans font-medium transition-all duration-150"
            style={{ paddingLeft: `${depth * 14 + 8}px` }}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500 [.light_&]:text-[#6c6a64] flex-shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-zinc-500 [.light_&]:text-[#6c6a64] flex-shrink-0" />
            )}
            <FolderOpen className="w-4 h-4 text-amber-500/80 [.light_&]:text-[#c96442] flex-shrink-0" />
            <span className="truncate">{node.name}</span>
          </div>

          {isExpanded && hasChildren && (
            <div className="flex flex-col w-full">
              {Object.values(node.children)
                .sort(
                  (a, b) =>
                    (b.isFolder ? 1 : 0) - (a.isFolder ? 1 : 0) ||
                    a.name.localeCompare(b.name)
                )
                .map((child) => renderTreeNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    } else {
      const file = node.fileData;
      if (!file) return null;

      const activeVer = activeFileVersions[file.name] || file.versions.length;
      const verObj =
        file.versions.find((v: any) => v.version === activeVer) ||
        file.versions[file.versions.length - 1];

      return (
        <div
          key={node.path}
          onClick={() => {
            setActiveFile({ name: file.name, code: verObj.code });
            setShowArtifactsPanel(false);
          }}
          className="flex items-center justify-between group/file-node rounded-lg hover:bg-zinc-800/35 [.light_&]:hover:bg-[#e6dfd8] hover:text-white [.light_&]:hover:text-[#141413] text-zinc-350 [.light_&]:text-[#3d3d3a] cursor-pointer text-[13.5px] font-sans font-normal py-1.5 px-2 transition-all duration-150"
          style={{ paddingLeft: `${depth * 14 + 18}px` }}
        >
          <div className="flex items-center gap-2 min-w-0 flex-grow mr-2">
            <FileText className="w-4 h-4 text-blue-500 [.light_&]:text-blue-600 flex-shrink-0" />
            <span className="truncate">{node.name}</span>
            {file.versions && file.versions.length > 1 && (
              <span className="text-[10px] bg-blue-500/15 [.light_&]:bg-blue-500/15 text-blue-400 [.light_&]:text-blue-700 px-1 py-0.2 rounded font-sans scale-90 border border-blue-500/20">
                v{activeVer}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const blob = new Blob([verObj.code], { type: "text/plain" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = node.name;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
            className="opacity-0 group-hover/file-node:opacity-100 text-zinc-400 hover:text-blue-500 [.light_&]:text-[#6c6a64] [.light_&]:hover:text-blue-600 p-0.5 rounded transition-all duration-150 cursor-pointer flex-shrink-0"
            title="Download file"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }
  };

  const fileTree = buildFileTree(files);

  return (
    <div className="flex flex-col w-full">
      {Object.values(fileTree.children)
        .sort(
          (a, b) =>
            (b.isFolder ? 1 : 0) - (a.isFolder ? 1 : 0) ||
            a.name.localeCompare(b.name)
        )
        .map((child) => renderTreeNode(child, 0))}
    </div>
  );
}
