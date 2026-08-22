"""CLI theme definitions and custom help formatter group."""

from __future__ import annotations

from typing import Any

import typer
import typer.core
from rich import box
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console(soft_wrap=False)


class CLITheme:
    """Design system theme tokens for CLI rendering."""

    PRIMARY = "red"
    PRIMARY_STYLE = "bold red"

    SECONDARY = "blue"
    SECONDARY_STYLE = "bold blue"

    ACCENT = "orange3"
    ACCENT_STYLE = "bold orange3"

    LABEL = "bright_white"
    MUTED = "dim"
    COMMENT = "dark_green"

    SUCCESS = "bold green"
    INFO = "bold cyan"
    WARNING = "bold yellow"


class OrderGroup(typer.core.TyperGroup):
    def format_help(self, ctx: Any, formatter: Any) -> None:
        if self.help:
            console.print(f"{self.help}\n")

        console.print(f"[{CLITheme.LABEL}]Usage:[/{CLITheme.LABEL}] [{CLITheme.MUTED}]tmd[/{CLITheme.MUTED}] [{CLITheme.PRIMARY_STYLE}]COMMAND[/{CLITheme.PRIMARY_STYLE}] [{CLITheme.SECONDARY_STYLE}][ARGS][/{CLITheme.SECONDARY_STYLE}] [{CLITheme.ACCENT_STYLE}][OPTIONS][/{CLITheme.ACCENT_STYLE}]\n")

        col1_width = 24

        # 1. Commands Panel
        cmd_table = Table(box=None, show_header=False, pad_edge=False, padding=(0, 2), expand=False)
        cmd_table.add_column("Command", style=CLITheme.PRIMARY_STYLE, min_width=col1_width, max_width=col1_width, no_wrap=True)
        cmd_table.add_column("Help", style="default")

        for name in self.list_commands(ctx):
            if not name:
                continue
            cmd = self.get_command(ctx, name)
            if cmd and not cmd.hidden:
                help_text = cmd.get_short_help_str(limit=120) or ""
                cmd_table.add_row(name, help_text)

        cmd_panel = Panel(cmd_table, title=f"[{CLITheme.PRIMARY_STYLE}]Commands[/{CLITheme.PRIMARY_STYLE}]", title_align="left", border_style=CLITheme.PRIMARY, box=box.ROUNDED, expand=False, padding=(0, 1))
        console.print(cmd_panel)

        # 2. Arguments Panel
        arg_table = Table(box=None, show_header=False, pad_edge=False, padding=(0, 2), expand=False)
        arg_table.add_column("Argument", style=CLITheme.SECONDARY_STYLE, min_width=col1_width, max_width=col1_width, no_wrap=True)
        arg_table.add_column("Description", style="default")
        arg_table.add_row("SOURCE", "Target directory, path, or pattern(s) (e.g. '.', 'input/', 'report.pdf')")
        arg_table.add_row("URL", "Web page link to fetch article markdown from")
        arg_table.add_row("DIRECTORY", "Repository directory to collapse for 'tmd repo'")

        arg_panel = Panel(arg_table, title=f"[{CLITheme.SECONDARY_STYLE}]Arguments (Positional Targets)[/{CLITheme.SECONDARY_STYLE}]", title_align="left", border_style=CLITheme.SECONDARY, box=box.ROUNDED, expand=False, padding=(0, 1))
        console.print(arg_panel)

        # 3. Options Panel
        opt_table = Table(box=None, show_header=False, pad_edge=False, padding=(0, 2), expand=False)
        opt_table.add_column("Option", style=CLITheme.ACCENT_STYLE, min_width=col1_width, max_width=col1_width, no_wrap=True)
        opt_table.add_column("Description", style="default")
        opt_table.add_row("-m, --merge", "Merge converted files into a single master document (convert)")
        opt_table.add_row("-b, --budget INT", "Hard token ceiling budget for pruning (convert, watch, merge)")
        opt_table.add_row("-f, --full", "Include full file contents in output (repo)")
        opt_table.add_row("--pages PAGES", "Comma-separated zero-based page indices e.g. '0,1' (convert, merge)")
        opt_table.add_row("--strip-headers-footers", "Strip repeating headers and footers from PDFs (convert, merge)")
        opt_table.add_row("--keep-boilerplate", "Keep repeating page furniture that is auto-stripped (convert, watch, merge)")
        opt_table.add_row("--write-images", "Extract embedded images to image path (convert, merge)")
        opt_table.add_row("--clip", "Copy converted output to clipboard (convert)")

        opt_panel = Panel(opt_table, title=f"[{CLITheme.ACCENT_STYLE}]Options & Flags[/{CLITheme.ACCENT_STYLE}]", title_align="left", border_style=CLITheme.ACCENT, box=box.ROUNDED, expand=False, padding=(0, 1))
        console.print(opt_panel)

        # Epilog Examples & Notes
        console.print()
        console.print(f'[{CLITheme.LABEL}]Example:[/{CLITheme.LABEL}] [{CLITheme.MUTED}]tmd[/{CLITheme.MUTED}] [{CLITheme.PRIMARY_STYLE}]convert[/{CLITheme.PRIMARY_STYLE}] [{CLITheme.SECONDARY_STYLE}].[/{CLITheme.SECONDARY_STYLE}] [{CLITheme.ACCENT_STYLE}]--loc="out"[/{CLITheme.ACCENT_STYLE}]')
        console.print(f"         [{CLITheme.COMMENT}]# Converts all supported files in current repo[/{CLITheme.COMMENT}]")
        console.print(f"         [{CLITheme.COMMENT}]# into Markdown and writes to out/ folder[/{CLITheme.COMMENT}]")

        console.print()
        console.print(f"[{CLITheme.LABEL}]NOTE:[/{CLITheme.LABEL}]    [{CLITheme.MUTED}]Multiple Arguments and Options are acceptable; they must be space-separated.[/{CLITheme.MUTED}]\n")
        console.print(
            f"[{CLITheme.LABEL}]Example:[/{CLITheme.LABEL}] [{CLITheme.MUTED}]tmd[/{CLITheme.MUTED}] [{CLITheme.PRIMARY_STYLE}]convert[/{CLITheme.PRIMARY_STYLE}] [{CLITheme.SECONDARY_STYLE}]./docs AtoTC.pdf final_slide.pptx [/{CLITheme.SECONDARY_STYLE}] [{CLITheme.ACCENT_STYLE}]--merge -b 4000 --clip[/{CLITheme.ACCENT_STYLE}]"
        )
        console.print(f"         [{CLITheme.COMMENT}]# Converts the ./docs/ folder and the AtoTC.pdf and final_slide.pptx files into markdown,\n         # merges them together, prunes to 4k budget, and copies to clipboard[/{CLITheme.COMMENT}]")
