# Connect the local editor

Use this reference when installing the integration, registering an MCP consumer,
or diagnosing connection and workspace errors. Run commands from the repository
root unless using an absolute entry-script path.

## Prepare the application

1. Install the root workspace dependencies with `npm ci` using the Node version
   permitted by `package.json`. The root devDependencies include the MCP tools;
   an install that omits devDependencies is not sufficient.
2. Open the existing NavSlides Electron application, or run `npm run dev` in a
   separate terminal and leave it running. MCP does not start the editor.
3. Call `server_status` using the discovery commands in `../SKILL.md`. Confirm
   the intended local application is ready before changing its presentations.

Configure the connection and file boundary through the server process environment:

| Setting | Purpose |
| --- | --- |
| `NAVSLIDES_URL` | Local API origin; defaults to `http://127.0.0.1:3002`. |
| `NAVSLIDES_WORKSPACE` | Approved input/output directory; defaults to the repository root, not the consumer's launch directory. |
| `NAVSLIDES_READ_ONLY=true` | Enforce inspection-only access, including blocking file outputs, imports, and uploads. |

The MCP transport is stdio. The HTTP origin is the existing application API,
not an MCP endpoint. Loopback access needs no integration login, OAuth, or API
key; it trusts the local operating-system user. Do not expose it as a remote
service or disable application ingress checks to make a connection work.

## Register a consumer

Use `node ./scripts/agent/mcp.mjs` from the repository root as the MCP process entry point. Launch Node
directly rather than through `npm run mcp`: npm startup text can corrupt the
protocol's stdout. An MCP process waiting on stdin is not a failed startup.

Use an absolute entry-script path in GUI consumers and an absolute Node executable
path when the GUI cannot resolve `node` from PATH. Merge an entry into existing
configuration; do not replace unrelated servers or write user-global settings
without authorization.

### Claude Code

The root `.mcp.json` is the project configuration. Open Claude Code in this
repository, review its project-server approval, and use `/mcp` to inspect the
connection. Configuration discovery still requires consumer approval; it is not
proof that a tool call or skill routing works.

### Claude Desktop and Cursor

For Claude Desktop, open **Settings → Developer → Edit Config** and merge the
entry below into `claude_desktop_config.json`, then completely restart Desktop.
For Cursor, merge it into the project's `.cursor/mcp.json` or explicitly
user-approved `~/.cursor/mcp.json`, then inspect its MCP tools in Customize.

Illustrative Windows configuration: replace `C:/Projects/NavSlidesEditor` with
the absolute location of this repository. The example does not create that path.

```json
{
  "mcpServers": {
    "navslides": {
      "type": "stdio",
      "command": "node",
      "args": ["C:/Projects/NavSlidesEditor/scripts/agent/mcp.mjs"],
      "env": {
        "NAVSLIDES_URL": "http://127.0.0.1:3002",
        "NAVSLIDES_WORKSPACE": "C:/Projects/NavSlidesEditor"
      }
    }
  }
}
```

### Codex

Merge a table into the chosen Codex `config.toml` (user configuration or trusted
project `.codex/config.toml`). Use the same absolute-path substitution as above:

```toml
[mcp_servers.navslides]
command = "node"
args = ["C:/Projects/NavSlidesEditor/scripts/agent/mcp.mjs"]

[mcp_servers.navslides.env]
NAVSLIDES_URL = "http://127.0.0.1:3002"
NAVSLIDES_WORKSPACE = "C:/Projects/NavSlidesEditor"
```

Inspect `/mcp` in the consumer and call `server_status`. If the consumer does not
auto-discover the project skill, explicitly load `../SKILL.md` as instructions;
MCP registration alone does not install or activate a skill.

## Recover without widening access

- For `SERVER_UNREACHABLE`, open the app and check the selected loopback port.
  A packaged Electron app and a source checkout can own different deck stores;
  list presentations to confirm the target before editing.
- For a launch error, check the absolute Node and script paths and dependency
  installation. For malformed protocol output, remove npm or other stdout wrappers.
- For `READ_ONLY`, keep the restriction unless the user authorizes mutations;
  restart with the approved environment rather than bypassing it.
- For a workspace rejection, use an approved file inside the configured root.
  Traversal and symlink escapes are rejected even for absolute input paths.
- For schema errors, read current tool help instead of guessing flags or IDs.

Consumer configuration formats are documented by
[Claude Code](https://code.claude.com/docs/en/mcp),
[Claude Desktop](https://modelcontextprotocol.io/docs/develop/connect-local-servers),
[Cursor](https://cursor.com/docs/mcp), and
[Codex](https://developers.openai.com/codex/mcp/).
These are setup routes, not records of successful registration or routing tests.
