---
title: "PowerPoint Classic Ribbon Research Summary"
status: complete
created: 2026-05-22
---

# PowerPoint Classic Ribbon Research Summary

## Summary

PowerPoint desktop classic uses tabbed command organization, grouped commands, stable group labels, dense controls, and predictable left-to-right command placement. It does not center whole tab contents. Groups may center their own controls.

## Sources

- Microsoft Ribbon Framework: `https://learn.microsoft.com/en-us/windows/win32/windowsribbon/windowsribbon-introduction`
- Windows Ribbon UX Guidelines: `https://learn.microsoft.com/is-is/windows/win32/uxguide/cmd-ribbons`
- PowerPoint ribbon navigation support: `https://support.microsoft.com/en-US/accessibility/powerpoint/use-a-screen-reader-to-explore-and-navigate-powerpoint`
- Office Add-in command guidance: `https://learn.microsoft.com/is-is/office/dev/add-ins/design/add-in-commands`

## Findings

| Finding | Impact For NavSlides |
| --- | --- |
| Tabs group related commands by task area. | Keep Home/Insert/Design/Transitions/Animations/View/Format domain split. |
| Groups are stable named regions. | Keep `RibbonSection` labels visible and centered below commands. |
| Common commands should be direct. | Keep Insert Media/Embed common actions direct; Advanced stays dropdown. |
| Ribbon is dense and predictable. | Avoid wide card-like controls, oversized spacing, and viewport-dependent centering. |
| Overflow should be deliberate. | At narrow widths horizontal scroll is acceptable; clipping/overlap is not. |

## Current Codebase Read

- `RibbonPanel` wraps active tab panels in `h-[80px] flex items-center overflow-x-auto`.
- Main tab contents mostly use `flex items-stretch gap-0 h-full overflow-x-auto`.
- `RibbonSection` uses `flex-col justify-between`, content wrapper `items-center justify-center`, label `text-center`.
- Format no-selection state returns a free text row, not a `RibbonSection`; this creates the strongest alignment mismatch.

## Recommendation

Keep the existing foundation. Do not redesign. Standardize contracts, add tests, fix outliers, and document the rule:

`RibbonPanel = vertical center; TabContent = left-flow sections; RibbonSection = centered group content + bottom label.`

## Unresolved Questions

- None blocking. Height budget decision remains product taste.
