# 📋 Chrome Web Store Publishing Setup Guide

## ✅ Pre-Publishing Checklist

- [x] Paid $5 developer fee
- [ ] Prepared ZIP file without sensitive data
- [ ] Took generic screenshots
- [ ] Removed company-specific references
- [ ] Ready to configure settings

---

## 1️⃣ Account Setup

### Trader Declaration
**Select**: **"This is a non-trader account"**
- Reason: You're publishing a free internal tool, not selling services

### Developer Account Details
Fill in:
- **Developer name**: Your Name or "[Company] IT Team"
- **Email**: Use a team email if possible
- **Country**: Your country
- **Account type**: Individual (unless you have business account)

---

## 2️⃣ Create Your Package

```bash
# Navigate to extension directory
cd /home/adams/multi-search-extension

# Create clean ZIP for Chrome Store
zip -r chrome-store-upload.zip manifest.json src/ icons/ -x "*.md" -x "*.sh" -x "dist/*" -x ".git/*" -x "*Zone.Identifier"

# Verify size (should be under 10MB)
ls -lh chrome-store-upload.zip
```

---

## 3️⃣ Dashboard Settings

### Navigate to: https://chrome.google.com/webstore/devconsole

### Click "New Item" and Configure:

#### **Privacy Tab** (REQUIRED FIRST)
1. **Single Purpose**:
   ```
   This extension searches and highlights multiple terms on webpages
   with color-coded results for improved productivity and data analysis.
   ```

2. **Permission Justifications**:
   - **activeTab**: "Required to search and highlight text on the current webpage"
   - **storage**: "Saves user preferences and search terms for the session"
   - **scripting**: "Injects highlighting functionality into the active tab"

3. **Data Use Practices**:
   - Check: ✅ "This extension does NOT collect or use any user data"

#### **Store Listing Tab**

**Title**: Multi-Highlight Search Tool

**Summary** (132 chars max):
```
Search and highlight multiple terms simultaneously with unique colors on any webpage
```

**Description**:
```
🔍 Multi-Highlight Search Tool

A powerful productivity extension for searching and highlighting multiple terms simultaneously on any webpage.

KEY FEATURES:
✅ Search multiple terms at once (up to 100+)
✅ Color-coded results (8 unique colors)
✅ Three intelligent search modes
✅ Keyboard navigation (Tab/Enter/Space)
✅ Session persistence
✅ Privacy-focused (no data collection)

SEARCH MODES:
• Text Only - Traditional text search
• Links Aware - Highlight entire link elements
• URL IDs - Find items by numeric IDs in URLs

KEYBOARD SHORTCUTS:
• Ctrl+Shift+F - Open search panel
• Ctrl+Shift+S - Toggle highlights
• Tab - Navigate between matches
• Enter - Click highlighted element
• Space - Toggle checkboxes

PERFECT FOR:
• Data analysis and verification
• Research and documentation review
• QA testing and validation
• Bulk operations on web interfaces

Version 1.0.0
No data collection. Works offline.
```

**Category**: Productivity
**Language**: English

#### **Graphic Assets Tab**

Required images:
1. **Store Icon** (128x128): Use icons/icon128.png
2. **Screenshots** (1280x800 or 640x400): At least 1, max 5
   - Screenshot 1: Extension popup open with example searches
   - Screenshot 2: Webpage with multiple highlights
   - Screenshot 3: Different search modes dropdown

Optional:
- Small promotional tile (440x280)
- Marquee promotional tile (1400x560)

#### **Distribution Tab** 🔒

**IMPORTANT - For Organization Only:**

**Visibility**: Choose one:

**Option A - If you have Google Workspace**:
- Select: "Private: Your organization"
- Domain: @yourcompany.com
- Only employees can install

**Option B - If NO Google Workspace**:
- Select: "Unlisted"
- Get shareable link after publishing
- Share link only internally
- Add to description: "Internal tool - not for public use"

**Regions**: All regions (or select specific countries)

**Pricing**: Free

---

## 4️⃣ Review & Publish

### Before Submitting:
1. Review all fields for accuracy
2. Check screenshots don't show sensitive data
3. Verify no company URLs in description
4. Test the uploaded ZIP locally first

### Submit for Review:
1. Click "Submit for Review"
2. Answer any additional questions:
   - "Does this extension use AI?" → No
   - "Does this collect user data?" → No
   - "Is this for children?" → No

### Review Timeline:
- **Organizational/Unlisted**: 1-2 business days
- **Public**: 3-7 business days
- You'll get email when approved

---

## 5️⃣ Post-Publishing

### Once Approved:

#### For Organization (Google Workspace):
1. Extension auto-appears for all employees
2. Can be force-installed via admin console
3. Share documentation internally

#### For Unlisted:
1. Get the installation link from dashboard
2. Create internal documentation:
   ```
   Subject: New Productivity Tool Available

   Team,

   Our Multi-Highlight Search Tool is now available:
   [Installation Link]

   This tool helps search multiple IDs/terms at once.
   See attached guide for usage instructions.
   ```

### Updating the Extension:
1. Make code changes
2. Update version in manifest.json (e.g., "1.0.1")
3. Create new ZIP
4. Upload via "Package" → "Upload new package"
5. Submit update (auto-deploys when approved)

---

## 6️⃣ Management URLs

Save these links:

- **Developer Dashboard**: https://chrome.google.com/webstore/devconsole
- **View Analytics**: Dashboard → Your extension → Analytics
- **User Feedback**: Dashboard → Your extension → Reviews
- **Update Package**: Dashboard → Your extension → Package

---

## ⚠️ Important Notes

### Privacy & Compliance:
- Never mention specific internal systems
- Keep descriptions generic
- Don't include company logos without permission
- Ensure compliance with company policies

### If Rejected:
Common rejection reasons and fixes:
- **"Single purpose unclear"** → Simplify description
- **"Permissions not justified"** → Add more detail in privacy tab
- **"Screenshots unclear"** → Add captions to images
- **"Metadata spam"** → Remove repeated keywords

### Support:
- For publishing issues: Chrome Web Store support
- For extension bugs: Internal IT team
- For usage questions: Create internal wiki/docs

---

## 🎯 Quick Reference

```bash
# Commands you'll need:

# Create package
zip -r upload.zip manifest.json src/ icons/

# Test locally first
1. chrome://extensions
2. Load unpacked → test everything
3. Then upload to store

# Version bumping
Edit manifest.json → "version": "1.0.1"
```

**Remember**: Select "Non-trader account" when asked!