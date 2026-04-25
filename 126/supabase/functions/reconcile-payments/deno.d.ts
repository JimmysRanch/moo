/* eslint-disable @typescript-eslint/no-explicit-any */

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export const createClient: (...args: unknown[]) => any;
}
