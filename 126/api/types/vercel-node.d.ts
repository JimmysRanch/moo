declare module "@vercel/node" {
  export type VercelRequest = {
    method?: string;
    headers: Record<string, string | string[] | undefined>;
    body?: unknown;
    query: Record<string, string | string[] | undefined>;
    [Symbol.asyncIterator]?: () => AsyncIterator<string | Buffer>;
    [key: string]: unknown;
  };

  export type VercelResponse = {
    status(code: number): VercelResponse;
    json(body: unknown): VercelResponse;
    [key: string]: unknown;
  };
}
