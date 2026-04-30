# @automaited/electron-forge-gitlab-publisher

GitLab publisher for Electron Forge. It creates a GitLab Release for each app version, uploads Forge make artifacts to the GitLab generic package registry, and attaches those files to the release as asset links.

## Installation

```sh
npm install --save-dev @automaited/electron-forge-gitlab-publisher
```

## Usage

```js
module.exports = {
  publishers: [
    {
      name: '@automaited/electron-forge-gitlab-publisher',
      config: {
        repository: {
          owner: 'acme/platform',
          name: 'desktop-app',
        },
        ref: 'main',
      },
    },
  ],
};
```

You can use a numeric GitLab project ID instead of `repository`:

```js
module.exports = {
  publishers: [
    {
      name: '@automaited/electron-forge-gitlab-publisher',
      config: {
        projectId: 12345678,
      },
    },
  ],
};
```

For a GitLab release-download auto-update feed, set `directAssetPathPrefix` to the Forge make platform and arch:

```js
module.exports = {
  publishers: [
    {
      name: '@automaited/electron-forge-gitlab-publisher',
      config: {
        projectId: 12345678,
        directAssetPathPrefix: '{platform}/{arch}',
      },
    },
  ],
};
```

That publishes release links with direct asset paths such as `/darwin/arm64/RELEASES.json` and `/win32/x64/RELEASES`. The generic package file path is also nested under the same explicit prefix, so same-named update feed files from different platform/arch builds do not collide.

You can also compute the prefix per artifact:

```js
module.exports = {
  publishers: [
    {
      name: '@automaited/electron-forge-gitlab-publisher',
      config: {
        projectId: 12345678,
        directAssetPathPrefix: ({ makeResult }) =>
          `${makeResult.platform}/${makeResult.arch}`,
      },
    },
  ],
};
```

## Authentication

Set one of these environment variables:

```sh
export GITLAB_TOKEN="your-personal-or-project-access-token"
```

In GitLab CI, the publisher also supports:

```sh
export CI_JOB_TOKEN="..."
export CI_API_V4_URL="https://gitlab.example.com/api/v4"
```

By default, `GITLAB_TOKEN` and `GITLAB_PRIVATE_TOKEN` use the `PRIVATE-TOKEN` header. `CI_JOB_TOKEN` uses the `JOB-TOKEN` header.

## Configuration

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `repository` | `{ owner: string, name: string }` | | Project namespace and name. `owner` can include nested groups. |
| `projectId` | `string \| number` | | Numeric project ID or full project path. Use this instead of `repository`. |
| `authToken` | `string` | env token | GitLab token. |
| `authHeader` | `'PRIVATE-TOKEN' \| 'JOB-TOKEN'` | inferred | Token header to send. |
| `apiUrl` | `string` | `CI_API_V4_URL` or `https://gitlab.com/api/v4` | GitLab API v4 URL. |
| `tagPrefix` | `string` | `v` | Prefix for release tags. |
| `releaseName` | `string \| function` | tag name | Release display name. Strings support `{version}` and `{tagName}`. |
| `description` | `string \| function` | `Release {tagName}` | Release notes. Strings support `{version}` and `{tagName}`. |
| `ref` | `string` | `CI_COMMIT_SHA` or `CI_COMMIT_REF_NAME` | Ref GitLab should use if it must create the tag. |
| `tagMessage` | `string` | | Annotated tag message when GitLab creates a tag. |
| `milestones` | `string[]` | | GitLab milestones to associate with the release. |
| `releasedAt` | `string` | | ISO 8601 release timestamp. |
| `packageName` | `string` | `release-assets` | Generic package name used for uploaded binaries. |
| `packageVersion` | `string \| function` | app version | Generic package version. Strings support `{version}` and `{tagName}`. |
| `linkType` | `'other' \| 'runbook' \| 'image' \| 'package'` | `package` | GitLab release link type. |
| `directAssetPathPrefix` | `string \| function \| false` | `/artifacts` | Prefix for GitLab direct asset links. Strings support `{platform}`, `{arch}`, `{version}`, `{tagName}`, `{artifactName}`, `{packageFileName}`, `{packageName}`, and `{packageVersion}`. Functions receive per-artifact context. Set to `false` to omit `direct_asset_path`. When explicitly set to a string or function, the generic package file path is nested under the resolved prefix as well. |
| `force` | `boolean` | `false` | Replace existing release links and generic package files. |

## Self-managed GitLab

```js
module.exports = {
  publishers: [
    {
      name: '@automaited/electron-forge-gitlab-publisher',
      config: {
        projectId: 'group/subgroup/desktop-app',
        apiUrl: 'https://gitlab.example.com/api/v4',
      },
    },
  ],
};
```

## Publishing this package

Package metadata is configured for public npm publishing under `@automaited/electron-forge-gitlab-publisher`.

```sh
npm install
npm test
npm run build
npm publish --access public
```
