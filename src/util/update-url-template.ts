export interface GitLabUpdateUrlTemplateContext {
  arch: string;
  artifactName: string;
  gitlabBaseUrl: string;
  packageFileName: string;
  packageFilePath: string;
  packageName: string;
  packageVersion: string;
  platform: string;
  projectId: string;
  tagName: string;
  version: string;
}

export function renderUpdateUrlTemplate(
  template: string,
  context: GitLabUpdateUrlTemplateContext,
): string {
  const replacements: Record<string, string> = {
    arch: encodeURIComponent(context.arch),
    artifactName: encodeURIComponent(context.artifactName),
    gitlabBaseUrl: context.gitlabBaseUrl.replace(/\/+$/g, ''),
    packageFileName: encodeURIComponent(context.packageFileName),
    packageFilePath: encodePackageFilePath(context.packageFilePath),
    packageName: encodeURIComponent(context.packageName),
    packageVersion: encodeURIComponent(context.packageVersion),
    platform: encodeURIComponent(context.platform),
    projectId: context.projectId,
    tagName: encodeURIComponent(context.tagName),
    version: encodeURIComponent(context.version),
  };

  return template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (match, key) => {
    return replacements[key] ?? match;
  });
}

function encodePackageFilePath(packageFilePath: string): string {
  return packageFilePath
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}
