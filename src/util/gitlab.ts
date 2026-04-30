import path from 'node:path';

import debug from 'debug';
import fs from 'fs-extra';
import mime from 'mime-types';
import fetch, { HeadersInit, RequestInit } from 'node-fetch';

import { GitLabAuthHeader } from '../Config';

const logDebug = debug('electron-forge:publisher:gitlab:debug');

export interface GitLabClientOptions {
  apiUrl?: string;
  authHeader?: GitLabAuthHeader;
}

export interface GitLabRelease {
  tag_name: string;
  name?: string;
  description?: string;
  assets?: {
    links?: GitLabReleaseLink[];
  };
}

export interface GitLabCreateReleasePayload {
  tag_name: string;
  name?: string;
  description?: string;
  ref?: string;
  tag_message?: string;
  milestones?: string[];
  released_at?: string;
}

export interface GitLabReleaseLink {
  id: number;
  name: string;
  url: string;
  direct_asset_path?: string;
  direct_asset_url?: string;
  link_type?: string;
}

export interface GitLabCreateReleaseLinkPayload {
  name: string;
  url: string;
  direct_asset_path?: string;
  link_type?: string;
}

export interface GitLabPackage {
  id: number;
  name: string;
  version?: string;
  package_type: string;
}

export interface GitLabPackageFile {
  id: number;
  package_id: number;
  file_name: string;
}

interface GitLabRequestOptions extends RequestInit {
  expectedStatuses?: number[];
  json?: unknown;
  searchParams?: Record<string, boolean | number | string | undefined>;
}

export class GitLabError extends Error {
  status: number;

  statusText: string;

  body: string;

  url: string;

  constructor(status: number, statusText: string, body: string, url: string) {
    super(
      `Unexpected response from GitLab: ${status} ${statusText}\n\nURL: ${url}\n\nBody:\n${body}`,
    );
    this.status = status;
    this.statusText = statusText;
    this.body = body;
    this.url = url;
  }
}

export default class GitLab {
  private apiUrl: string;

  private authHeader: GitLabAuthHeader;

  token?: string;

  constructor(
    authToken: string | undefined = undefined,
    requireAuth = false,
    options: GitLabClientOptions = {},
  ) {
    const tokenFromEnv =
      env('GITLAB_TOKEN') || env('GITLAB_PRIVATE_TOKEN') || env('CI_JOB_TOKEN');

    this.token = authToken || tokenFromEnv;
    this.authHeader =
      options.authHeader ||
      (authToken || env('GITLAB_TOKEN') || env('GITLAB_PRIVATE_TOKEN')
        ? 'PRIVATE-TOKEN'
        : env('CI_JOB_TOKEN')
          ? 'JOB-TOKEN'
          : 'PRIVATE-TOKEN');
    this.apiUrl = GitLab.normalizeApiUrl(
      options.apiUrl || env('CI_API_V4_URL') || 'https://gitlab.com/api/v4',
    );

    if (requireAuth && !this.token) {
      throw new Error(
        'Please set GITLAB_TOKEN or CI_JOB_TOKEN in your environment to access these features',
      );
    }
  }

  async getRelease(
    projectId: string,
    tagName: string,
  ): Promise<GitLabRelease | undefined> {
    try {
      return await this.request<GitLabRelease>(
        `projects/${projectId}/releases/${encodeURIComponent(tagName)}`,
      );
    } catch (err) {
      if (err instanceof GitLabError && err.status === 404) {
        return undefined;
      }
      throw err;
    }
  }

  async createRelease(
    projectId: string,
    release: GitLabCreateReleasePayload,
  ): Promise<GitLabRelease> {
    return this.request<GitLabRelease>(`projects/${projectId}/releases`, {
      method: 'POST',
      json: release,
    });
  }

  async listReleaseLinks(
    projectId: string,
    tagName: string,
  ): Promise<GitLabReleaseLink[]> {
    return this.request<GitLabReleaseLink[]>(
      `projects/${projectId}/releases/${encodeURIComponent(tagName)}/assets/links`,
      {
        searchParams: {
          per_page: 100,
        },
      },
    );
  }

  async createReleaseLink(
    projectId: string,
    tagName: string,
    link: GitLabCreateReleaseLinkPayload,
  ): Promise<GitLabReleaseLink> {
    return this.request<GitLabReleaseLink>(
      `projects/${projectId}/releases/${encodeURIComponent(tagName)}/assets/links`,
      {
        method: 'POST',
        json: link,
      },
    );
  }

  async deleteReleaseLink(
    projectId: string,
    tagName: string,
    linkId: number,
  ): Promise<void> {
    await this.request<void>(
      `projects/${projectId}/releases/${encodeURIComponent(tagName)}/assets/links/${linkId}`,
      {
        method: 'DELETE',
      },
    );
  }

  async uploadGenericPackageFile(
    projectId: string,
    packageName: string,
    packageVersion: string,
    packageFilePath: string,
    filePath: string,
  ): Promise<void> {
    const stat = await fs.stat(filePath);

    await this.request<void>(
      `projects/${projectId}/packages/generic/${encodeURIComponent(packageName)}/${encodeURIComponent(packageVersion)}/${GitLab.encodePackageFilePath(packageFilePath)}`,
      {
        method: 'PUT',
        body: fs.createReadStream(filePath) as RequestInit['body'],
        headers: {
          'content-length': String(stat.size),
          'content-type': mime.lookup(filePath) || 'application/octet-stream',
        },
        expectedStatuses: [201],
      },
    );
  }

  async uploadGenericPackageContent(
    projectId: string,
    packageName: string,
    packageVersion: string,
    packageFilePath: string,
    content: Buffer | string,
    contentType = 'application/octet-stream',
  ): Promise<void> {
    await this.request<void>(
      `projects/${projectId}/packages/generic/${encodeURIComponent(packageName)}/${encodeURIComponent(packageVersion)}/${GitLab.encodePackageFilePath(packageFilePath)}`,
      {
        method: 'PUT',
        body: content as RequestInit['body'],
        headers: {
          'content-length': String(Buffer.byteLength(content)),
          'content-type': contentType,
        },
        expectedStatuses: [201],
      },
    );
  }

  genericPackageFileUrl(
    projectId: string,
    packageName: string,
    packageVersion: string,
    packageFilePath: string,
  ): string {
    return this.makeUrl(
      `projects/${projectId}/packages/generic/${encodeURIComponent(packageName)}/${encodeURIComponent(packageVersion)}/${GitLab.encodePackageFilePath(packageFilePath)}`,
    );
  }

  releaseAssetDownloadUrl(
    projectId: string,
    release: string,
    directAssetPath: string,
  ): string {
    const releasePath =
      release === 'permalink/latest' ? release : encodeURIComponent(release);

    return this.makeUrl(
      `projects/${projectId}/releases/${releasePath}/downloads/${GitLab.encodePackageFilePath(directAssetPath)}`,
    );
  }

  async listGenericPackages(
    projectId: string,
    packageName: string,
    packageVersion: string,
  ): Promise<GitLabPackage[]> {
    const packages = await this.request<GitLabPackage[]>(
      `projects/${projectId}/packages`,
      {
        searchParams: {
          package_type: 'generic',
          package_name: packageName,
          package_version: packageVersion,
          per_page: 100,
        },
      },
    );

    return packages.filter(
      (pkg) =>
        pkg.package_type === 'generic' &&
        pkg.name === packageName &&
        pkg.version === packageVersion,
    );
  }

  async listPackageFiles(
    projectId: string,
    packageId: number,
  ): Promise<GitLabPackageFile[]> {
    return this.request<GitLabPackageFile[]>(
      `projects/${projectId}/packages/${packageId}/package_files`,
      {
        searchParams: {
          per_page: 100,
        },
      },
    );
  }

  async listGenericPackageFiles(
    projectId: string,
    packageName: string,
    packageVersion: string,
  ): Promise<GitLabPackageFile[]> {
    const packages = await this.listGenericPackages(
      projectId,
      packageName,
      packageVersion,
    );
    const packageFiles = await Promise.all(
      packages.map((pkg) => this.listPackageFiles(projectId, pkg.id)),
    );

    return packageFiles.flat();
  }

  async deletePackageFile(
    projectId: string,
    packageId: number,
    packageFileId: number,
  ): Promise<void> {
    await this.request<void>(
      `projects/${projectId}/packages/${packageId}/package_files/${packageFileId}`,
      {
        method: 'DELETE',
        expectedStatuses: [204],
      },
    );
  }

  static normalizeApiUrl(apiUrl: string): string {
    return apiUrl.replace(/\/+$/g, '');
  }

  static encodeProjectId(projectId: string | number): string {
    return encodeURIComponent(String(projectId));
  }

  static projectPath(owner: string, name: string): string {
    return `${owner}/${name}`;
  }

  static sanitizePackageFileName(name: string): string {
    const sanitized = path
      .basename(name)
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^A-Za-z0-9._+~@-]+/g, '.')
      .replace(/\.+/g, '.')
      .replace(/^[~@.]+/g, '')
      .replace(/[~@.]+$/g, '');

    return sanitized || 'artifact';
  }

  static packageFilePath(prefix: string, fileName: string): string {
    return path.posix.join(prefix.replace(/^\/+|\/+$/g, ''), fileName);
  }

  static encodePackageFilePath(filePath: string): string {
    return filePath
      .split('/')
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join('/');
  }

  static directAssetPath(prefix: string, fileName: string): string {
    const normalizedPrefix = prefix.trim() || '/artifacts';
    return path.posix.join(
      `/${normalizedPrefix.replace(/^\/+|\/+$/g, '')}`,
      fileName,
    );
  }

  private async request<T>(
    endpoint: string,
    options: GitLabRequestOptions = {},
  ): Promise<T> {
    const {
      expectedStatuses,
      headers,
      json,
      searchParams,
      ...fetchOptions
    } = options;
    const requestHeaders: Record<string, string> = {
      Accept: 'application/json',
      ...this.authHeaders(),
      ...normalizeHeaders(headers),
    };

    if (json !== undefined) {
      requestHeaders['content-type'] = 'application/json';
      fetchOptions.body = JSON.stringify(json);
    }

    const url = this.makeUrl(endpoint, searchParams);
    logDebug(`${fetchOptions.method || 'GET'} ${url}`);

    const response = await fetch(url, {
      ...fetchOptions,
      headers: requestHeaders,
    });
    const expected = expectedStatuses
      ? expectedStatuses.includes(response.status)
      : response.ok;

    if (!expected) {
      throw new GitLabError(
        response.status,
        response.statusText,
        await response.text(),
        url,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    if (!text) {
      return undefined as T;
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return JSON.parse(text) as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      return text as T;
    }
  }

  private makeUrl(
    endpoint: string,
    searchParams: GitLabRequestOptions['searchParams'] = {},
  ): string {
    const url = new URL(`${this.apiUrl}/${endpoint.replace(/^\/+/g, '')}`);

    for (const [key, value] of Object.entries(searchParams || {})) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    return url.toString();
  }

  private authHeaders(): Record<string, string> {
    if (!this.token) {
      return {};
    }

    return {
      [this.authHeader]: this.token,
    };
  }
}

function env(name: string): string | undefined {
  return process.env[name] || undefined;
}

function normalizeHeaders(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) {
    return {};
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers.map(([key, value]) => [key, String(value)]));
  }

  if (typeof (headers as { forEach?: unknown }).forEach === 'function') {
    const normalized: Record<string, string> = {};
    (headers as { forEach: (callback: (value: string, key: string) => void) => void }).forEach(
      (value, key) => {
        normalized[key] = value;
      },
    );
    return normalized;
  }

  return Object.fromEntries(
    Object.entries(headers as Record<string, string | number>).map(
      ([key, value]) => [key, String(value)],
    ),
  );
}
