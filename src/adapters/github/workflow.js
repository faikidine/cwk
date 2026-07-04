/**
 * GitHub Actions workflow template.
 *
 * The workflow contains no scheduling intelligence: it wakes CWK at a
 * fixed minute every hour and lets the engine decide WAIT or PING.
 * The minute is aligned with the user's requested ping time so pings
 * land on schedule instead of up to an hour late.
 */
export function createGitHubActionsWorkflow({ cronMinute = 0 } = {}) {
  return `name: CWK

on:
  schedule:
    - cron: '${cronMinute} * * * *'
  workflow_dispatch: {}

permissions:
  contents: write

concurrency:
  group: cwk
  cancel-in-progress: false

jobs:
  ping:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install CWK and Claude Code
        run: |
          npm install -g cwk
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
