---
name: removed-repo-docs
description: Task split and paper review docx/pdf were removed from the CIS repo on 2026-11-25; recover from git history if needed
metadata:
  type: project
---

On 2026-11-25 the user removed these files from the CIS 4930 repo: Final_Project_Task_Split.docx/.pdf (added in ec7e9f9) and Paper_Review_Text_to_Text_Regression.docx/.pdf (added in 2dd89a7). The user did not want them kept in the repo. The task split still exists as Desktop/CIS_Final_Task_Split.xlsx and .png.

**Why:** These were individual deliverables or files for sharing with teammates, not project files. See [[no-commit-cis-repo]].

**How to apply:** Do not add them back to the repo. If one is needed, restore it with `git show <commit>:<file>` into a folder outside the repo. Related: [[cis4930-final-project]].
