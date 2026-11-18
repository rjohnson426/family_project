# Family photo organization and storage

Date: 2026-10-20. Exported from a local Claude chat in the old workspace folder.

**Rob:** Family facial recognition has reached it's first milestone, the mapping and recognition work has been completed. 
---
Next Phase: Storage and distribution

* Create a new folder on my desktop called Organized Family Photos
* Within folder, create subfolders for grouping of people based on their last name (the last word in their name)
   * Within these folders include a folder for each person who matches the last name
   * Note: For those ending in () or "" have one folder for each. 
   * Note: Hassan and Hasan are separate families 
   * Create a folder for photos without faces
   * You do not need to account for those of people that were skipped. 
* Once these folders are created and photos are added, I would like you to generate the same in a google drive folder of the same name
* Ask here if you have questions about grouping or organization
* All grouping should be saved in git, but if not, deploy any changes when complete

**Claude:** Now the named people and photo counts, straight from the database:

**Claude:** I've checked the database: 135 named people, about 6,150 person-photo placements (2,983 unique photos), plus 426 photos with no people. A few things need your call before I build it.

**Claude:** Got it: own folders for non-surnames, keep variants separate, no-people photos only, and 3,000px JPEG copies. Next I'm checking the source file formats and basename collisions.

**Claude:** The plan matches your rules. Next I'm running the build in the background. It resizes about 3,400 photos once, then clones them into the folders.

**Claude:** While that runs, I'm adding the new command to the README.

**Claude:** The build is moving. Next I'm checking that a resized copy kept the people tags.

**Claude:** The resized copy keeps its rotation and the names written into the photo, and drops from 5 MB to about 1.5 MB. I'll wait for the build to finish.

**Claude:** The build is still running in the background. I'll be notified when it finishes, and I'll check the output and commit then.

**Claude:** A second run takes 1.5 seconds, changes nothing, and removed the test file I planted. The build used about 4 GB of disk. Next I'm committing and pushing.

**Claude:** The **Organized Family Photos** folder is on your Desktop, built the way you asked. I left out the Google Drive step.

**What's in it** (6,582 photos across 53 top-level folders):
- **Family folders:** `<Last name>/<Person>/`, for example `Hasan/Shazia Hasan/` with 843 photos. Hasan (27 people) and Hassan (11 people) are separate families.
- **Folders of their own:** the 13 names ending in `)` or `"` each get their own top-level folder, such as `Eben (Wisconsin)` and `Munawar "Phupho"`. So do the six names without a surname that you chose: Abbie's Cousins, Amma Jan, Shazia First Haircut, Shah of Iran, Uncle Azhar and Khala Nani Nazimi.
- **No Faces:** 426 photos where no person was detected.
- **Left out:** unnamed and skipped groups.

**How it was made:**
- Each photo is a 3,000px JPEG copy, about 1.5 MB instead of 5 MB. I checked a copy: it keeps its rotation and the names written into the photo.
- A photo with several people is in each of their folders, but those copies share storage on this Mac. The build used about 4 GB of disk.
- Desktop syncs to iCloud, so iCloud will upload about 7 GB, counting each copy separately.

**Things to know:**
- **Spelling variants have separate family folders,** as you chose: Ayez, Ayeze and Ayaz are three folders, as are Asadi and Asedi, and Daud and Dawd. Within Zaidi, `Sherhzad Zaidi` and `Shehrzad "Sherri" Zaidi` are separate person folders. If any of these are the same person, tell me which spelling is right and I'll merge them.
- **Some tags didn't carry over.** The copies keep the names stored as "people in image" tags, but not the separate keyword tags `apply` writes. Photo apps that search by keyword may not find names in the copies.

**Saved in git:** the grouping rules are in [config.yaml](config.yaml), and the code is in [src/organize.py](src/organize.py) with a new `organize` command. The README is updated too. It's committed and pushed to `main` as `c32d178`. This project has no tests to run.

After you name more people, this rebuilds the folder in a couple of seconds and removes photos that no longer belong:

```bash
.venv/bin/python -m src.cli organize
```

