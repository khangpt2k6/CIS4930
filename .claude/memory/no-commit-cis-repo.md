---
name: no-commit-cis-repo
description: Never commit or push in the CIS 4930 repo unless the user explicitly asks; overrides the global push-constantly rule
metadata:
  node_type: memory
  type: feedback
  modified: 2026-11-24T17:16:10.731Z
---

Do not run git commit or git push in the CIS 4930 repo (Desktop/CIS) unless the user explicitly asks for it in that message. Hand over files locally (Desktop or the folder) instead. This overrides the global CLAUDE.md "commit and push constantly" rule for this project.

**Why:** On 2026-11-24 I committed and pushed a task-split doc and script deletions as part of "check everything, remove scripts, make a task doc". They wanted files to share with teammates, not repo changes. The repo is public and shared with teammates.

**How to apply:** For deliverables (docs, images, spreadsheets) save outside the repo or leave them uncommitted, and say where they are. Related: [[cis4930-final-project]].
