import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import PublisherGitLab from '../src/PublisherGitLab';
import type { PublisherGitLabConfig } from '../src/Config';

const fetchMock = vi.hoisted(() => vi.fn());

vi.mock('node-fetch', () => ({
  default: fetchMock,
}));

describe('PublisherGitLab', () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    fetchMock.mockReset();
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) =>
        fs.rm(directory, {
          force: true,
          recursive: true,
        }),
      ),
    );
  });

  it('synthesizes and uploads a darwin RELEASES.json feed when enabled', async () => {
    const { feed, fetchCalls } = await publishDarwinFeed(temporaryDirectories);

    expect(feed).toEqual({
      currentRelease: '1.2.3',
      releases: [
        {
          version: '1.2.3',
          updateTo: {
            version: '1.2.3',
            pub_date: '2026-04-30T12:00:00.000Z',
            name: 'Desktop App v1.2.3',
            url: 'https://gitlab.example.com/api/v4/projects/1/releases/permalink/latest/downloads/darwin/arm64/Desktop.App.zip',
          },
        },
      ],
    });

    expect(
      fetchCalls.some(([url]) =>
        String(url).endsWith(
          '/projects/1/packages/generic/release-assets/1.2.3/darwin/arm64/Desktop.App.zip',
        ),
      ),
    ).toBe(true);
  });

  it('uses updateUrlTemplate for generated darwin feed ZIP URLs', async () => {
    const { feed } = await publishDarwinFeed(temporaryDirectories, {
      generateUpdateFeed: {
        darwin: true,
        updateUrlTemplate:
          '{gitlabBaseUrl}/api/v4/projects/{projectId}/packages/generic/{packageName}/{packageVersion}/{packageFilePath}',
      },
      packageName: 'release assets',
      packageVersion: 'release/{version}',
      projectId: 'group/desktop',
    });

    expect(feed.releases[0].updateTo.url).toEqual(
      'https://gitlab.example.com/api/v4/projects/group%2Fdesktop/packages/generic/release%20assets/release%2F1.2.3/darwin/arm64/Desktop.App.zip',
    );
  });

  it('does not require ZIP direct asset paths when updateUrlTemplate is configured', async () => {
    const { feed } = await publishDarwinFeed(temporaryDirectories, {
      directAssetPathPrefix: false,
      generateUpdateFeed: {
        darwin: true,
        updateUrlTemplate:
          '{gitlabBaseUrl}/api/v4/projects/{projectId}/packages/generic/{packageName}/{packageVersion}/{packageFilePath}',
      },
    });

    expect(feed.releases[0].updateTo.url).toEqual(
      'https://gitlab.example.com/api/v4/projects/1/packages/generic/release-assets/1.2.3/Desktop.App.zip',
    );
  });
});

async function publishDarwinFeed(
  temporaryDirectories: string[],
  options: {
    directAssetPathPrefix?: string | false;
    generateUpdateFeed?: PublisherGitLabConfig['generateUpdateFeed'];
    packageName?: string;
    packageVersion?: string;
    projectId?: string | number;
  } = {},
): Promise<{
  feed: {
    currentRelease: string;
    releases: Array<{
      updateTo: {
        url: string;
      };
    }>;
  };
  fetchCalls: Array<[string, { body?: unknown; method?: string }]>;
}> {
  const projectId = options.projectId ?? 1;
  const encodedProjectId = encodeURIComponent(String(projectId));
  const directAssetPathPrefix =
    options.directAssetPathPrefix ?? '{platform}/{arch}';
  const packageName = options.packageName ?? 'release-assets';
  const packageVersion = options.packageVersion ?? '{version}';
  const feedPackageFilePath =
    directAssetPathPrefix === false
      ? 'RELEASES.json'
      : 'darwin/arm64/RELEASES.json';

  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'publisher-gitlab-'),
  );
  temporaryDirectories.push(directory);
  const zipPath = path.join(directory, 'Desktop App.zip');
  await fs.writeFile(zipPath, 'zip');

  fetchMock.mockImplementation(async (url: string, options = {}) => {
    const method = options.method || 'GET';

    if (
      method === 'GET' &&
      url.endsWith(`/projects/${encodedProjectId}/releases/v1.2.3`)
    ) {
      return response('', 404, 'Not Found');
    }

    if (
      method === 'POST' &&
      url.endsWith(`/projects/${encodedProjectId}/releases`)
    ) {
      return jsonResponse({ tag_name: 'v1.2.3' }, 201, 'Created');
    }

    if (method === 'GET' && url.includes('/assets/links')) {
      return jsonResponse([]);
    }

    if (
      method === 'GET' &&
      url.includes(`/projects/${encodedProjectId}/packages?`)
    ) {
      return jsonResponse([]);
    }

    if (method === 'PUT' && url.includes('/packages/generic/')) {
      return response('', 201, 'Created');
    }

    if (method === 'POST' && url.includes('/assets/links')) {
      return jsonResponse({
        id: fetchMock.mock.calls.length,
        name: JSON.parse(String(options.body)).name,
        url: JSON.parse(String(options.body)).url,
      });
    }

    throw new Error(`Unexpected request: ${method} ${url}`);
  });

  const publisher = new PublisherGitLab({
    apiUrl: 'https://gitlab.example.com/api/v4',
    authToken: 'token',
    directAssetPathPrefix,
    generateUpdateFeed: options.generateUpdateFeed ?? {
      darwin: true,
    },
    packageName,
    packageVersion,
    projectId,
    releasedAt: '2026-04-30T12:00:00.000Z',
  });

  await publisher.publish({
    dir: directory,
    forgeConfig: {} as never,
    makeResults: [
      {
        arch: 'arm64',
        artifacts: [zipPath],
        packageJSON: {
          productName: 'Desktop App',
          version: '1.2.3',
        },
        platform: 'darwin',
      },
    ],
    setStatusLine: vi.fn(),
  });

  const feedUpload = fetchMock.mock.calls.find(([url, options]) => {
    return (
      String(url).endsWith(
        `/projects/${encodedProjectId}/packages/generic/${encodeURIComponent(
          packageName,
        )}/${encodeURIComponent(
          packageVersion.replace('{version}', '1.2.3'),
        )}/${feedPackageFilePath}`,
      ) && options.method === 'PUT'
    );
  });
  expect(feedUpload).toBeDefined();

  const feed = JSON.parse(feedUpload?.[1].body.toString());
  return {
    feed,
    fetchCalls: fetchMock.mock.calls,
  };
}

function jsonResponse(
  body: unknown,
  status = 200,
  statusText = 'OK',
): ResponseLike {
  return response(JSON.stringify(body), status, statusText, 'application/json');
}

function response(
  body: string,
  status = 200,
  statusText = 'OK',
  contentType = '',
): ResponseLike {
  return {
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'content-type' ? contentType : null,
    },
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: async () => body,
  };
}

interface ResponseLike {
  headers: {
    get(name: string): string | null;
  };
  ok: boolean;
  status: number;
  statusText: string;
  text(): Promise<string>;
}
