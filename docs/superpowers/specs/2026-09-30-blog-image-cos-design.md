# Blog Images: Direct Upload to COS

## Goal

Article covers, inline images, and gallery photos move from the server disk (served by nginx at
`/uploads/`) to the Tencent COS media bucket. Public links become
`https://img.shichiya.cn/blog/uploads/<filename>`. New images no longer touch the server disk;
when COS is not configured or an upload fails, the old local-disk behaviour is kept as fallback.

The Warframe bot already stores its attachments in the same bucket under the `blobs/` prefix,
so this reuses the same domain and credentials.

## Storage

- Bucket: `shichiya-media-1258357057` (ap-shanghai, public-read / private-write), shared with the bot
- Object key: `blog/uploads/<filename>`
- Filename keeps the current scheme `<timestamp>-<random><ext>` — the gallery deletes by
  `filename`, so the format must stay compatible
- Public URL: `https://img.shichiya.cn/blog/uploads/<filename>`

## Server changes (packages/server)

New `CosStorageService` (configuration via `@nestjs/config`):

- `save(originalname, buffer, mimetype)` → `{ filename, url }`
  COS first; on failure or when unconfigured, write to the local `uploads/` dir and return a
  `/uploads/...` URL
- `remove(filename, url)` → absolute URLs delete the COS object, otherwise unlink the local file

Upload endpoints switch to `memoryStorage` (same size/type limits) and go through the service:

- `POST /admin/upload` (article cover + inline images)
- `POST /admin/gallery` (gallery; `gallery_image.url` now stores an absolute URL)

The `/uploads` static handler in `main.ts` and the nginx `location /uploads/` stay in place as a
fallback and rollback path until the migration is done.

## Frontend changes (packages/frontend)

- `next.config`: add `images.remotePatterns` for `img.shichiya.cn` (required before `next/image`
  can render absolute URLs)
- Gallery admin "copy URL" must not prepend `window.location.origin` for absolute URLs

## Environment (packages/server/.env)

```
COS_SECRET_ID=...
COS_SECRET_KEY=...
COS_REGION=ap-shanghai
COS_MEDIA_BUCKET=shichiya-media-1258357057
COS_PUBLIC_BASE_URL=https://img.shichiya.cn
```

Reuses the existing CAM sub-user `shichiya-cos-backup` (policy already scoped to both buckets).

## Historical migration (one-off script)

1. `rclone copy /root/shichiya-blog/uploads cos:<media bucket>/blog/uploads`
2. Set object ACL to `public-read` — objects uploaded by rclone default to private, which
   overrides the bucket's public-read
3. Rewrite the database (`/uploads/` → `https://img.shichiya.cn/blog/uploads/`):
   - `article.content` (inline images)
   - `article.cover_image`
   - `gallery_image.url`
4. Keep the local `uploads/` directory until the switch proves stable

## Testing

- Unit tests for the pure helpers: object key / public URL building, filename generation
- Manual verification after deploy: upload from the admin panel returns an absolute URL that
  opens; deleting a gallery image removes the COS object; existing posts still render
