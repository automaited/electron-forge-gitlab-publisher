import { describe, expect, it } from 'vitest';

import {
  renderDirectAssetPathPrefix,
  resolveDirectAssetPathPrefix,
} from '../../src/util/direct-asset-path';

const context = {
  artifactName: 'RELEASES.json',
  artifactPath: '/tmp/out/RELEASES.json',
  makeResult: {
    arch: 'arm64',
    artifacts: ['/tmp/out/RELEASES.json'],
    packageJSON: {
      version: '1.2.3',
    },
    platform: 'darwin',
  },
  packageFileName: 'RELEASES.json',
  packageName: 'release-assets',
  packageVersion: '1.2.3',
  tagName: 'v1.2.3',
  version: '1.2.3',
} as const;

describe('direct asset path templates', () => {
  it('renders platform and arch placeholders', () => {
    expect(renderDirectAssetPathPrefix('{platform}/{arch}', context)).toEqual(
      'darwin/arm64',
    );
  });

  it('renders artifact and release placeholders', () => {
    expect(
      renderDirectAssetPathPrefix(
        '{version}/{tagName}/{packageName}/{packageVersion}/{artifactName}/{packageFileName}',
        context,
      ),
    ).toEqual(
      '1.2.3/v1.2.3/release-assets/1.2.3/RELEASES.json/RELEASES.json',
    );
  });

  it('keeps unknown placeholders unchanged', () => {
    expect(renderDirectAssetPathPrefix('{channel}/{platform}', context)).toEqual(
      '{channel}/darwin',
    );
  });

  it('uses the default artifacts prefix when unset', () => {
    expect(resolveDirectAssetPathPrefix(undefined, context)).toEqual(
      '/artifacts',
    );
  });

  it('supports function prefixes with per-artifact context', () => {
    expect(
      resolveDirectAssetPathPrefix(
        ({ makeResult }) => `${makeResult.platform}/${makeResult.arch}`,
        context,
      ),
    ).toEqual('darwin/arm64');
  });

  it('supports omitting direct asset paths', () => {
    expect(resolveDirectAssetPathPrefix(false, context)).toBe(false);
    expect(resolveDirectAssetPathPrefix(() => false, context)).toBe(false);
  });
});
