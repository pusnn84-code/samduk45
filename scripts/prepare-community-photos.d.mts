export interface PhotoMigrationClient {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}
export type PhotoMigrationResult =
  | { status: "already-ready" }
  | { status: "upgraded"; counts: Record<string, string> };
export function upgradeCommunityPhotoSchema(client: PhotoMigrationClient): Promise<PhotoMigrationResult>;
export function prepareProductionPhotos(env?: {
  VERCEL_ENV?: string;
  DATABASE_URL?: string;
}): Promise<PhotoMigrationResult | { status: "skipped" }>;
