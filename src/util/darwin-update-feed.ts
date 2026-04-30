export interface DarwinUpdateFeed {
  currentRelease: string;
  releases: DarwinUpdateFeedRelease[];
}

export interface DarwinUpdateFeedRelease {
  version: string;
  updateTo: {
    version: string;
    pub_date: string;
    name: string;
    url: string;
  };
}

export interface CreateDarwinUpdateFeedOptions {
  appName: string;
  pubDate: string;
  url: string;
  version: string;
}

export function createDarwinUpdateFeed({
  appName,
  pubDate,
  url,
  version,
}: CreateDarwinUpdateFeedOptions): DarwinUpdateFeed {
  return {
    currentRelease: version,
    releases: [
      {
        version,
        updateTo: {
          version,
          pub_date: pubDate,
          name: `${appName} v${version}`,
          url,
        },
      },
    ],
  };
}
