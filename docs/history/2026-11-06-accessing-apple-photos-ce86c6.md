# Accessing Apple Photos

Date: 2026-11-06. Exported from a local Claude chat in the old workspace folder.

**Rob:** Can you access this computers Photos from apple? If not, what is needed to access?

**Claude:** I'll check whether this session can read the Photos library.

**Claude:** Yes, partly. I can reach your Apple Photos library by scripting the Photos app, and it reports **19,361 photos and videos**. What I can't do is read the library's files on disk directly, because macOS blocks that by default.

**What works now (through the Photos app):**
- Count, list and search items by date, filename, keywords, favorites, title and description
- List albums and folders, and make or add to albums
- Export originals or edited copies to a folder (for example, to feed `family_facial_recognition/` or `family_photos/`)

Photos may open in the background while I do this. It's also slow for big batches, so exporting thousands of items takes a while.

**What's blocked:**
- Reading the library's internal database and original files directly, which is faster and includes extras like people/face names, places, and the original files without exporting them.

**To unlock direct access, you'd need to:**
1. Open **System Settings → Privacy & Security → Full Disk Access**.
2. Turn it on for the app this session runs in (the Claude desktop app). Click **+** and add it if it isn't listed.
3. Quit and reopen Claude.
4. Optionally, I can install `osxphotos`, a free open-source command-line tool. It reads the Photos database quickly and handles exports with people and place details.

macOS only lets you change that privacy setting yourself, so I can't flip it for you.

Tell me what you want to do with the photos. For a lot of tasks, scripting the Photos app is enough and needs no setup.

**Rob:** Use facial recoginition to find all photos of a dog, then copy (not move) all photos into a folder on the desktop called Issa

**Claude:** There's already an album named "Issa", so I'll compare it with the "dog" search results.

**Claude:** The Issa album and the "dog" search only partly overlap. I'll look at a few "dog" photos that aren't in the album to see whether they show Issa or other dogs.

**Claude:** I haven't copied anything yet. The way I can search Photos right now finds dogs in general, not Issa specifically, so I need you to pick an approach first.

**What I found:**
- **Your "Issa" album:** 861 photos and videos. The samples I checked are all Issa, the fawn greyhound.
- **Apple's "dog" search:** 1,053 items, and only 456 of them are in your Issa album. In a sample of the other 597, most looked like Issa, so your album is missing a lot of her photos. One was a golden retriever, so other dogs are in there too.
- **All 1,472 combined:** this would get nearly every Issa photo, plus some other dogs.

**Your options:**
1. **Copy all 1,472.** This works now, and you'd delete the few other dogs from the folder by hand.
2. **Use Apple's own pet face recognition.** Photos can recognize Issa's face, but I can only read those matches if you turn on Full Disk Access for the Claude app (System Settings → Privacy & Security → Full Disk Access). It only helps if Issa is already named under People & Pets in Photos. This would give the cleanest result.
3. **Match against your album myself.** I'd compare each "dog" photo to the 861 album photos and keep only the ones that look like Issa. It needs no settings change, but it's slower to build and won't be perfect.

Either way, the copies go to `~/Desktop/Issa`. Your Photos library won't change. Your Desktop syncs to iCloud, so about 1,500 photos and videos will take up iCloud space and take a while to upload.

**Rob:** Grant Full Disk Access

**Claude:** Full Disk Access isn't on yet. I just checked, and the Photos database is still blocked. macOS only lets you change this setting yourself:

1. Open **System Settings → Privacy & Security → Full Disk Access**.
2. Turn on **Claude**. If it isn't listed, click **+**, pick Claude from Applications, then turn it on.
3. Quit Claude completely (Cmd+Q) and reopen it. The new access only applies after a restart.
4. Come back to this session and say you're done.

While you're at it, check that Issa is named in the Photos app under **People & Pets**. If she isn't, open her face there and give it the name "Issa". Photos will then group her photos for me to find.

Once you're back, I'll install `osxphotos` (a free open-source tool), find every photo Photos has matched to Issa's face, and copy them to `~/Desktop/Issa`. Your Photos library won't change.

**Rob:** Done, it's on

**Claude:** Understood. I'll search your whole library (All Photos) for Issa, not just the album, and copy the matches into the Issa folder on your Desktop. Installing the photo tool now.

**Claude:** The tool install was blocked by a safety check, so I'll read the Photos database directly with macOS's built-in `sqlite3`, in read-only mode.

**Claude:** No one is named "Issa" in People & Pets. I'll check whether Photos has an unnamed pet group for her.

**Claude:** Photos has one large pet group: 1,148 face matches, confirmed but unnamed. That's almost certainly Issa. I'll check it against your album to be sure.

**Claude:** The export is running in the background, 40 items per batch across 43 batches. Originals stored only in iCloud have to download first, so this may take a while. When it finishes, I'll move everything into `~/Desktop/Issa` and check the file count.

**Claude:** I copied 1,692 photos and videos of Issa into [~/Desktop/Issa](../Issa). That's 1,948 files and 5.5 GB. Your Photos library and albums are unchanged.

**How I found them, searching your whole library:**
- **1,482 items from Apple's own pet face recognition.** Photos had already grouped Issa's face; the group just didn't have a name. I checked a random sample and every one was Issa.
- **210 more items from your Issa album.** Photos hadn't matched these, probably because her face isn't clearly visible.
- **Left out:** two small groups of other dogs, a shiba-type and a cattle dog.

**About the files:**
- They're full-quality originals, not compressed copies.
- There are more files than photos because Live Photos come out as a photo plus a short video clip.
- 72 photos had the same filename as another photo, so I renamed them `name (1).jpg` instead of overwriting anything.
- There are also 72 small `.aae` files. These are Apple's records of edits you made, and you can delete them if you like.

The folder is on your Desktop, so it will sync to iCloud and use about 5.5 GB of iCloud storage. If you want Photos to recognize her by name from now on, go to People & Pets in the Photos app and name her group "Issa".

