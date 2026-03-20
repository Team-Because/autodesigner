UPDATE brands
SET
  primary_color = '#2E3241',
  secondary_color = '#F7F6F1',
  extra_colors = '[{"name":"Urban Taupe","hex":"#A9957C"},{"name":"Sky Gradient Blue","hex":"#B3C4D9"},{"name":"Gold Accent","hex":"#CDA863"}]'::jsonb,
  brand_brief = '## Brand Identity
Project: The Planet by Venus — a premium residential destination combining modern living, thoughtful design & lifestyle convenience in Shela, Ahmedabad.
Developer: Venus Infrastructure & Developers Pvt. Ltd — known for quality construction and landmark residences.
Configuration: 3 BHK Premium Residential Homes + Select Shops.
Project Size: ~4.71 Acres across 10 Towers with ~617 units.
Location: Club O7 Road, Shela, Ahmedabad (South-West), off SP Ring Road.
Status: Newly Launched / Under Construction (Launched Nov 2024). Possession estimated Dec 2030.
Starting Price: ~₹71.25 L – ₹73.04 L onwards.

## Must-Include Elements
- Project Name: The Planet by Venus (must appear in every creative)
- Location: Club O7 Road, Shela, Ahmedabad
- Configuration: 3 BHK Truly Premium Homes
- RERA: PR/GJ/AHMEDABAD/DASKROI/Ahmedabad Municipal Corporation/MAA14626/311224/311230
- Contact: +91 8306 333 777
- Subtext block (compulsory): "3 BHK Truly Premium Homes | Club O7 Road, Shela, Ahmedabad | +91 8306 333 777"

## Visual Direction
Mood: Bright, confident, modern daylight or warm golden hour — communicate quality living and spatial warmth.
3D Framing: Clean façades with dynamic skies. Thoughtful framing of community spaces. Balanced exterior/interior compositions. Soft shadows + subtle depth for premium detailing.
All visuals must ONLY use the EXACT 3D images provided in brand assets — no AI-generated, stock, or unrelated visuals.
3D asset types to select from: Façade/elevation renders, landscaped lawns/greens, pool/clubhouse/amenities, tower massing, street entry/SP Ring Rd connectivity, interiors (only if provided in assets).
Key visual subjects: Premium residential towers with elegant façades, landscaped central lawns, swimming pool/gym/clubhouse/kids play, active community spaces, streetscape connectivity, retail frontage.

## Voice & Tone
Tone: confident, premium, modern, sincere, aspirational. Focus on craftsmanship, ownership value and community comfort.
Target: Mid-to-upper income homebuyers, families, investors, professionals who value spacious 3 BHK living and connectivity.
Emotional positioning: Comfort. Craftsmanship. Community. Ownership. "Your home should feel crafted, confident, and connected — not just housed."
Headline style references (use as stylistic inspiration, generate original copy each time):
- "Live at The Centre of Modern Ahmedabad"
- "Smart Living. Superior Location."
- "Where Comfort Meets Connectivity"
- "Stop Renting. Start Owning. Make It Yours"
Messaging angles:
1. Craftsmanship: "Meticulous detailing, quality materials, thoughtful spatial planning define every home at The Planet."
2. Ownership campaign: "Stop Renting. Start Owning — premium 3 BHK homes in Shela for long-term comfort, value, and future security."

## Do''s
- Use ONLY approved 3D renders from brand assets for all visuals
- Follow reference design style: font pairing (serif headlines + sans-serif body), layout grid, visual hierarchy
- Maintain neutral background textures and brand color usage
- Clean grid layouts with horizontal visual balance
- Clear brand hierarchy and spacing standards
- Serif + Sans-Serif pairing must be consistent across all creatives
- Creative freedom allowed for lighting and camera angles on 3D renders (golden hour, twilight, etc.)

## Don''ts
- Never generate, fabricate, or use AI-created visuals — only use provided 3D assets
- No loud colors, random icons, stock models, or unrelated stock visuals
- No repetitive information across headline/body/CTA — each text element must say something unique
- No hyperbolic or aggressive sales language
- No inconsistent styling or fonts that deviate from brand templates
- No unauthorized brand marks or logos
- No cluttered compositions — maintain intentional negative space

## Color Notes
Midnight Slate (#2E3241): Primary text and dark backgrounds — grounded authority.
Warm Pearl (#F7F6F1): Light backgrounds, card surfaces — clean warmth.
Urban Taupe (#A9957C): Supporting text, borders, subtle accents — earthy sophistication.
Sky Gradient Blue (#B3C4D9): Decorative accents, gradient elements — openness and sky connection.
Gold Accent (#CDA863): CTAs, highlights, premium touches — aspiration and value.
Overall feel: Modern aesthetic with grounded, premium warmth. Never saturated or flashy.

## Additional Notes
Typography: Refined serif for headlines (aspirational, confident), clean modern sans-serif for body (readable, elegant). Hierarchy and spacing must remain consistent with reference templates.
This is a real estate project — all facts (RERA, pricing, possession dates) must be accurate and never exaggerated.
Multiple campaign angles exist: craftsmanship-led and ownership/campaign-led messaging. The Adapt step should choose the most appropriate angle based on the reference image mood.',
  brand_voice_rules = 'Tone: confident, premium, modern, sincere, aspirational.
Focus on craftsmanship, ownership value and community comfort — avoid sales hype.
Target: mid-to-upper income homebuyers, families, investors, professionals.
Emotional positioning: Comfort. Craftsmanship. Community. Ownership.
Language: clear, confident, craft-oriented, never cluttered.
Headlines: generate original copy each time — use provided examples only as stylistic reference, never copy verbatim.',
  negative_prompts = 'No AI-generated, stock, or fabricated visuals — only provided 3D assets.
No loud colors, random icons, stock models.
No repetitive information across headline/body/CTA.
No hyperbolic or aggressive sales language.
No irrelevant stock visuals or inconsistent styling.
No cluttered compositions — maintain intentional negative space.
No unauthorized brand marks or logos.',
  updated_at = now()
WHERE id = '0b3dac9c-19b6-4cdc-a42e-d29b45e7444c';