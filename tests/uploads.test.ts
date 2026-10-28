import assert from "node:assert/strict";
import { test } from "node:test";
import { allPhotos, findFolder, folderHref, type Manifest } from "@/lib/manifest";
import { cosineDistance, familyFor, folderPathFor, mergeUploads, suggest, type NamedFolder, type Upload } from "@/lib/uploads";

const manifest: Manifest = {
  generatedAt: "2026-10-20T00:00:00+00:00",
  photos: { "1": { filename: "a.jpg", w: 1, h: 1, hash: "a" }, "2": { filename: "b.jpg", w: 1, h: 1, hash: "b" } },
  folders: [
    {
      name: "Hasan", path: "Hasan", photoIds: ["1", "2"],
      children: [{ name: "Shazia Hasan", path: "Hasan/Shazia Hasan", photoIds: ["1", "2"], children: [] }],
    },
  ],
};
const named: NamedFolder[] = [{ personId: 7, name: "Shazia Hasan", folderPath: "Hasan/Shazia Hasan" }];
const up = (id: string, who: string, tags: Upload["tags"], at = "2026-10-28T10:00:00Z"): Upload => ({
  id, who, filename: id + ".jpg", w: 10, h: 10, createdAt: at, tags,
});

test("cosineDistance is 0 for the same direction and 1 for orthogonal", () => {
  assert.equal(cosineDistance([1, 0], [2, 0]), 0);
  assert.equal(cosineDistance([1, 0], [0, 1]), 1);
});

test("suggest returns the nearest named people within the limit, one per name", () => {
  const c = [
    { personId: 1, name: "Near", vector: [1, 0.1] },
    { personId: 2, name: "Far", vector: [0, 1] },
    { personId: null, name: "near", vector: [1, 0.3] }, // a confirmed upload face of the same person
  ];
  const out = suggest([1, 0], c);
  assert.deepEqual(out.map((s) => s.name), ["Near"]);
  assert.equal(out[0].personId, 1);
});

test("familyFor uses the last word, or the whole name for bracketed and quoted names", () => {
  assert.equal(familyFor("Jane Q. Smith"), "Smith");
  assert.equal(familyFor("Mo (Smith)"), "Mo (Smith)");
});

test("folderPathFor prefers the exported person's folder, then a unique folder name, then a new folder", () => {
  assert.equal(folderPathFor({ name: "Shazia Hasan", personId: 7 }, manifest.folders, named), "Hasan/Shazia Hasan");
  assert.equal(folderPathFor({ name: "shazia hasan", personId: null }, manifest.folders, []), "Hasan/Shazia Hasan");
  assert.equal(folderPathFor({ name: "New Person", personId: null }, manifest.folders, []), "Person/New Person");
});

test("mergeUploads files a tagged upload in the person's folder and its ancestors, and lists it for its uploader", () => {
  const m = mergeUploads(manifest, [up("u0123456789ab", "Rob", [{ name: "Shazia Hasan", personId: 7 }])], named);
  assert.deepEqual(findFolder(m, ["Hasan", "Shazia Hasan"])?.photoIds, ["1", "2", "u0123456789ab"]);
  assert.deepEqual(findFolder(m, ["Hasan"])?.photoIds, ["1", "2", "u0123456789ab"]);
  assert.deepEqual(m.uploaders, { Rob: ["u0123456789ab"] });
  assert.equal(m.photos["u0123456789ab"].filename, "u0123456789ab.jpg");
  // the original manifest is untouched
  assert.deepEqual(manifest.folders[0].children[0].photoIds, ["1", "2"]);
});

test("a new person creates their family folder and their own folder", () => {
  const m = mergeUploads(manifest, [up("u0123456789ab", "Rob", [{ name: "Jo Park", personId: null }, { name: "Ann Park", personId: null }])], named);
  const park = findFolder(m, ["Park"]);
  assert.deepEqual(park?.children.map((c) => c.name), ["Jo Park", "Ann Park"]);
  assert.deepEqual(park?.photoIds, ["u0123456789ab"]);
  assert.deepEqual(findFolder(m, ["Park", "Jo Park"])?.photoIds, ["u0123456789ab"]);
});

test("an untagged upload is only in All photos and its uploader's list; All photos puts uploads last", () => {
  const m = mergeUploads(manifest, [up("u0123456789ab", "Rob", [])], named);
  assert.deepEqual(allPhotos(m).photoIds, ["1", "2", "u0123456789ab"]);
  assert.deepEqual(findFolder(m, ["~u", "Rob"])?.photoIds, ["u0123456789ab"]);
  assert.equal(folderHref("~u/Rob"), "/uploads/Rob");
});
