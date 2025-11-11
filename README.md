# Loyalist Pyramid

## Prerequisites
1) Download Bun runtime (bun.sh)
2) Install dependencies

```bash
bun install
```

## Development
1) Install the workspace recommended extension (eslint extension) in vscode.

This makes the code autoformat on save according to eslint / prettier rules and auto fixes other warnings on save

2) Run `bun dev` in a terminal. This will start a local development server and hot-reload changes.


## Building the website for deployment
```bash
bun run build
```

Copy the contents of `target` directory to the web server.

## Adding a new generation of loyalists
To add new generation, add the usernames to `src/data/loyalists.ts`, display names to `src/data/displayNames.ts` and the profile pictures to `pfp`. Then run

```bash
bun run generate-pfp
```

This will make smaller versions of the profile pictures and it also ensures that every loyalist has a profile picture and display name.
