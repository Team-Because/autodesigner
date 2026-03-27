UPDATE public.brands SET
  primary_color = '#C8A96E',
  secondary_color = '#272727',
  extra_colors = '[{"hex":"#F5E6CC","name":"Champagne"},{"hex":"#FFFFF0","name":"Ivory"},{"hex":"#D4AF37","name":"Warm Gold"},{"hex":"#4A7C59","name":"Nature Green"},{"hex":"#FFFFFF","name":"White"}]'::jsonb,
  brand_brief = '## BRAND IDENTITY
Brand: ANANTARA ALORA | Developer: A. Shridhar | Building Thoughtfully
Location: Science Park, Ahmedabad
Luxury 3 BHK from 2,594 sq.ft (largest in Science Park) & 4 BHK Penthouses from 5,116 sq.ft. Pet-friendly community, splash pool, gymnasium, unhindered R3 zone views. Show apartment ready.

## MUST-INCLUDE ELEMENTS
- Brand: ANANTARA ALORA | A. Shridhar | Building Thoughtfully
- Tagline: Ahmedabad''s Most Wanted Homes
- CTA: Visit Show Apartment / Book a Private Tour / Call to Know More
- Contact: 8306 333 777 | Science Park, Ahmedabad
- Config: 3 BHK & Penthouses | From 2,594 sq.ft
- USPs: Largest 3 BHK in Science Park | Pet-Friendly | Unhindered R3 Zone Views | Show Apartment Ready
- Amenities: Splash Pool | Pet-Friendly Community | Open Views
- RERA: MAA14273 | gujrera.gujarat.gov.in
- Logo: TOP-LEFT always | RERA QR: TOP-RIGHT always
- Bottom bar: Location + Contact + Config + USPs with generous spacing and dividers

## VISUAL DIRECTION
Mood: Warm open luxury — grand airy nature-connected aspirational yet liveable
Lighting: Warm golden interiors, abundant natural light, large windows framing R3 greenery
Photography: Spacious luxury renders, splash pool lifestyle, aerial R3 views, tasteful pet-friendly moments
Layout: Editorial generous whitespace, elegant serif headlines plus clean sans-serif body
Textures: Marble warm wood soft fabric natural stone — no industrial finishes
Typography: Premium serif headlines (Cormorant Playfair Didot), refined sans body. Max 2 families.

## EXAMPLE COPY (style reference only — generate original)
Headlines: "The Largest 3 BHK in Science Park" | "Where Every Window is a Living Canvas" | "5116 Sq.Ft of Penthouse Living"
Subtext: "Unhindered R3 zone views, pet-friendly community, show apartment ready"',
  brand_voice_rules = '## VOICE TRAITS
Luxury, Warm, Aspirational, Open, Exclusive, Nature-connected, Prestigious, Homely yet Grand

## MESSAGING PILLARS
- Largest 3 BHK in Science Park — space is the first luxury
- Unhindered R3 zone views — every window a living canvas
- Pet-friendly — a truly complete home for every family member
- 5116 sq.ft penthouse living — some lives are simply larger
- Show apartment ready — see your future home today

## WORDS TO USE
Exclusive, Spacious, Largest, Unhindered Views, Open Skies, Pet-Friendly, Curated Living, Penthouse, Privacy, Nature-Facing, R3 Zone, Show Apartment, Expansive, Splash Pool, Grand, Serene

## WORDS TO AVOID
Affordable, Cheap, Budget, Hurry, Last chance, Guaranteed returns, Flats, Apartments (use Residences/Homes), Common, Standard, Cramped, Compact

## TARGET AUDIENCE
Primary: HNIs professionals entrepreneurs 35-60 in Ahmedabad and NRIs seeking spacious nature-facing luxury with pet-friendly lifestyle
Secondary: Luxury investors in growing Science Park micro-market
Tone: Warm luxury — open yet personal. Trusted confidant presenting a rare address not a salesperson.',
  negative_prompts = '## VISUAL NEVERS
- Never use cold dark or industrial aesthetics — warm luxury homes only
- No generic stock photos or model family imagery
- No cluttered layouts with competing elements
- No low-res renders or blurry imagery
- Logo TOP-LEFT only — never stretch recolor or redraw
- RERA QR TOP-RIGHT only
- No harsh flat white or solid black backgrounds — warm gradients only
- Never crowd or compress bottom info bar
- No decorative script or compressed fonts — max 2 font families

## CONTENT NEVERS
- Never say flat or apartment — use residence home or penthouse
- Never omit Largest 3 BHK in Science Park
- Never omit Pet-Friendly Community
- Never omit Unhindered R3 Zone Views
- Never omit Show Apartment Ready
- Never omit Splash Pool
- No fear-based urgency (Hurry Last chance Limited time)
- No unverifiable ROI or rental claims
- Never omit RERA MAA14273 plus gujrera.gujarat.gov.in
- Never omit 8306 333 777 or Science Park Ahmedabad
- Never position as affordable or mid-segment',
  updated_at = now()
WHERE id = 'e1de72fd-d691-428e-b4b0-45d90586935d';