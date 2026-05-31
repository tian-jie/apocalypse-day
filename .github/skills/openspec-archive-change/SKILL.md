---
name: openspec-archive-change
description: Archive a completed change in the experimental workflow. Use when the user wants to finalize and archive a change after implementation is complete.
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.3.1"
---

Archive a completed change in the experimental workflow.

**Input**: Optionally specify a change name. If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **If no change name provided, prompt for selection**

   Run `openspec list --json` to get available changes. Use the **AskUserQuestion tool** to let the user select.

   Show only active changes (not already archived).
   Include the schema used for each change if available.

   **IMPORTANT**: Do NOT guess or auto-select a change. Always let the user choose.

2. **Check artifact completion status**

   Run `openspec status --change "<name>" --json` to check artifact completion.

   Parse the JSON to understand:
   - `schemaName`: The workflow being used
   - `artifacts`: List of artifacts with their status (`done` or other)

   **If any artifacts are not `done`:**
   - Display warning listing incomplete artifacts
   - Use **AskUserQuestion tool** to confirm user wants to proceed
   - Proceed if user confirms

3. **Check task completion status**

   Read the tasks file (typically `tasks.md`) to check for incomplete tasks.

   Count tasks marked with `- [ ]` (incomplete) vs `- [x]` (complete).

   **If incomplete tasks found:**
   - Display warning showing count of incomplete tasks
   - Use **AskUserQuestion tool** to confirm user wants to proceed
   - Proceed if user confirms

   **If no tasks file exists:** Proceed without task-related warning.

4. **Assess delta spec sync state**

   Check for delta specs at `openspec/changes/<name>/specs/`. If none exist, proceed without sync prompt.

   **If delta specs exist:**
   - Compare each delta spec with its corresponding main spec at `openspec/specs/<capability>/spec.md`
   - Determine what changes would be applied (adds, modifications, removals, renames)
   - Show a combined summary before prompting

   **Prompt options:**
   - If changes needed: "Sync now (recommended)", "Archive without syncing"
   - If already synced: "Archive now", "Sync anyway", "Cancel"

   If user chooses sync, use Task tool (subagent_type: "general-purpose", prompt: "Use Skill tool to invoke openspec-sync-specs for change '<name>'. Delta spec analysis: <include the analyzed delta spec summary>"). Proceed to archive regardless of choice.

5. **Build a compact archive package**

   Create the archive directory if it doesn't exist:
   ```bash
   mkdir -p openspec/changes/archive
   ```

   Generate target name using current date: `YYYY-MM-DD-<change-name>`

   **Check if target already exists:**
   - If yes: Fail with error, suggest renaming existing archive or using different date
   - If no: Create the target directory

   The archived result must contain exactly two files:
   - `proposal.md`
   - `design-spec.md`

   **proposal.md**
   - If `openspec/changes/<name>/proposal.md` exists, copy it into the archive directory unchanged.
   - If it does not exist, fail with a clear error.

   **design-spec.md**
   - Build a single merged document from:
     - `openspec/changes/<name>/design.md` when present
     - all delta specs under `openspec/changes/<name>/specs/**/*.md`
   - Keep the content in one file with clear section boundaries so readers can progressively disclose detail within the same document.
   - Recommended high-level structure:
     - `# Design`
     - design content
     - `# Specs`
     - one subsection per capability/spec file
   - If `design.md` is missing, keep the `# Design` section and write a short note that no design artifact was archived.
   - If no delta specs exist, keep the `# Specs` section and write a short note that there were no delta specs to archive.

   **main design sync**
   - If `openspec/changes/<name>/design.md` exists and there are capability directories under `openspec/changes/<name>/specs/`, also copy the same design content into each corresponding main capability directory as `openspec/specs/<capability>/design.md`.
   - Create the target capability directory if needed.
   - This main `design.md` is the current design reference for that capability, while the archive keeps the compact historical `design-spec.md` snapshot.

   Do not archive `tasks.md`, `.openspec.yaml`, or the raw `specs/` directory.

6. **Finalize the archive**

   After the compact archive package has been written successfully:
   - Verify the target directory contains exactly `proposal.md` and `design-spec.md`
   - Remove the original active change directory from `openspec/changes/<name>` so it no longer appears as active work

   Only delete the original change directory after the compact archive package is complete.

7. **Display summary**

   Show archive completion summary including:
   - Change name
   - Schema that was used
   - Archive location
   - Archived files: `proposal.md`, `design-spec.md`
   - Whether specs were synced (if applicable)
   - Note about any warnings (incomplete artifacts/tasks)

**Output On Success**

```
## Archive Complete

**Change:** <change-name>
**Schema:** <schema-name>
**Archived to:** openspec/changes/archive/YYYY-MM-DD-<name>/
**Files:** proposal.md, design-spec.md
**Specs:** ✓ Synced to main specs (or "No delta specs" or "Sync skipped")

All artifacts complete. All tasks complete.
```

**Guardrails**
- Always prompt for change selection if not provided
- Use artifact graph (openspec status --json) for completion checking
- Don't block archive on warnings - just inform and confirm
- The archived result must be a compact two-file package in one directory
- Do not keep a separate `openspec/designs/` design library
- Show clear summary of what happened
- If sync is requested, use openspec-sync-specs approach (agent-driven)
- If delta specs exist, always run the sync assessment and show the combined summary before prompting
