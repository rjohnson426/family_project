// One-click AI restoration tools, run on Replicate. Each run sends one image to Replicate and
// costs a few cents, so the whole site shares a daily cap (lib/usage.ts).

export type AiToolId = "restore" | "faces" | "colorize" | "upscale";

export type AiTool = {
  id: AiToolId;
  label: string;
  description: string;
  /** Official models run by name; community models need a pinned version. */
  model: string;
  version?: string;
  input: (image: string) => Record<string, unknown>;
};

export const AI_TOOLS: AiTool[] = [
  {
    id: "restore",
    label: "Restore old photo",
    description: "Repairs scratches, tears and fading, and adds color.",
    model: "flux-kontext-apps/restore-image",
    input: (image) => ({ input_image: image, output_format: "jpg", safety_tolerance: 2 }),
  },
  {
    id: "faces",
    label: "Fix faces",
    description: "Sharpens blurry or grainy faces.",
    model: "sczhou/codeformer",
    version: "cc4956dd26fa5a7185d5660cc9100fab1b8070a1d1654a8bb5eb6d443b020bb2",
    input: (image) => ({ image, codeformer_fidelity: 0.7, upscale: 1, face_upsample: true, background_enhance: false }),
  },
  {
    id: "colorize",
    label: "Colorize",
    description: "Adds natural color to black-and-white photos.",
    model: "piddnad/ddcolor",
    version: "ca494ba129e44e45f661d6ece83c4c98a9a7c774309beca01429b58fce8aa695",
    input: (image) => ({ image, model_size: "large" }),
  },
  {
    id: "upscale",
    label: "Upscale 2×",
    description: "Doubles the resolution for bigger prints.",
    model: "nightmareai/real-esrgan",
    version: "b3ef194191d13140337468c916c2c5b96dd0cb06dffc032a022a31807f6a5ea8",
    input: (image) => ({ image, scale: 2, face_enhance: false }),
  },
];

export function findTool(id: string): AiTool | undefined {
  return AI_TOOLS.find((t) => t.id === id);
}

export const AI_DAILY_LIMIT = 50;

type Prediction = {
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string | string[] | null;
  error?: string | null;
  urls: { get: string };
};

const TERMINAL = new Set(["succeeded", "failed", "canceled"]);

/** Runs a tool on an image (a data: URL) and returns the result image's URL on Replicate. */
export async function runTool(tool: AiTool, image: string, timeoutMs = 110_000): Promise<string> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("AI editing isn't set up (REPLICATE_API_TOKEN is missing).");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "wait=60" };
  const started = Date.now();

  const url = tool.version
    ? "https://api.replicate.com/v1/predictions"
    : `https://api.replicate.com/v1/models/${tool.model}/predictions`;
  const body = tool.version ? { version: tool.version, input: tool.input(image) } : { input: tool.input(image) };
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) {
    console.error("Replicate", res.status, (await res.text()).slice(0, 500));
    throw new Error(
      res.status === 402
        ? "AI edits are paused: the Replicate account needs more credit. Let Rob know."
        : res.status === 429
          ? "The AI service is busy. Please try again in a minute."
          : `The AI service refused the request (${res.status}).`,
    );
  }
  let prediction = (await res.json()) as Prediction;

  while (!TERMINAL.has(prediction.status)) {
    if (Date.now() - started > timeoutMs) throw new Error("The AI edit took too long. Please try again.");
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(prediction.urls.get, { headers: { Authorization: `Bearer ${token}` } });
    if (!poll.ok) throw new Error(`Couldn't check on the AI edit (${poll.status}).`);
    prediction = (await poll.json()) as Prediction;
  }

  if (prediction.status !== "succeeded") throw new Error(prediction.error || "The AI edit failed.");
  const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (!output) throw new Error("The AI edit returned no image.");
  return output;
}
