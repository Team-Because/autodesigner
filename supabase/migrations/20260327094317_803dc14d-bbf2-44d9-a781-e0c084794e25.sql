UPDATE brands SET
  primary_color = '#0F385A',
  secondary_color = '#272727',
  extra_colors = '[
    {"name": "Primary Blue", "hex": "#3A7DDA"},
    {"name": "Mid Blue", "hex": "#3E7B9A"},
    {"name": "Teal CTA", "hex": "#00A8B6"},
    {"name": "Accent Yellow", "hex": "#FFEC00"},
    {"name": "White", "hex": "#FFFFFF"}
  ]'::jsonb,
  brand_brief = '## BRAND IDENTITY
Tata Indian Institute of Skills (TATA IIS) — a Section 8 not-for-profit company established in partnership with MSDE, Government of India. Delivers industry-aligned, hands-on skill training. Campuses: IIS Mumbai & IIS Ahmedabad. Differentiators: institutional rigor comparable to IITs/IIMs but skill-focused, merit-first via National Skills Test (NST), real-machine training, residential immersive learning.

## NAMING RULES
Headings/logos/ads: TATA IIS. Body text: Tata IIS. Campuses: IIS Mumbai / IIS Ahmedabad (never "Tata IIS Mumbai"). Short forms: IISM, IISA. NEVER say "Tata Trusts Initiative" or "Backed by Tata Trusts." Partnership line: "Tata IIS is a Section 8 company, established in partnership with MSDE, Government of India."

## MUST-INCLUDE ELEMENTS
- Logo: TATA IIS top-left (white on dark backgrounds)
- Campus identifier: IIS | Mumbai Ahmedabad (bottom-left)
- NST mention: "National Skills Test (NST)" or "Take the National Skills Test"
- CTA (one of): Learn More | Explore Programs | Take the National Skills Test | Register Now
- CTA button: always teal #00A8B6, rounded pill, white bold text

## VISUAL DIRECTION
Mood: Clean, disciplined, institutional, functional. Dark and confident — not flashy.
Photography: Real environments, real machines, real learners in action (not posed stock). Training images from actual IIS campuses preferred. Students in maroon TATA IIS uniforms with branded lanyards. Natural balanced lighting.
Layout: Logo (top-left) → Headline → Sub-copy → CTA → Campus ID (bottom-left). Functional whitespace, no clutter.
Typography: Headlines bold, high-contrast white on dark. Body regular weight, short readable. Background: #0F385A dark navy for most ads, #FFFFFF for light variants. Accent yellow #FFEC00 sparingly for callouts only.',
  brand_voice_rules = '## VOICE TRAITS
Sincere · Calm · Assured · Grounded · Clear · Responsible

## MESSAGING PILLARS
- Skill training aligned to real job roles and industry demand
- Hands-on learning with real machines and practical exposure
- Discipline and structure as foundation of employability
- Merit-based access through structured assessment (NST)
- Skilling as national infrastructure, not a private commodity

## APPROVED LANGUAGE
USE: Industry-aligned, Job-ready skills, Hands-on training, Discipline, Merit-based, Employability, Real-world application, Structured learning, National Skills Test
AVOID: Guaranteed placement, No.1, Hurry, Limited seats, Enroll now, Life-changing, Dream career, 100% success, Tata Trusts Initiative

## TARGET AUDIENCE
Primary: Class 10/12 pass, ITI, diploma holders, graduates, working professionals seeking structured employable skills. Disciplined, intent-driven, outcome-focused.
Secondary: Parents/guardians evaluating credible career pathways.
Desired response: Clarity, trust, confidence, reassurance about structured career readiness — not excitement or aspiration hype.

## FINAL FILTER
Every output must be: honest, useful to the learner, institutionally aligned (MSDE partnership framing), respectful of learner intelligence, correctly named, Tata Trusts-free, CTA in teal.',
  negative_prompts = '## VISUAL NEVERS
- No flashy, overly stylized visuals or neon glows
- No stock-like aspirational imagery disconnected from real training
- No overcrowded layouts or loud color usage
- No old gold/amber (#C5A46D) palette — replaced by teal and yellow accent
- No neon tones or gradients with unrelated colors
- Never stretch, recolor, or watermark the Tata logo

## CONTENT NEVERS
- No "Tata Trusts Initiative" or "Backed by Tata Trusts" — ever
- No urgency messaging: hurry, last chance, limited seats, enroll now
- No exaggerated claims: guaranteed placement, assured success, 100% jobs, No.1, Best in India
- No edtech-style promotional language
- No high-pressure tactics or superlatives
- Never say "Tata IIS Mumbai" — use "IIS Mumbai"
- Never omit NST reference in enrollment-focused ads',
  updated_at = now()
WHERE id = '8986f427-d789-4ada-8e24-fe868b5efe6b';