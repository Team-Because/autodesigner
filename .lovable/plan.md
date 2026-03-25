

# Set Up Tata IIS Brand

## What Will Be Done

Create a **Tata IIS** campaign group under the **Because Education** account, then insert a single **Tata Indian Institute of Skills** brand with the full structured brief.

## Data Operations (via insert tool)

### 1. Create Campaign
Insert into `campaigns`:
- **name**: `Tata IIS`
- **user_id**: `d3bf75d2-f536-4586-8429-236b602dd690` (Because Education)

### 2. Create Brand
Insert into `brands` with the new campaign_id:

| Field | Value |
|---|---|
| **name** | Tata Indian Institute of Skills |
| **primary_color** | `#3A7DDA` (Tata Blue) |
| **secondary_color** | `#272727` (Steel Grey) |
| **extra_colors** | `#0F385A` (Dark Tata Blue), `#3E7B9A` (Teal Grey), `#FFEC00` (Education Yellow), `#00A8B6` (Accent Teal), `#FFFFFF` (White) |
| **brand_brief** | Sections A + B + E mapped to: Brand Identity (vocational STEM, 70% practical, Tata legacy, IIS Mumbai & Ahmedabad), Must-Include Elements (Tata IIS branding, tagline, CTAs, hashtags, eligibility/duration), Visual Direction (industrial-clean mood, cool lab lighting, real trainees in PPE, structured grid layouts, Tata Blue logo top-left) |
| **brand_voice_rules** | Voice traits (Empowering, Professional, Future-focused), messaging pillars (Industry 4.0, hands-on learning, inclusive career growth), target audience (youth 18-27, parents, working professionals), DO's from Section F |
| **negative_prompts** | Visual Nevers (never stretch/recolor Tata logo, no busy backgrounds, no low-res machinery), Content Nevers (no "guaranteed placement", no "100% jobs", no high-pressure tactics, no omitting Tata branding) |

### Asset Uploads
No image uploads in this step — user will need to upload logo files, campus photos, and lab imagery separately and tag them (Logo, Architecture, Lifestyle, Icon).

## No Code Changes Required
This is a data-only operation using the existing brand schema.

