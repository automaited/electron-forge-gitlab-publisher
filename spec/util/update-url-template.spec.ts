import { describe, expect, it } from 'vitest';

import { renderUpdateUrlTemplate } from '../../src/util/update-url-template';

const template =
  '{gitlabBaseUrl}/api/v4/projects/{projectId}/packages/generic/{packageName}/{packageVersion}/{packageFilePath}';

describe('update URL templates', () => {
  it('renders package registry URLs with encoded path segments', () => {
    expect(
      renderUpdateUrlTemplate(template, {
        arch: 'arm64',
        artifactName: 'My App.zip',
        gitlabBaseUrl: 'https://gitlab.example.com/',
        packageFileName: 'My.App.zip',
        packageFilePath: 'darwin/arm64/My App.zip',
        packageName: 'release assets',
        packageVersion: 'release/1.2.3',
        platform: 'darwin',
        projectId: 'group%2Fdesktop',
        tagName: 'v1.2.3',
        version: '1.2.3',
      }),
    ).toEqual(
      'https://gitlab.example.com/api/v4/projects/group%2Fdesktop/packages/generic/release%20assets/release%2F1.2.3/darwin/arm64/My%20App.zip',
    );
  });

  it('supports numeric project IDs using the same placeholder', () => {
    expect(
      renderUpdateUrlTemplate('{projectId}/{platform}/{arch}/{version}', {
        arch: 'arm64',
        artifactName: 'app.zip',
        gitlabBaseUrl: 'https://gitlab.example.com',
        packageFileName: 'app.zip',
        packageFilePath: 'darwin/arm64/app.zip',
        packageName: 'release-assets',
        packageVersion: '1.2.3',
        platform: 'darwin',
        projectId: '80957721',
        tagName: 'v1.2.3',
        version: '1.2.3',
      }),
    ).toEqual('80957721/darwin/arm64/1.2.3');
  });
});
