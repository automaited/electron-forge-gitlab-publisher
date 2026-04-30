import { describe, expect, it } from 'vitest';

import { createDarwinUpdateFeed } from '../../src/util/darwin-update-feed';

describe('darwin update feed', () => {
  it('creates a Squirrel.Mac releases manifest for the ZIP artifact', () => {
    expect(
      createDarwinUpdateFeed({
        appName: 'Desktop App',
        pubDate: '2026-04-30T12:00:00.000Z',
        url: 'https://gitlab.example.com/api/v4/projects/1/releases/permalink/latest/downloads/darwin/arm64/Desktop.App.zip',
        version: '1.2.3',
      }),
    ).toEqual({
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
  });
});
