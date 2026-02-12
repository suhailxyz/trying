# Share section

The Share section reads a single index: **`share.json`**. That file lists the folder structure and every image under `assets/files/share/`. You don’t edit it by hand.

## Updating the index

After you add, remove, or move files or folders under `assets/files/share/`, update the index so the site matches the real folder structure:

- Use the instructions in **`_site-tools/update-share-index.md`** (or ask to “update share index” / “refresh share from assets”), or run **`node scripts/build-share-index.js`** from the repo root to regenerate the index from the current contents of `assets/files/share/`.

No per-folder `images.json` files. The index is the only generated file and must mirror the filesystem.

## Optional: password-protect a folder

In any folder under `assets/files/share/`, add a file named **`.share-folder.json`** with:

```json
{"protected": true, "password": "your-secret"}
```

When the index is regenerated, that folder will get `"protected": true` and `"password": "your-secret"` in `share.json`, and the Share UI will ask for the password before showing its contents.

## Image types

Only these extensions are included: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` (any case).
