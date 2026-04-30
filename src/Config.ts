import type { PublisherOptions } from '@electron-forge/publisher-base';

export interface GitLabRepository {
  /**
   * The project name, for example "desktop-app".
   */
  name: string;
  /**
   * The namespace that owns the project. This can be a user, group, or nested
   * group path, for example "acme" or "acme/platform".
   */
  owner: string;
}

export type GitLabAuthHeader = 'PRIVATE-TOKEN' | 'JOB-TOKEN';

export type GitLabReleaseAssetLinkType =
  | 'other'
  | 'runbook'
  | 'image'
  | 'package';

export type GitLabTemplateValue =
  | string
  | ((version: string, tagName: string) => string);

export interface GitLabDirectAssetPathContext {
  /**
   * Forge make result that produced this artifact.
   */
  makeResult: PublisherOptions['makeResults'][number];
  /**
   * Absolute path to the artifact being published.
   */
  artifactPath: string;
  /**
   * Basename of artifactPath before GitLab package filename sanitization.
   */
  artifactName: string;
  /**
   * Filename used in GitLab's generic package registry.
   */
  packageFileName: string;
  /**
   * Package version from the app's package.json.
   */
  version: string;
  /**
   * GitLab release tag name.
   */
  tagName: string;
  /**
   * GitLab generic package name used to store release binaries.
   */
  packageName: string;
  /**
   * GitLab generic package version used to store release binaries.
   */
  packageVersion: string;
}

export type GitLabDirectAssetPathPrefix =
  | string
  | false
  | ((
      context: GitLabDirectAssetPathContext,
    ) => string | false | null | undefined);

export interface PublisherGitLabConfig {
  /**
   * Details that identify your GitLab project. Use either this or projectId.
   */
  repository?: GitLabRepository;
  /**
   * Numeric project ID or full project path. If you pass a path, the publisher
   * URL-encodes it for GitLab's API.
   */
  projectId?: string | number;
  /**
   * GitLab API token with permission to create releases, publish generic
   * package files, and create release links.
   *
   * You can set GITLAB_TOKEN, GITLAB_PRIVATE_TOKEN, or CI_JOB_TOKEN instead of
   * hard-coding this in your Forge config.
   */
  authToken?: string;
  /**
   * Header used for the token. Defaults to PRIVATE-TOKEN unless CI_JOB_TOKEN is
   * used automatically, in which case JOB-TOKEN is used.
   */
  authHeader?: GitLabAuthHeader;
  /**
   * GitLab API v4 URL. Defaults to CI_API_V4_URL or
   * "https://gitlab.com/api/v4".
   */
  apiUrl?: string;
  /**
   * Prepended to the package version to determine the release tag name.
   * Defaults to "v".
   */
  tagPrefix?: string;
  /**
   * Release name. Strings can use "{version}" and "{tagName}" placeholders.
   * Defaults to the tag name.
   */
  releaseName?: GitLabTemplateValue;
  /**
   * Release description. Strings can use "{version}" and "{tagName}"
   * placeholders. Defaults to "Release {tagName}".
   */
  description?: GitLabTemplateValue;
  /**
   * Ref used by GitLab if the release tag does not already exist. Defaults to
   * CI_COMMIT_SHA or CI_COMMIT_REF_NAME when present.
   */
  ref?: string;
  /**
   * Message to use if GitLab creates a new annotated tag.
   */
  tagMessage?: string;
  /**
   * Milestones to associate with the release.
   */
  milestones?: string[];
  /**
   * ISO 8601 release timestamp.
   */
  releasedAt?: string;
  /**
   * Generic package name used to store release binaries. Defaults to
   * "release-assets".
   */
  packageName?: string;
  /**
   * Generic package version used to store release binaries. Strings can use
   * "{version}" and "{tagName}" placeholders. Defaults to "{version}".
   */
  packageVersion?: GitLabTemplateValue;
  /**
   * GitLab release link type for uploaded artifacts. Defaults to "package".
   */
  linkType?: GitLabReleaseAssetLinkType;
  /**
   * Prefix used for GitLab direct asset links. String values support
   * "{platform}", "{arch}", "{version}", "{tagName}", "{artifactName}",
   * "{packageFileName}", "{packageName}", and "{packageVersion}" placeholders.
   * Function values receive per-artifact context. Defaults to "/artifacts".
   * Set to false to omit direct_asset_path. When explicitly set to a string or
   * function, the generic package file path is nested under the resolved prefix
   * as well.
   */
  directAssetPathPrefix?: GitLabDirectAssetPathPrefix;
  /**
   * Re-upload artifacts and recreate release links when a link or package file
   * already exists.
   */
  force?: boolean;
}
