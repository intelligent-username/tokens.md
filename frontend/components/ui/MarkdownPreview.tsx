"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText } from "@phosphor-icons/react";
import copy from "@/lib/copy";
import { cn } from "@/lib/utils/cn";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { LoadingState } from "./LoadingState";
import { markdownComponents } from "./markdown/MarkdownComponents";
import { centerStyle, mdStyle, shellStyle } from "./markdown/styles";

interface MarkdownPreviewProps {
  content?: string;
  loading?: boolean;
  error?: string;
  className?: string;
}

/**
 * Sanitized Markdown renderer (react-markdown + remark-gfm)
 * with a copy affordance on fenced code blocks and empty/loading/error states.
 */
export function MarkdownPreview({ content, loading, error, className }: MarkdownPreviewProps) {
  if (loading) {
    return (
      <div className={cn(className)} style={{ ...shellStyle, ...centerStyle }}>
        <LoadingState label={copy.sampleLoading} />
      </div>
    );
  }
  if (error) {
    return (
      <div className={cn(className)} style={{ ...shellStyle, ...centerStyle }}>
        <ErrorState message={error} />
      </div>
    );
  }
  if (!content) {
    return (
      <div className={cn(className)} style={{ ...shellStyle, ...centerStyle }}>
        <EmptyState icon={<FileText size={26} weight="regular" />} title={copy.noConversionsYet} />
      </div>
    );
  }
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        minWidth: 0,
        padding: "24px",
        borderRadius: "12px",
        border: "1px solid var(--color-border)",
        backgroundColor: "var(--color-background)",
        color: "var(--color-foreground)",
        overflow: "hidden",
      }}
    >
      <div style={{ flex: 1, overflowY: "auto", paddingRight: "8px" }}>
        <div style={mdStyle}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
