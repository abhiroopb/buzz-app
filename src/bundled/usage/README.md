# Usage

Estimates what your agents' Claude Code, Codex and goose sessions on this computer cost, from each harness's own session files: the cost a harness records, or else its token counts at each provider's published API prices, from [genai-prices](https://github.com/pydantic/genai-prices). It is a best-effort estimate, not your bill.

A timer's or watch's turn leaves no conversation behind, so while Usage is on, this app keeps a record of the session each one starts, and which timer or watch it was. Turns run while Usage is off are not recorded. Most are not counted; goose turns that still appear in goose's own session history are counted, but without their timer or watch.

## Getting started

1. Open **Settings → Usage**, under Plugins.
2. Choose **Last 7 days** or **Last 30 days**, and an agent or harness to narrow it down.
3. Select a session to open its conversation, or an agent to open it in Agents.
