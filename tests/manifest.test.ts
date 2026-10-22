import assert from "node:assert/strict";
import { test } from "node:test";
import { dedupeNames, findFolder, folderHref, zipEntries, zipName, type Manifest } from "@/lib/manifest";

const manifest: Manifest = {
  generatedAt: "2026-10-20T00:00:00+00:00",
  photos: {
    "1": { filename: "IMG_1.jpg", w: 10, h: 10, hash: "a" },
    "2": { filename: "IMG_1.JPG", w: 10, h: 10, hash: "b" },
    "3": { filename: "beach.heic", w: 10, h: 10, hash: "c" },
  },
  folders: [
    {
      name: "Hasan",
      path: "Hasan",
      photoIds: ["1", "2", "3"],
      children: [
        { name: 'Shahnaz "Bubba" Hasan', path: 'Hasan/Shahnaz "Bubba" Hasan', photoIds: ["1", "2"], children: [] },
        { name: "Abid Hasan", path: "Hasan/Abid Hasan", photoIds: ["1", "3"], children: [] },
      ],
    },
    { name: "No Faces", path: "No Faces", photoIds: ["3"], children: [] },
  ],
};

test("findFolder walks family then person", () => {
  assert.equal(findFolder(manifest, ["Hasan"])?.name, "Hasan");
  assert.equal(findFolder(manifest, ["Hasan", "Abid Hasan"])?.photoIds.length, 2);
  assert.equal(findFolder(manifest, ["Hasan", 'Shahnaz "Bubba" Hasan'])?.photoIds.length, 2);
  assert.equal(findFolder(manifest, ["Abid Hasan"]), null);
  assert.equal(findFolder(manifest, ["Nope"]), null);
});

test("folderHref encodes each segment", () => {
  assert.equal(folderHref('Hasan/Shahnaz "Bubba" Hasan'), "/f/Hasan/Shahnaz%20%22Bubba%22%20Hasan");
});

test("dedupeNames makes clashing names unique and always .jpg", () => {
  const names = dedupeNames([
    { id: "1", name: "IMG_1.jpg" },
    { id: "2", name: "IMG_1.JPG" },
    { id: "3", name: "beach.heic" },
    { id: "4", name: "IMG_1.png" },
  ]).map((e) => e.name);
  assert.deepEqual(names, ["IMG_1.jpg", "IMG_1 (2).jpg", "beach.jpg", "IMG_1 (3).jpg"]);
});

test("a family zip has one subfolder per person", () => {
  const names = zipEntries(manifest, findFolder(manifest, ["Hasan"])!).map((e) => e.name);
  assert.deepEqual(names, [
    'Shahnaz "Bubba" Hasan/IMG_1.jpg',
    'Shahnaz "Bubba" Hasan/IMG_1 (2).jpg',
    "Abid Hasan/IMG_1.jpg",
    "Abid Hasan/beach.jpg",
  ]);
});

test("a person zip is flat", () => {
  const names = zipEntries(manifest, findFolder(manifest, ["No Faces"])!).map((e) => e.name);
  assert.deepEqual(names, ["beach.jpg"]);
});

test("zipName strips characters that aren't allowed in filenames", () => {
  assert.equal(zipName(findFolder(manifest, ["Hasan", 'Shahnaz "Bubba" Hasan'])!), "Shahnaz Bubba Hasan.zip");
});

test("search finds people by nickname, ignoring quotes and case, and ranks word starts first", async () => {
  const { searchIndex, searchFolders } = await import("@/lib/manifest");
  const index = searchIndex(manifest);
  assert.equal(index.length, 4);
  assert.deepEqual(searchFolders(index, "bubba").map((i) => i.name), ['Shahnaz "Bubba" Hasan']);
  assert.equal(searchFolders(index, "bubba")[0].family, "Hasan");
  assert.deepEqual(searchFolders(index, "HASAN").map((i) => i.name)[0], "Hasan");
  assert.deepEqual(searchFolders(index, "abid has").map((i) => i.name), ["Abid Hasan"]);
  assert.deepEqual(searchFolders(index, "   "), []);
  assert.deepEqual(searchFolders(index, "zzz"), []);
});

test("All photos lists every photo once and works as a viewer source", async () => {
  const { allPhotos, ALL_PATH } = await import("@/lib/manifest");
  assert.deepEqual(allPhotos(manifest).photoIds, ["1", "2", "3"]);
  assert.equal(findFolder(manifest, [ALL_PATH])?.name, "All photos");
  assert.equal(folderHref(ALL_PATH), "/all");
  assert.equal(zipEntries(manifest, allPhotos(manifest)).length, 3);
});

const nested: Manifest = {
  generatedAt: "2026-10-21T00:00:00+00:00",
  photos: {
    "1": { filename: "a.jpg", w: 1, h: 1, hash: "1" },
    "2": { filename: "b.jpg", w: 1, h: 1, hash: "2" },
    "3": { filename: "c.jpg", w: 1, h: 1, hash: "3" },
    "4": { filename: "d.jpg", w: 1, h: 1, hash: "4" },
  },
  folders: [
    { name: "Places and Locations", path: "Places and Locations", photoIds: ["4", "3", "2"], children: [], section: "bottom" },
    { name: "Famous Figures", path: "Famous Figures", photoIds: ["4"], children: [], section: "bottom" },
    { name: "Azhar", path: "Azhar", photoIds: ["1"], children: [] },
    {
      name: "Hasan",
      path: "Hasan",
      photoIds: ["1", "2", "3"],
      children: [
        {
          name: "Shazia Hasan",
          path: "Hasan/Shazia Hasan",
          photoIds: ["1", "2"],
          own: ["1"],
          children: [{ name: "First Haircut", path: "Hasan/Shazia Hasan/First Haircut", photoIds: ["2"], children: [] }],
        },
        {
          name: "Friends",
          path: "Hasan/Friends",
          photoIds: ["3"],
          children: [
            {
              name: "Hamilton",
              path: "Hasan/Friends/Hamilton",
              photoIds: ["3"],
              children: [{ name: "John Hamilton", path: "Hasan/Friends/Hamilton/John Hamilton", photoIds: ["3"], children: [] }],
            },
          ],
        },
      ],
    },
  ],
};

test("home puts families largest first, then the bottom section largest first", async () => {
  const { homeSections } = await import("@/lib/manifest");
  const { families, bottom } = homeSections(nested);
  assert.deepEqual(families.map((f) => f.name), ["Hasan", "Azhar"]);
  assert.deepEqual(bottom.map((f) => f.name), ["Places and Locations", "Famous Figures"]);
});

test("byCount sorts by photo count, then name", async () => {
  const { byCount } = await import("@/lib/manifest");
  const kids = findFolder(nested, ["Hasan"])!.children;
  assert.deepEqual(byCount(kids).map((f) => f.name), ["Shazia Hasan", "Friends"]);
});

test("a nested zip mirrors every level, with a folder's own photos at its top", () => {
  const names = zipEntries(nested, findFolder(nested, ["Hasan"])!).map((e) => e.name);
  assert.deepEqual(names, [
    "Shazia Hasan/a.jpg",
    "Shazia Hasan/First Haircut/b.jpg",
    "Friends/Hamilton/John Hamilton/c.jpg",
  ]);
});

test("findFolder, search and labels work at any depth", async () => {
  const { searchIndex, searchFolders, childLabel } = await import("@/lib/manifest");
  assert.equal(findFolder(nested, ["Hasan", "Friends", "Hamilton", "John Hamilton"])?.photoIds[0], "3");
  const hit = searchFolders(searchIndex(nested), "john")[0];
  assert.equal(hit.path, "Hasan/Friends/Hamilton/John Hamilton");
  assert.equal(hit.family, "Hamilton");
  assert.equal(childLabel(findFolder(nested, ["Hasan"])!), "albums");
  assert.equal(childLabel(findFolder(nested, ["Hasan", "Friends", "Hamilton"])!), "people");
  assert.equal(childLabel(findFolder(nested, ["Hasan", "Shazia Hasan"])!), "albums");
});

test("byName sorts A–Z ignoring case and quotes", async () => {
  const { byName } = await import("@/lib/manifest");
  const f = (name: string) => ({ name, path: name, photoIds: [], children: [] });
  assert.deepEqual(
    byName([f("zaidi"), f('"Ashu" Ahmed'), f("Abid Hasan"), f("Bokhari")]).map((x) => x.name),
    ["Abid Hasan", '"Ashu" Ahmed', "Bokhari", "zaidi"],
  );
});

test("mergeAlbums folds an album's photos into its parent", async () => {
  const { mergeAlbums } = await import("@/lib/manifest");
  const m: Manifest = {
    ...manifest,
    folders: [
      {
        name: "Hasan",
        path: "Hasan",
        photoIds: ["1", "2"],
        own: ["1"],
        children: [{ name: "Haircut", path: "Hasan/Haircut", photoIds: ["2"], children: [] }],
      },
    ],
  };
  const out = mergeAlbums(m, ["Hasan/Haircut"]).folders[0];
  assert.equal(out.children.length, 0);
  assert.deepEqual(out.own, ["1", "2"]);
  assert.deepEqual(out.photoIds, ["1", "2"]);
});
