"use client";

import FilerobotImageEditor, { TABS, TOOLS } from "react-filerobot-image-editor";
import { imgSrc } from "@/lib/manifest";

/**
 * Filerobot Image Editor (MIT, runs entirely in the browser; no account or API key).
 * Saving downloads the edited copy; nothing is uploaded back.
 */
export default function Editor({ id, filename, onClose }: { id: string; filename: string; onClose: () => void }) {
  const base = filename.replace(/\.[^.]+$/, "");
  return (
    <div className="fixed inset-0 z-50 bg-white">
      <FilerobotImageEditor
        source={imgSrc(id, "full")}
        tabsIds={[TABS.ADJUST, TABS.FINETUNE, TABS.FILTERS, TABS.ANNOTATE, TABS.RESIZE]}
        defaultTabId={TABS.ADJUST}
        defaultToolId={TOOLS.CROP}
        defaultSavedImageName={`${base}-edited`}
        defaultSavedImageType="jpeg"
        defaultSavedImageQuality={0.92}
        useBackendTranslations={false}
        savingPixelRatio={1}
        previewPixelRatio={typeof window !== "undefined" ? window.devicePixelRatio : 1}
        onClose={onClose}
        onSave={(saved) => {
          if (!saved.imageBase64) return;
          const a = Object.assign(document.createElement("a"), {
            href: saved.imageBase64,
            download: saved.fullName ?? `${base}-edited.jpg`,
          });
          a.click();
        }}
      />
    </div>
  );
}
