# (1412) Lucky Draw prize gallery upload and ordering

In Urus Lucky Draw > Hadiah & Cabutan, drag image files into the gallery or use
Pilih gambar. Existing photos and new files appear in one list. Drag cards to
reorder, use the left/right buttons on touch or keyboard, use the star to choose
the main image, and remove unwanted cards with the cross. The first image is the
public gallery cover. Simpan hadiah publishes the title, description and gallery.

Changes remain a draft until saved. Cancel restores the loaded images. Failed
saves retain new files and order for retry. Each save supports up to 10 new files
(5 MB each; JPG, PNG, WebP, GIF, AVIF) and up to 50 total gallery images. Browser
previews validate the image; the backend checks the uploaded image metadata.
New and retained images can be mixed in any order, and an empty list explicitly
removes the gallery. Removing a card does not delete the original cloud object.

An explicit galleryOrder multipart manifest resolves uploads to their positions;
old URL/JSON values cannot override it. Legacy clients retain their former flow.
The client checks galleryProtocol 1 before sending files, preserving drafts
while the independent Lucky Draw backend deployment catches up. Existing admin
authorization remains required. Unique upload filenames avoid collisions.

Existing Cloudinary deployment settings are reused. If Cloudinary is unavailable,
the existing backend upload fallback remains and the admin sees a temporary
storage warning. No new secrets, external bucket, payment, participation or draw
changes are introduced. This does not regenerate the static social share artwork;
that preview is updated separately when the prize changes.

Full website ZIP only; QA fixtures and credentials are excluded.
