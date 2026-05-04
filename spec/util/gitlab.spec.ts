import { afterEach, describe, expect, it } from 'vitest';

import GitLab from '../../src/util/gitlab';

describe('GitLab', () => {
  afterEach(() => {
    delete process.env.GITLAB_TOKEN;
    delete process.env.GITLAB_PRIVATE_TOKEN;
    delete process.env.CI_JOB_TOKEN;
    delete process.env.CI_API_V4_URL;
  });

  it('reads token from constructor', () => {
    expect(new GitLab('token1').token).toEqual('token1');
  });

  it('falls back to GITLAB_TOKEN', () => {
    process.env.GITLAB_TOKEN = 'abc123';
    expect(new GitLab().token).toEqual('abc123');
  });

  it('falls back to CI_JOB_TOKEN', () => {
    process.env.CI_JOB_TOKEN = 'job-token';
    expect(new GitLab().token).toEqual('job-token');
  });

  it('throws when auth is required and no token is available', () => {
    expect(() => new GitLab(undefined, true)).toThrow(
      'Please set GITLAB_TOKEN or CI_JOB_TOKEN in your environment to access these features',
    );
  });

  it('URL-encodes project paths', () => {
    expect(GitLab.encodeProjectId('acme/platform/desktop')).toEqual(
      'acme%2Fplatform%2Fdesktop',
    );
  });

  it('builds repository paths with nested owners', () => {
    expect(GitLab.projectPath('acme/platform', 'desktop')).toEqual(
      'acme/platform/desktop',
    );
  });

  describe('sanitizePackageFileName', () => {
    it('removes path directories', () => {
      expect(GitLab.sanitizePackageFileName('path/to/app.dmg')).toEqual(
        'app.dmg',
      );
    });

    it('replaces spaces and unsupported characters with periods', () => {
      expect(GitLab.sanitizePackageFileName('My App Setup 1.0.0.exe')).toEqual(
        'My.App.Setup.1.0.0.exe',
      );
    });

    it('preserves GitLab-supported package filename characters', () => {
      expect(GitLab.sanitizePackageFileName('@foo+bar_~.zip')).toEqual(
        'foo+bar_~.zip',
      );
    });

    it('removes diacritics', () => {
      expect(GitLab.sanitizePackageFileName('électron.dmg')).toEqual(
        'electron.dmg',
      );
    });
  });

  describe('directAssetPath', () => {
    it('joins the prefix and file name', () => {
      expect(GitLab.directAssetPath('/downloads', 'app.zip')).toEqual(
        '/downloads/app.zip',
      );
    });

    it('defaults an empty prefix to artifacts', () => {
      expect(GitLab.directAssetPath('', 'app.zip')).toEqual(
        '/artifacts/app.zip',
      );
    });
  });

  describe('generic package paths', () => {
    it('joins package file path prefixes without a leading slash', () => {
      expect(GitLab.packageFilePath('/darwin/arm64', 'RELEASES.json')).toEqual(
        'darwin/arm64/RELEASES.json',
      );
    });

    it('encodes package file path segments without escaping slashes', () => {
      expect(GitLab.encodePackageFilePath('darwin arm64/My App.dmg')).toEqual(
        'darwin%20arm64/My%20App.dmg',
      );
    });

    it('uses nested package file paths in generic package URLs', () => {
      const gitlab = new GitLab(undefined, false, {
        apiUrl: 'https://gitlab.example.com/api/v4',
      });

      expect(
        gitlab.genericPackageFileUrl(
          '1',
          'release-assets',
          '1.2.3',
          'darwin/arm64/RELEASES.json',
        ),
      ).toEqual(
        'https://gitlab.example.com/api/v4/projects/1/packages/generic/release-assets/1.2.3/darwin/arm64/RELEASES.json',
      );
    });
  });

  describe('baseUrl', () => {
    it('removes the API v4 suffix from the GitLab API URL', () => {
      const gitlab = new GitLab(undefined, false, {
        apiUrl: 'https://gitlab.example.com/gitlab/api/v4',
      });

      expect(gitlab.baseUrl()).toEqual('https://gitlab.example.com/gitlab');
    });
  });

  describe('release asset download URLs', () => {
    it('builds latest-release asset download URLs', () => {
      const gitlab = new GitLab(undefined, false, {
        apiUrl: 'https://gitlab.example.com/api/v4',
      });

      expect(
        gitlab.releaseAssetDownloadUrl(
          '1',
          'permalink/latest',
          '/darwin/arm64/My App.zip',
        ),
      ).toEqual(
        'https://gitlab.example.com/api/v4/projects/1/releases/permalink/latest/downloads/darwin/arm64/My%20App.zip',
      );
    });

    it('builds tag-specific asset download URLs', () => {
      const gitlab = new GitLab(undefined, false, {
        apiUrl: 'https://gitlab.example.com/api/v4',
      });

      expect(
        gitlab.releaseAssetDownloadUrl(
          'group%2Fdesktop',
          'release/1.2.3',
          '/darwin/arm64/My App.zip',
        ),
      ).toEqual(
        'https://gitlab.example.com/api/v4/projects/group%2Fdesktop/releases/release%2F1.2.3/downloads/darwin/arm64/My%20App.zip',
      );
    });
  });
});
