export const BUCKET_LINKS_CHANGED = 'bucket.linksChanged';

export interface BucketLinksChangedPayload {
  affectedSystemIds: string[];
}
