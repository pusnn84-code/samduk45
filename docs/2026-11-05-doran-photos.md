# Doran photos-only uploads

New posts/edits accept only photos (up to two) and text. The editor has one photo picker; feed/detail no longer expose a separate attachment/download area. Existing stored attachments are not bulk deleted; historical file download APIs remain private and integrity-checked.

Browser preparation happens before hashing, draft creation, or chunk transfer. Originals are limited to 30 MiB and decoded sequentially. Large images are fitted inside 1920 x 1920 without changing aspect ratio, encoded as WebP at quality 0.82 (JPEG fallback for browsers without WebP encoding), and bounded to 1 MiB through lower quality/resolution retries. An already small photo is retained only if re-encoding would increase its size and no resizing is needed. Originals stay on the user's device. Errors keep the existing selection and block accidental submission until acknowledged; large originals never silently bypass failed compression.

Server metadata validation rejects documents and photos above 1 MiB on both new-post and staged-edit entry points. The historical 6 MiB chunk boundary remains for reading existing files. Publication and edit commit decode every photo even with a text caption; an image extension alone is insufficient. No storage migration or bulk changes to historical posts are required.

Browser encoding support determines which HEIC/TIFF/other formats can be decoded. Unreadable formats receive a clear JPG/PNG conversion message. Animated inputs may become still images, as in the existing server preview.
