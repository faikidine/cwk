/**
 * GitHub Actions workflow template.
 *
 * The workflow contains no scheduling intelligence: it wakes CWK and
 * lets the engine decide WAIT, WAIT_THEN_PING or PING.
 *
 * GitHub cron is best-effort (runs start late or get skipped), so the
 * workflow wakes CWK three times per hour: the minute aligned with the
 * user's requested ping time, then +20 and +40. At least one wake-up
 * lands within 20 minutes of the target, and the engine's patience
 * turns it into a ping at the exact scheduled time. The timeout leaves
 * room for that deliberate wait.
 */
export function createGitHubActionsWorkflow({ cronMinute = 0 } = {}) {
  const minutes = [cronMinute, (cronMinute + 20) % 60, (cronMinute + 40) % 60];
  const cronLines = minutes.map((minute) => `    - cron: '${minute} * * * *'`).join('\n');
  return `name: CWK

on:
  schedule:
${cronLines}
  workflow_dispatch: {}

permissions:
  contents: write

concurrency:
  group: cwk
  cancel-in-progress: false

jobs:
  ping:
    runs-on: ubuntu-latest
    timeout-minutes: 45
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install CWK and Claude Code
        run: |
          npm install -g claude-window-keeper
          npm install -g @anthropic-ai/claude-code

      - name: Run CWK
        env:
          CLAUDE_CODE_OAUTH_TOKEN: \${{ secrets.CLAUDE_OAUTH_TOKEN }}
        run: cwk ping

      - name: Commit state if changed
        run: |
          if ! git diff --quiet .cwk/state.json; then
            git config user.name "cwk-bot"
            git config user.email "cwk-bot@users.noreply.github.com"
            git add .cwk/state.json
            git commit -m "chore(cwk): update state"
            git pull --rebase
            git push
          fi
`;
}
