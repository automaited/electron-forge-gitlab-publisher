import path from 'node:path';

import {
  PublisherBase,
  PublisherOptions,
} from '@electron-forge/publisher-base';

import {
  GitLabTemplateValue,
  PublisherGitLabConfig,
} from './Config';
import { resolveDirectAssetPathPrefix } from './util/direct-asset-path';
import GitLab, {
  GitLabCreateReleasePayload,
  GitLabPackageFile,
  GitLabReleaseLink,
} from './util/gitlab';

export default class PublisherGitLab extends PublisherBase<PublisherGitLabConfig> {
  name = 'gitlab';

  async publish({
    makeResults,
    setStatusLine,
  }: PublisherOptions): Promise<void> {
    const { config } = this;
    const projectId = resolveProjectId(config);
    const gitlab = new GitLab(config.authToken, true, {
      apiUrl: config.apiUrl,
      authHeader: config.authHeader,
    });

    const perReleaseArtifacts: {
      [version: string]: PublisherOptions['makeResults'];
    } = {};

    for (const makeResult of makeResults) {
      const release = makeResult.packageJSON.version;
      if (!perReleaseArtifacts[release]) {
        perReleaseArtifacts[release] = [];
      }
      perReleaseArtifacts[release].push(makeResult);
    }

    for (const releaseVersion of Object.keys(perReleaseArtifacts)) {
      const makeResultsForRelease = perReleaseArtifacts[releaseVersion];
      const releaseName = `${config.tagPrefix ?? 'v'}${releaseVersion}`;
      const artifacts = makeResultsForRelease.flatMap((makeResult) =>
        makeResult.artifacts.map((artifactPath) => ({
          artifactPath,
          makeResult,
        })),
      );
      const packageName = config.packageName || 'release-assets';
      const packageVersion = resolveTemplate(
        config.packageVersion,
        releaseVersion,
        releaseName,
        releaseVersion,
      );

      setStatusLine(`Searching for target release: ${releaseName}`);
      const existingRelease = await gitlab.getRelease(projectId, releaseName);
      if (!existingRelease) {
        setStatusLine(`Creating target release: ${releaseName}`);
        await gitlab.createRelease(
          projectId,
          createReleasePayload(config, releaseVersion, releaseName),
        );
      }

      let releaseLinks = await gitlab.listReleaseLinks(projectId, releaseName);
      let packageFiles = await gitlab.listGenericPackageFiles(
        projectId,
        packageName,
        packageVersion,
      );

      let uploaded = 0;
      const updateUploadStatus = () => {
        setStatusLine(
          `Uploading distributable (${uploaded}/${artifacts.length} to ${releaseName})`,
        );
      };
      updateUploadStatus();

      await Promise.all(
        artifacts.map(async ({ artifactPath, makeResult }) => {
          const artifactName = path.basename(artifactPath);
          const packageFileName = GitLab.sanitizePackageFileName(artifactName);
          const directAssetPathPrefix = resolveDirectAssetPathPrefix(
            config.directAssetPathPrefix,
            {
              artifactName,
              artifactPath,
              makeResult,
              packageFileName,
              packageName,
              packageVersion,
              tagName: releaseName,
              version: releaseVersion,
            },
          );
          const packageFilePath =
            config.directAssetPathPrefix !== undefined &&
            directAssetPathPrefix !== false
              ? GitLab.packageFilePath(directAssetPathPrefix, packageFileName)
              : packageFileName;
          const packageUrl = gitlab.genericPackageFileUrl(
            projectId,
            packageName,
            packageVersion,
            packageFilePath,
          );
          const directAssetPath =
            directAssetPathPrefix === false
              ? undefined
              : GitLab.directAssetPath(directAssetPathPrefix, packageFileName);
          const existingLink = findExistingLink(
            releaseLinks,
            artifactName,
            packageUrl,
            directAssetPath,
          );
          const existingPackageFile = packageFiles.find(
            (file) => file.file_name === packageFilePath,
          );

          const done = () => {
            uploaded += 1;
            updateUploadStatus();
          };

          if (existingLink) {
            if (config.force === true) {
              await gitlab.deleteReleaseLink(
                projectId,
                releaseName,
                existingLink.id,
              );
              releaseLinks = releaseLinks.filter(
                (link) => link.id !== existingLink.id,
              );
            } else {
              return done();
            }
          }

          if (existingPackageFile) {
            if (config.force === true) {
              await gitlab.deletePackageFile(
                projectId,
                existingPackageFile.package_id,
                existingPackageFile.id,
              );
              packageFiles = packageFiles.filter(
                (file) => file.id !== existingPackageFile.id,
              );
            } else {
              throw new Error(
                `Unable to publish "${artifactName}" because package file "${packageFilePath}" already exists in GitLab generic package "${packageName}" version "${packageVersion}". Set "force" to true in your Forge publisher config to replace it.`,
              );
            }
          }

          await gitlab.uploadGenericPackageFile(
            projectId,
            packageName,
            packageVersion,
            packageFilePath,
            artifactPath,
          );

          const releaseLink = await gitlab.createReleaseLink(
            projectId,
            releaseName,
            {
              name: artifactName,
              url: packageUrl,
              direct_asset_path: directAssetPath,
              link_type: config.linkType || 'package',
            },
          );
          releaseLinks.push(releaseLink);
          return done();
        }),
      );
    }
  }
}

function resolveProjectId(config: PublisherGitLabConfig): string {
  if (config.projectId !== undefined && config.projectId !== null) {
    return GitLab.encodeProjectId(config.projectId);
  }

  if (
    config.repository &&
    typeof config.repository === 'object' &&
    config.repository.owner &&
    config.repository.name
  ) {
    return GitLab.encodeProjectId(
      GitLab.projectPath(config.repository.owner, config.repository.name),
    );
  }

  throw new Error(
    'In order to publish to GitLab, you must set either "projectId" or the "repository.owner" and "repository.name" properties in your Forge config.',
  );
}

function createReleasePayload(
  config: PublisherGitLabConfig,
  version: string,
  tagName: string,
): GitLabCreateReleasePayload {
  const payload: GitLabCreateReleasePayload = {
    tag_name: tagName,
    name: resolveTemplate(config.releaseName, version, tagName, tagName),
    description: resolveTemplate(
      config.description,
      version,
      tagName,
      `Release ${tagName}`,
    ),
  };
  const ref =
    config.ref || process.env.CI_COMMIT_SHA || process.env.CI_COMMIT_REF_NAME;

  if (ref) {
    payload.ref = ref;
  }
  if (config.tagMessage) {
    payload.tag_message = config.tagMessage;
  }
  if (config.milestones) {
    payload.milestones = config.milestones;
  }
  if (config.releasedAt) {
    payload.released_at = config.releasedAt;
  }

  return payload;
}

function resolveTemplate(
  value: GitLabTemplateValue | undefined,
  version: string,
  tagName: string,
  fallback: string,
): string {
  if (typeof value === 'function') {
    return value(version, tagName);
  }

  if (typeof value === 'string') {
    return value
      .replace(/\{version\}/g, version)
      .replace(/\{tagName\}/g, tagName);
  }

  return fallback;
}

function findExistingLink(
  links: GitLabReleaseLink[],
  artifactName: string,
  packageUrl: string,
  directAssetPath: string | undefined,
): GitLabReleaseLink | undefined {
  return links.find(
    (link) =>
      link.name === artifactName ||
      link.url === packageUrl ||
      (directAssetPath !== undefined &&
        link.direct_asset_path === directAssetPath),
  );
}

export { PublisherGitLab };
export type { PublisherGitLabConfig };
