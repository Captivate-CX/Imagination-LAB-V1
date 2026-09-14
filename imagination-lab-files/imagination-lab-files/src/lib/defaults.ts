import type { Library } from "./types";

/**
 * These are the starting prompts, imported from the Imagination Lab system map.
 * Once the team saves the prompt library in the app, the saved copy is used
 * and this file is only a fallback.
 */

export const WOBBLER_PROMPT = `Role & Objective: You are an autonomous, expert shopper marketing composite artist and structural designer. See the attached Brand Key Visual (KV). Analyze the image, extract key marketing variables, and instantly create a photorealistic shelf wobbler composite optimized for automated background removal. The wobbler is a square 120mm x 120mm.

We're going to use stage gates so that you can self-check for repetition, hallucinations, and alignment before moving on to the next step and finally generating an output.

Step 1: Internal Vision Analysis
Whenever you receive a new KV, immediately isolate these variables and define them in short, highly descriptive terms:

[Brand Logo]: Describe the primary logo, its shape, and exact colours (e.g., Blue and white typography wordmark, or a gold crest).

[The Hook]: Identify any influencing promotional badges shape, colour, and text (e.g., 'NEW', 'WIN', 'SAVE' A red starburst reading "Offer," or a bright green banner reading "100% Recycled"). The whole badge (i.e., Text, any differentiating/high contrast backgrounds/textures etc. if present) defines this variable, so select it all.

[Product Imagery]: Describe the specific physical packaging to be displayed. Identify and describe only the specific physical packaging visibly present in the provided KV. CRITICAL: Treat the product as a single, flattened object. Do not extract, read, or separate any text from the product's label to use as independent variables. Do not add, assume, or hallucinate any products not explicitly shown in the reference image. Describe the product's shape, color, and branding directly from the image.

[Characters & Humans]: Describe the specific physical appearance of any significant characters or humans visibly present (e.g., a man in a helmet and pink mask with a clothespin beard and tattoos). Identify the key actions (e.g., holding a bottle, pointing). CRITICAL MANDATORY INSTRUCTION: When adapting the character to the new wobbler composition, the pose must be re-evaluated to prevent limb multiplication or unnatural anatomical distortions. The character must have a logical number of limbs and joints (e.g., one right arm and hand, one left arm and hand). Ensure the character's key actions (like pointing) are directed towards the logical focal point within the wobbler layout (e.g., the [Brand Logo] or [Truncated CTA]), rather than a point outside of the frame. Do not add additional limbs to achieve multiple actions.

[Full CTA]: The exact text of the main campaign headline (e.g., "Unleash Your Freshness" or "Bring Out The Best"). Do not include any taglines directly associated with the logo; these remain part of Brand Logo.

[KV Background Colour]: The foundational colour for the wobbler should match that of the Key Visual exactly.

[KV Background Textures]: The foundational visual pattern or environment (e.g., Splashing clear water, abstract clean gradients, or rustic wooden textures).

[Dynamic Brand Assets]: The foreground objects that create motion, identify flavours/SKUs, and bring the Key Visual to life (e.g., Toilet bowl, Washing Machine, Swirling liquid chocolate, bursting citrus slices, or glowing energy lines).

[Base Brand Icon]: A large, secondary recognizable brand element to anchor the design (e.g., A macro-scaled signature swoosh, a recognized brand mascot, or a core hero ingredient).

[Small Print]: Any Terms & Conditions, competition details, or fine print that cannot be read from a distance and is only included for legal reasons. This only applies to standalone text in the main KV background, NOT text printed on the physical product packaging. If there are no standalone T&Cs in the KV, omit this variable entirely.

If variables are not present, do not substitute another element in its place. E.g., If 'the Hook' isn't present, don't replace with a random word, simply omit.

Stage Gate: Before you move on to the next step, double-check you have checked for each of these variables/elements and correctly identified and isolated them if present.

Step 2: Design Generation Rules
Role: You are an expert 2D structural packaging designer and shopper marketing visualizer.
Task: Using the extracted variables, create an exact photorealistic, image-to-image composite for a square retail shelf wobbler 120mm x 120mm.

CRITICAL MANDATORY INSTRUCTION: Configure your generation tool to use a 1:1 square aspect ratio.
Stage Gate: Before you move on to the next step, double-check you have adhered to this structure and made no changes.

Design specifications:
Overall Theme & Background: Fill the square canvas with [Insert KV Background Textures]. You may use a split-screen effect (e.g., dynamic texture on the left, solid bold brand colour on the right) for high contrast.

Aspect Ratio: 1:1 Square.

Background: The wobbler composite must sit on a completely solid, pure #FFFFFF white background with no shadows or gradients to allow for strict background removal. Ensure the final output is a clean graphic of the physical wobbler only. There must be NO extra technical markings of any kind on the white background outside of the die-cut shape, including (but not limited to) crop marks, registration guides, alignment lines, black vector path outlines, text boxes, or faint structural lines. The solid white background must be completely clear of any marks.

Base Shape & Die-Cut: The foundational base is a perfect square filled with the [KV Background Textures].

Layout: Place tightly cropped [Product Imagery] on the left, overlapping the centre and breaking the left outer boundary. Render this unit as a single unit on the wobbler. If present, render macro-scaled [Characters & Humans] on the left exactly as they appear on the KV. Place the [Brand Logo] and bold [Full CTA] on the right and make [Brand Logo] one of the most significant design features. Place [The Hook] at the top of the wobbler and allow [The Hook] to protrude outside the top edge if required. Use [Dynamic Brand Assets] to fill any additional space. Place [Small Print] at the centre bottom of the wobbler.

Stage Gate: Before creating the final image, double-check that you are compositing a flat, print-ready layout with a clear die-cut silhouette, with no 3D structural shelf environments or raw cardboard edges. Double-check you have not altered any of the variables you identified - by adding or altering colours, shapes, fonts, or logos - before completing the final image. Make a specific check of the final [Product Imagery] to ensure it is the EXACT number, design, set, and arrangement from the KV - ensure there are no products or hallucinations that are not in the original KV. Make a specific check to ensure the external white background space is perfectly clear of all technical lines.

CRITICAL FINAL INSTRUCTION: You must retain 100% of the original photographic realism from the source image. Do NOT generate illustrations, vectors, cartoons, paintings, 3D renders, or stylized interpretations of the human, product, or background. Perform an exact image-to-image composite with zero style alteration.`;

export const FSDU_PROMPT = `Role & Objective:
You are an expert shopper marketing graphic designer. Apply the provided Key Visual to the "01. Blank Unit.png" template to create an FSDU design that will attract and engage shoppers in store.

We're going to use stage gates so that you can self-check for repetition, hallucinations and alignment before moving on to the next step and finally generating an output.

Phase 1: The KV Extraction Formula
Whenever you receive a new KV, immediately isolate these variables and define them in short, highly descriptive terms:

[Brand Logo]: Describe the primary logo, its shape, and exact colours (e.g., Blue and white typography wordmark, or a gold crest).

[The Hook]: Identify any influencing promotional badges shape, colour, and text (e.g., 'NEW', 'WIN', 'SAVE' A red starburst reading "Offer," or a bright green banner reading "100% Recycled"). The whole badge (i.e. Text, any differentiating/high contrast backgrounds/textures etc. if present) defines this variable, so select it all.

[Product Imagery]: Describe the specific physical packaging to be displayed (e.g., 500ml pump-action bottles, glass condiment jars, or aerosol deodorant cans).

[Characters & Humans]: Identify any humans or characters that appear as significant features (i.e. more than 5% of the layout space) (e.g. humans, human faces, cartoon characters, teddy bears).

[Full CTA]: The exact text of the main campaign headline (e.g., "Unleash Your Freshness" or "Bring Out The Best"). Do not include any taglines directly associated with the logo, these remain part of Brand Logo.

[Truncated CTA]: A shortened 2-4 word version of the CTA for tighter spaces (e.g., "Stay Fresh" or "Great Taste").

[KV Background Textures]: The foundational visual pattern or environment (e.g., Splashing clear water, abstract clean gradients, or rustic wooden textures).

[Dynamic Brand Assets]: The foreground objects that create motion, identify flavours/SKUs and bring the Key Visual to life (e.g., Toilet bowl, Washing Machine, Swirling liquid chocolate, bursting citrus slices, or glowing energy lines).

[Base Brand Icon]: A large, secondary recognizable brand element to anchor the design (e.g., A macro-scaled signature swoosh, a recognized brand mascot, or a core hero ingredient).

[Small Print]: Any Terms & Conditions, competition details or fine print that cannot be read from distance and is only included for legal reasons.

If variables are not present, do not substitute another element in its place. E.g. If 'the Hook' isn't present, don't replace with a random word, simply omit.

Stage Gate: Before you move on to the next step, I want you to double check you have checked for each of these variables/elements and correctly identified and isolated them if present.

Step 2: The Final Single-Unit FSDU Prompt Template
Copy and paste your defined variables into the bracketed [ ] spaces.

CRITICAL MANDATORY INSTRUCTION: To ensure a single unit, you MUST configure your generation tool to use a vertical portrait aspect ratio (like 9:16 or 4:5). Do not run this prompt in a wide (16:9) format.

Role: You are an expert 3D structural packaging designer and shopper marketing visualizer.

Task: Generate a photorealistic 3D render of a finished, solitary, perfectly centered, three-shelf Free Standing Display Unit (FSDU) made of printed 10mm-thick cardboard, that could be placed in supermarkets. The FSDU must stand alone, perfectly centered in a vertical portrait frame (9:16 aspect ratio), filling the composition, with no duplication or multiple units present on a seamless studio white background.

Mandatories: The FSDU dimensions should be generic but appropriate for standard supermarket retailers in Europe and the USA. The FSDU must strictly follow this campaign layout:

Structural Guidelines (Mandatory):
Use the Blank Template: Base your design exactly on the attached "01. Blank Unit.png" file. Make absolutely no structural changes to this unit.
Strictly Three Shelves: The FSDU must maintain a strict vertical composition: one header, exactly three (3) product shelves, and one base unit. Do not fill vertical space by generating a fourth product tier.

Stage Gate: Before you move on to the next step, I want you to double check you have adhered to this structure and made no changes.

Overall Theme & Background (Mandatory):
The structural cardboard is printed with a background resembling [Insert KV Background Textures], transitioning gracefully into the negative space.

Surface Specifications:
Header Card (Top Die-Cut Panel): Place a [Insert Hook Description] in the top right corner. Center a high-resolution [Insert Brand Logo]. Directly below the logo, place bold text reading "[Insert Full CTA]". The left half of the header should include a combination of [Product Imagery Description], [Characters & Humans] and [Dynamic Brand Assets] as they appear on the Key Visual. Place [Small Print] in the bottom right hand corner.

Side Panels (Visible 3/4 view): The top half must feature relatively clean negative space utilizing the [Insert KV Background Textures]. Place a [Insert Hook Description] at the top of the left-facing panel. Below this place a large [Brand Logo]. To fill the lower half, render macro-scaled, tightly cropped images of [Insert Product Imagery] intertwined with a massive, dynamic [Insert Dynamic Brand Assets] that sweeps diagonally down the panel to create motion and aisle disruption. The Dynamic Brand Asset must continue down the entire side, integrating with the base.

3 x Shelf Edges (Horizontal lips of the shelves): The FSDU has exactly 3 horizontal shelves. On the front-facing edge of EACH shelf, print a [Insert Hook Description] on the far right, followed by the text "[Insert Truncated CTA]" in the middle written in highly legible typography against a clean background strip. If present, place [Insert Dynamic Brand Assets] in the left third of the shelf edge.

Base Panel (Bottom skirt under the lowest shelf): Print a visually dense version of the [Insert KV Background Textures]. Have the [Insert Dynamic Brand Assets] continue to sweep across it, and include a large, macro scaled [Insert Base Brand Icon] positioned centrally.

Stage Gate: Before you move on to the next step, I want you to double check you have applied each of the variables/elements and correctly applied them to the blank FSDU as per the instructions.

Camera & Lighting: A clean 3/4 isometric perspective shows the header, the visible left side panel, all 3 shelves, and the base panel. Bright, even studio lighting emphasizes the structural folds and the crispness of the printed graphics without complex shadows from other objects. No floating elements or duplicate views outside the FSDU structure.

Mandatory: Do not show raw corrugated or unfinished cardboard edges, the FSDU must display finished cardboard edges in line with KV background colours.

Stage Gate: Before creating final image, I want you to double check that you are generating only ONE FSDU image, in exact accordance with the above Camera & Lighting guides, with no changes.`;

/**
 * One generic quality-check prompt for every POSM type. Placeholders:
 * {brand} {campaign} {asset_type} {design_count}
 */
export const QC_PROMPT = `See the {brand} {campaign} Key Visual attached (Image 1). Also attached are {design_count} designs of a {asset_type} that have been created from this Key Visual (Design 1, Design 2 and so on).

Assess each of the {asset_type} designs and determine which one stays truest to the Key Visual design.

Also look out for any mistakes made by the AI tool in designing the {asset_type}, i.e. wrong logo, extra limbs or unnatural anatomy, needless duplication of visual elements, products or packaging that are not in the Key Visual, misspelt or altered headline text, and colours that don't match the Key Visual.

Brand compliance: the logo, product packaging, headline wording and core colours must match the Key Visual exactly.

Output:
1) Verdict: which {asset_type} is the best translation of the Key Visual to a {asset_type} format and why.
2) Issues table: what are the design issues with each of the {design_count} {asset_type} designs.`;

export function defaultLibrary(): Library {
  return {
    updatedAt: new Date(0).toISOString(),
    note: "Starting prompts from the system map",
    qcPrompt: QC_PROMPT,
    settings: {
      imageModel: process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image-preview",
      qcModel: process.env.GEMINI_QC_MODEL || "gemini-3.1-pro-preview",
      imageSize: "2K",
      variantsPerAsset: 3,
    },
    assetTypes: [
      {
        id: "wobbler",
        name: "Wobbler",
        aspectRatio: "1:1",
        prompt: WOBBLER_PROMPT,
        references: [],
        enabled: true,
      },
      {
        id: "fsdu",
        name: "FSDU",
        aspectRatio: "9:16",
        prompt: FSDU_PROMPT,
        references: [
          { id: "blank-unit", label: "01. Blank Unit.png", path: "builtin:01-blank-unit.png" },
        ],
        enabled: true,
      },
    ],
  };
}
