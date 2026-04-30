import type {
  GitLabDirectAssetPathContext,
  GitLabDirectAssetPathPrefix,
} from '../Config';

const DEFAULT_DIRECT_ASSET_PATH_PREFIX = '/artifacts';

export function resolveDirectAssetPathPrefix(
  directAssetPathPrefix: GitLabDirectAssetPathPrefix | undefined,
  context: GitLabDirectAssetPathContext,
): string | false {
  const value =
    typeof directAssetPathPrefix === 'function'
      ? directAssetPathPrefix(context)
      : directAssetPathPrefix;

  if (value === false) {
    return false;
  }

  return renderDirectAssetPathPrefix(
    value ?? DEFAULT_DIRECT_ASSET_PATH_PREFIX,
    context,
  );
}

export function renderDirectAssetPathPrefix(
  value: string,
  context: GitLabDirectAssetPathContext,
): string {
  const replacements: Record<string, string> = {
    arch: context.makeResult.arch,
    artifactName: context.artifactName,
    packageFileName: context.packageFileName,
    packageName: context.packageName,
    packageVersion: context.packageVersion,
    platform: context.makeResult.platform,
    tagName: context.tagName,
    version: context.version,
  };

  return value.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (match, key) => {
    return replacements[key] ?? match;
  });
}
