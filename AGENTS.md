<!-- devin-repo-task-proof-loop:start -->
## Devin repo task proof loop

For substantial features, refactors, and bug fixes, use the devin-repo-task-proof-loop workflow.

Required artifact path:
- Keep all task artifacts in `.agent/tasks/<TASK_ID>/` inside this repository.

Required sequence:
1. Freeze `.agent/tasks/<TASK_ID>/spec.md` before implementation.
2. Split broad write work into small bounded Devin runs, preferring more short runs with narrow disjoint scopes over one broad run.
3. Delegate bounded implementation, test-writing, focused testing, and fixer work to Devin CLI with `--model swe-1-6-fast --sandbox --permission-mode bypass --respect-workspace-trust false` directly in the current workspace.
4. Record every Devin process/session id, phase, write scope, and `.agent/devin-runs/<RUN_ID>/` path; write `codex-launch.json`; continue independent Codex work while Devin runs; poll only process metadata plus compact `status.json` and `result.json` on the startup-grace cadence, and inspect each resulting diff before consuming it.
5. Create `evidence.md`, `evidence.json`, and raw artifacts from the integrated repository state.
6. Run a fresh Codex-owned verification pass against the current codebase and rerun checks.
7. If verification is not `PASS`, write `problems.md`, apply the smallest safe fix through a bounded Devin fixer run, and reverify in Codex.

Hard rules:
- Do not claim completion unless every acceptance criterion is `PASS`.
- Codex verifiers judge current code and current command results, not Devin narratives.
- Devin fixers should make the smallest defensible diff inside an explicit write scope.
- Codex owns orchestration, code review, evidence integration, verdicts, commits, final gates, and goal alignment.
- Codex must apply Devin startup grace: first heartbeat poll after 45 seconds, heartbeat deadline 120 seconds, normal poll interval 30 seconds, stale threshold 240 seconds. A live Devin process with no heartbeat before the deadline is `starting`, not stale or failed.
- Devin must keep `.agent/devin-runs/<RUN_ID>/status.json` as a small overwritten heartbeat and write `.agent/devin-runs/<RUN_ID>/result.json` before exit.
- A Devin write-run is consumable only when `result.json` is valid and compact, `git diff` is non-empty inside the assigned write scope, and `changed_files` matches the actual diff. Treat empty diff or truncated-only output as failed/no-op, then narrow or relaunch.
- Do not load full stdout, stderr, export transcripts, or session logs into Codex context during normal polling; inspect only a small tail on stale or failure paths.
- Do not leave Devin CLI sessions or terminal processes running after a result is returned.
- Codex owns Devin processes it launches or records under `.agent/devin-runs/<RUN_ID>/`; inspect PIDs and send `SIGTERM` to recorded active/stale Devin runs without user approval. Ask only before touching non-Devin or unrelated external Devin processes, or before escalating to `SIGKILL`.
- Multiple Devin runs are allowed only when write scopes are disjoint; keep overlapping write scopes serial.
- Do not create a git worktree or temporary repository copy unless the user explicitly asks for isolation or Codex reports a concrete safety blocker first.
- This root `AGENTS.md` block is the repo-wide Codex baseline. More-specific nested `AGENTS.override.md` or `AGENTS.md` files still take precedence for their directory trees.
- Keep this block lean. If the workflow needs more Codex guidance, prefer nested `AGENTS.md` / `AGENTS.override.md` files or configured fallback guide docs instead of expanding this root block indefinitely.

Optional compatibility workflow agents:
- `.codex/agents/task-spec-freezer.toml`
- `.codex/agents/task-builder.toml`
- `.codex/agents/task-verifier.toml`
- `.codex/agents/task-fixer.toml`
<!-- devin-repo-task-proof-loop:end -->
