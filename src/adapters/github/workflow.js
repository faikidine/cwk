export function createGitHubActionsWorkflow() {
  return `name: CWK

on:
  schedule:
    - cron: '50 * * * *'
  workflow_dispatch: {}

permissions:
  contents: write

concurrency:
  group: cwk
  cancel-in-progress: true

jobs:
  ping:
    runs-on: ubuntu-latest
    timeout-minutes: 5
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
            git push
          fi
`;
}
