"use client";

import { useState, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CaretDown, CaretUp } from "@phosphor-icons/react";
import { SettingLabel } from "./SettingLabel";
import { Toggle } from "@/components/ui/Toggle";
import { BudgetInput, type BudgetUnit } from "@/components/ui/BudgetInput";

export interface OptionsPanelProps {
  extensions: string;
  setExtensions: (val: string) => void;
  pages: string;
  setPages: (val: string) => void;
  budgetEnabled: boolean;
  setBudgetEnabled: (val: boolean) => void;
  budgetValue: number;
  setBudgetValue: (val: number) => void;
  budgetUnit: BudgetUnit;
  setBudgetUnit: (val: BudgetUnit) => void;
  recursive: boolean;
  setRecursive: (val: boolean) => void;
  stripHeadersFooters: boolean;
  setStripHeadersFooters: (val: boolean) => void;
  writeImages: boolean;
  setWriteImages: (val: boolean) => void;
  mergeEnabled: boolean;
  setMergeEnabled: (val: boolean) => void;
  includeToc: boolean;
  setIncludeToc: (val: boolean) => void;
}

/** Collapsible Advanced Settings Accordion. */
export function OptionsPanel({
  extensions,
  setExtensions,
  pages,
  setPages,
  budgetEnabled,
  setBudgetEnabled,
  budgetValue,
  setBudgetValue,
  budgetUnit,
  setBudgetUnit,
  recursive,
  setRecursive,
  stripHeadersFooters,
  setStripHeadersFooters,
  writeImages,
  setWriteImages,
  mergeEnabled,
  setMergeEnabled,
  includeToc,
  setIncludeToc,
}: OptionsPanelProps) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="rounded-card border border-border/60 bg-card/40 p-4">
      <button type="button" onClick={() => setShowSettings(!showSettings)} className="flex w-full items-center justify-between text-sm font-bold text-foreground hover:text-emerald-400 transition-colors">
        <span>Settings</span>
        {showSettings ? <CaretUp size={18} /> : <CaretDown size={18} />}
      </button>

      <AnimatePresence initial={false}>
        {showSettings ? (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25, ease: "easeInOut" }} className="overflow-visible">
            <div className="mt-5 flex flex-col gap-4 border-t border-border/40 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <SettingLabel htmlFor="extensions-input" label="Extensions (comma-separated)" tooltip="Filter input files by extension (e.g. pdf, docx, py). Only matching files will be converted." />
                  <input
                    id="extensions-input"
                    type="text"
                    value={extensions}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setExtensions(e.target.value)}
                    placeholder="pdf, docx, md, py"
                    className="rounded-chip border border-border bg-input px-3 py-2 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <SettingLabel htmlFor="pages-input" label="Pages Selection" tooltip="Convert specific page ranges for PDFs and documents (e.g. '1-5, 8, 10-12'). Leave blank to convert all pages." />
                  <input
                    id="pages-input"
                    type="text"
                    value={pages}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setPages(e.target.value)}
                    placeholder="0,2,4 or 1-10"
                    className="rounded-chip border border-border bg-input px-3 py-2 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {budgetEnabled ? (
                <BudgetInput
                  value={budgetValue}
                  unit={budgetUnit}
                  onChange={(val, unit) => {
                    setBudgetValue(val);
                    setBudgetUnit(unit);
                  }}
                />
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 w-full rounded-card bg-card/60 p-4 border border-border/60">
                {[
                  {
                    id: "budget",
                    label: "Token budget ceiling",
                    checked: budgetEnabled,
                    onChange: setBudgetEnabled,
                    tooltip: "Enforce a maximum token ceiling on the generated output. The AST pruner trims lower-priority content to fit your limit.",
                  },
                  {
                    id: "recursive",
                    label: "Recursive subfolders",
                    checked: recursive,
                    onChange: setRecursive,
                    tooltip: "Scan all nested subdirectories inside uploaded folder structures to discover and convert files recursively.",
                  },
                  {
                    id: "stripHeadersFooters",
                    label: "Strip headers & footers",
                    checked: stripHeadersFooters,
                    onChange: setStripHeadersFooters,
                    tooltip: "Detect and remove repetitive running headers, footers, and page numbers from document pages.",
                  },
                  {
                    id: "writeImages",
                    label: "Write images",
                    checked: writeImages,
                    onChange: setWriteImages,
                    tooltip: "Extract embedded images from PDFs/documents and save them alongside the generated Markdown file.",
                  },
                  {
                    id: "merge",
                    label: "Merge all into single Markdown file",
                    checked: mergeEnabled,
                    onChange: setMergeEnabled,
                    tooltip: "Combine all converted files into a single unified Markdown document with clear file section headers.",
                    subToggle: mergeEnabled
                      ? {
                          id: "toc",
                          label: "Include Table of Contents",
                          checked: includeToc,
                          onChange: setIncludeToc,
                          tooltip: "Generate an automated Table of Contents with jump links at the top of the merged document.",
                        }
                      : null,
                  },
                ].map((item) => (
                  <div key={item.id} className="flex flex-col gap-2 min-w-0">
                    <Toggle checked={item.checked} onChange={item.onChange} label={item.label} tooltip={item.tooltip} />
                    {item.subToggle ? (
                      <div className="pl-4 pt-1 border-l-2 border-emerald-500/30 ml-2">
                        <Toggle checked={item.subToggle.checked} onChange={item.subToggle.onChange} label={item.subToggle.label} tooltip={item.subToggle.tooltip} />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
