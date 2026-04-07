#!/usr/bin/env python3
"""
Grasshopper — Investor One-Pager PDF Generator
"""
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.lib.colors import HexColor

OUTPUT = '/Users/billhewson617/Desktop/FlowhubDashboard/CannaIQ_Investor_Overview.pdf'

# ── Brand Colors ──────────────────────────────────────────────────────────────
BG        = HexColor('#0a0a0a')
CARD      = HexColor('#141414')
CARD2     = HexColor('#1a1a1a')
AMBER     = HexColor('#c8922a')
AMBER_LT  = HexColor('#e0a830')
CYAN      = HexColor('#80ecfa')
WARM      = HexColor('#f0e8d8')
MUTED     = HexColor('#aaaaaa')
MUTED2    = HexColor('#666666')
MUTED3    = HexColor('#3a3a3a')
GREEN     = HexColor('#5dcc8a')
RED       = HexColor('#e06060')
BORDER    = HexColor('#2e2e2e')
DARK_CARD = HexColor('#0f0f0f')

W, H = letter   # 612 × 792

c = rl_canvas.Canvas(OUTPUT, pagesize=letter)
c.setTitle('CannaIQ — Investor Overview')
c.setAuthor('617THC')
c.setSubject('AI-Powered Analytics for Cannabis Retail')

# ── Layout constants ──────────────────────────────────────────────────────────
MARGIN  = 26
COL_GAP = 10
COL_W   = (W - 2 * MARGIN - COL_GAP) / 2
INDENT  = 10

# ── Y positions (computed bottom-up, validated to sum to 792) ─────────────────
BOTTOM_BAR_H = 4
FOOTER_Y     = BOTTOM_BAR_H           # 4
FOOTER_H     = 46                      # → top at 50
R4_Y         = FOOTER_Y + FOOTER_H + 8  # 58  (stats bar)
R4_H         = 80                      # → top at 138
R3_Y         = R4_Y + R4_H + 8        # 146 (market / why now)
R3_H         = 155                     # → top at 301
R2_Y         = R3_Y + R3_H + 8        # 309 (capabilities / biz model)
R2_H         = 165                     # → top at 474
R1_Y         = R2_Y + R2_H + 8        # 482 (problem / solution)
R1_H         = 155                     # → top at 637
HEADER_Y     = R1_Y + R1_H + 21       # 658 (21 = 8pt gap + 13pt slack)
HEADER_H     = 130                     # → top at 788
TOP_BAR_Y    = HEADER_Y + HEADER_H    # 788

# ── Helpers ───────────────────────────────────────────────────────────────────
def fill(x, y, w, h, color):
    c.setFillColor(color)
    c.rect(x, y, w, h, fill=1, stroke=0)

def hline(x1, y, x2, color=BORDER, lw=0.5):
    c.setStrokeColor(color); c.setLineWidth(lw); c.line(x1, y, x2, y)

def vline(x, y1, y2, color=BORDER, lw=0.5):
    c.setStrokeColor(color); c.setLineWidth(lw); c.line(x, y1, x, y2)

def txt(x, y, s, font='Helvetica', size=10.3, color=WARM, align='left'):
    c.setFillColor(color); c.setFont(font, size)
    if align == 'left':    c.drawString(x, y, s)
    elif align == 'center': c.drawCentredString(x, y, s)
    elif align == 'right':  c.drawRightString(x, y, s)

def section_label(x, y, s, color=AMBER):
    """Small all-caps label with left accent stripe."""
    fill(x, y - 1, 2, 8, color)
    c.setFillColor(color); c.setFont('Helvetica-Bold', 7.5)
    c.drawString(x + 6, y, s.upper())
    return y - 13

def bullets(x, y, items, size=9.0, lh=12, color=MUTED, bc=AMBER):
    for item in items:
        c.setFillColor(bc);    c.setFont('Helvetica-Bold', 8.0); c.drawString(x, y, '›')
        c.setFillColor(color); c.setFont('Helvetica', size);   c.drawString(x + 8, y, item)
        y -= lh
    return y

def card(x, y, w, h, border_color=AMBER):
    fill(x, y, w, h, CARD2)
    fill(x, y, 3, h, border_color)  # left color stripe

# ══════════════════════════════════════════════════════════════════════════════
# BACKGROUND
# ══════════════════════════════════════════════════════════════════════════════
fill(0, 0, W, H, BG)

# ══════════════════════════════════════════════════════════════════════════════
# TOP AMBER BAR
# ══════════════════════════════════════════════════════════════════════════════
fill(0, TOP_BAR_Y, W, BOTTOM_BAR_H, AMBER)

# ══════════════════════════════════════════════════════════════════════════════
# HEADER  (y = 658 → 788)
# ══════════════════════════════════════════════════════════════════════════════
fill(0, HEADER_Y, W, HEADER_H, CARD)
fill(0, HEADER_Y, 5, HEADER_H, AMBER)
hline(0, HEADER_Y, W, BORDER, 1)

# ── Left: Product identity
c.setFillColor(WARM); c.setFont('Helvetica-Bold', 50.6)
c.drawString(MARGIN + 8, HEADER_Y + 84, 'CannaIQ')
name_w = c.stringWidth('CannaIQ', 'Helvetica-Bold', 50.6)
c.setFillColor(AMBER)
c.circle(MARGIN + 8 + name_w + 6, HEADER_Y + 90, 4.5, fill=1, stroke=0)

c.setFillColor(AMBER); c.setFont('Helvetica', 14.9)
c.drawString(MARGIN + 8, HEADER_Y + 62, 'AI-Powered Analytics for Cannabis Retail')

c.setFillColor(HexColor('#555555')); c.setFont('Helvetica', 9.2)
c.drawString(MARGIN + 8, HEADER_Y + 46, 'PURPOSE-BUILT FOR DISPENSARY OPERATORS  ·  INVESTOR OVERVIEW  ·  CONFIDENTIAL')

fill(MARGIN + 8, HEADER_Y + 40, 220, 1, AMBER)

c.setFillColor(MUTED); c.setFont('Helvetica', 9.8)
c.drawString(MARGIN + 8, HEADER_Y + 27,
    'Grasshopper turns raw POS data into instant, actionable intelligence.')
c.drawString(MARGIN + 8, HEADER_Y + 15,
    'Operators ask questions in plain English — answers arrive in seconds.')

# ── Right: Live proof panel — full green border
PNL_X = W - 175; PNL_Y = HEADER_Y + 5; PNL_W = 152; PNL_H = HEADER_H - 10
fill(PNL_X, PNL_Y, PNL_W, PNL_H, HexColor('#0a2015'))
c.setStrokeColor(GREEN); c.setLineWidth(1)
c.rect(PNL_X, PNL_Y, PNL_W, PNL_H, fill=0, stroke=1)
c.setFillColor(GREEN); c.setFont('Helvetica-Bold', 10.3)
c.drawCentredString(PNL_X + PNL_W / 2, HEADER_Y + 105, '● LIVE IN PRODUCTION')

txt(W - 164, HEADER_Y + 84, '617THC — Boston, MA', 'Helvetica-Bold', 10.3, WARM)
txt(W - 164, HEADER_Y + 70, 'In production since 2024', 'Helvetica', 9.2, MUTED2)

for i, line in enumerate([
    '146,000+ orders analyzed',
    '$3.2M+ in revenue processed',
    '+22.4% YoY growth tracked',
    '<15 min per new deployment',
]):
    txt(W - 164, HEADER_Y + 55 - i * 13, '▸ ' + line, 'Helvetica', 9.2, MUTED)

# ══════════════════════════════════════════════════════════════════════════════
# ROW 1 — Problem | Solution  (y = 482 → 637)
# ══════════════════════════════════════════════════════════════════════════════
# Problem
card(MARGIN, R1_Y, COL_W, R1_H, RED)
py = R1_Y + R1_H - 14
py = section_label(MARGIN + INDENT, py, '⚡  The Problem', RED)
txt(MARGIN + INDENT, py, 'Dispensaries Are Flying Blind', 'Helvetica-Bold', 13.2, WARM)
py -= 15
bullets(MARGIN + INDENT, py, [
    'POS systems capture data; deliver almost zero insight',
    'Managers rely on gut feel or week-old spreadsheets',
    'Gross margin, churn risk & trends go unmeasured',
    'No AI tools purpose-built for cannabis retail KPIs',
    'Multi-store operators have zero consolidated view',
], lh=13, size=9.8)

# Solution
sx = MARGIN + COL_W + COL_GAP
card(sx, R1_Y, COL_W, R1_H, GREEN)
py = R1_Y + R1_H - 14
py = section_label(sx + INDENT, py, '✓  The Solution', GREEN)
txt(sx + INDENT, py, 'Ask. Receive. Act.', 'Helvetica-Bold', 13.2, WARM)
py -= 15
bullets(sx + INDENT, py, [
    'Real-time dashboards: revenue, inventory, customers',
    '28 AI-powered tools — plain English queries',
    'Margin, YoY trends, churn risk, lifecycle forecasting',
    'Mobile-responsive: works on any phone, tablet, desktop',
    'Any Flowhub dispensary live in under 15 minutes',
], lh=13, size=9.8)

# ══════════════════════════════════════════════════════════════════════════════
# ROW 2 — Platform Capabilities | Business Model  (y = 309 → 474)
# ══════════════════════════════════════════════════════════════════════════════
# Capabilities
card(MARGIN, R2_Y, COL_W, R2_H, AMBER)
py = R2_Y + R2_H - 14
py = section_label(MARGIN + INDENT, py, '⬡  Platform Capabilities')
txt(MARGIN + INDENT, py, '28 AI Analytics Tools', 'Helvetica-Bold', 13.2, WARM)
py -= 15
bullets(MARGIN + INDENT, py, [
    'Sales dashboards with custom date & time range picker',
    'Natural language AI chat — zero training required',
    'Year-over-year comparisons with 2+ years of history',
    'Product lifecycle: rising / declining / emerging / dead',
    'Gross margin by product, brand, or category',
    'Discount elasticity & promotion ROI analysis',
    'Customer churn risk + loyalty member growth tracking',
    'Inventory velocity, dead stock, fastest-depleting alerts',
], lh=12, size=9.2)

# Business Model
card(sx, R2_Y, COL_W, R2_H, CYAN)
py = R2_Y + R2_H - 14
py = section_label(sx + INDENT, py, '$  Business Model', CYAN)
txt(sx + INDENT, py, 'SaaS × White-Label × Channel', 'Helvetica-Bold', 13.2, WARM)
py -= 15
bullets(sx + INDENT, py, [
    'Per-location SaaS: $199 / store / month',
    'Enterprise pricing for multi-state operators (MSOs)',
    'White-label: license analytics engine to chains',
    'Channel rev-share with Flowhub & other POS networks',
    'Data services: anonymized benchmarking reports',
], lh=12, size=9.2)

# ARR callout box
box_y = R2_Y + 8
box_h = 42
fill(sx + INDENT, box_y, COL_W - INDENT * 2, box_h, CARD)
hline(sx + INDENT, box_y + box_h, sx + COL_W - INDENT, AMBER, 0.5)
c.setFillColor(AMBER); c.setFont('Helvetica-Bold', 11.5)
c.drawString(sx + INDENT + 7, box_y + 27, '10,000 stores × $199/mo  =  $23.9M ARR')
c.setFillColor(MUTED2); c.setFont('Helvetica', 8.0)
c.drawString(sx + INDENT + 7, box_y + 15, 'Flowhub beachhead (1,000 stores) = $2.4M ARR today')
c.setFillColor(HexColor('#555555')); c.setFont('Helvetica', 8.0)
c.drawString(sx + INDENT + 7, box_y + 5, 'Jane + Dutchie + COVA expand TAM to 10,000+ stores')

# ══════════════════════════════════════════════════════════════════════════════
# ROW 3 — Market Opportunity | Why Now & Why Us  (y = 146 → 301)
# ══════════════════════════════════════════════════════════════════════════════
# Market
card(MARGIN, R3_Y, COL_W, R3_H, AMBER)
py = R3_Y + R3_H - 14
py = section_label(MARGIN + INDENT, py, '◈  Market Opportunity')
txt(MARGIN + INDENT, py, 'Massive, Underserved, Growing', 'Helvetica-Bold', 13.2, WARM)
py -= 15
bullets(MARGIN + INDENT, py, [
    'U.S. legal cannabis retail: $30B+ annually (2024)',
    '10,000+ licensed dispensaries in operation',
    'Flowhub: 1,000+ stores — captive, low-friction TAM',
    'Jane, Dutchie, COVA: 9,000+ adjacent stores',
    'Analytics spend per dispensary: near zero today',
    'Germany + emerging intl markets: expansion path',
], lh=13, size=9.8)

# Why Now / Why Us
card(sx, R3_Y, COL_W, R3_H, CYAN)
py = R3_Y + R3_H - 14
py = section_label(sx + INDENT, py, '⟳  Why Now  &  Why Us', CYAN)
txt(sx + INDENT, py, 'Three Tailwinds + Real Moat', 'Helvetica-Bold', 13.2, WARM)
py -= 15
py = bullets(sx + INDENT, py, [
    'Cannabis retail maturing: survival → optimization mode',
    'AI inflection point: operators ready for AI tools now',
    'Margins compressing: data-driven ops now existential',
], lh=13, size=9.8)
py -= 6
txt(sx + INDENT, py, 'Our Competitive Moat:', 'Helvetica-Bold', 9.8, AMBER_LT)
py -= 13
py = bullets(sx + INDENT, py, [
    'Built & proven inside a real dispensary — not a demo',
    'Cannabis-specific KPIs no generic BI tool can match',
    'Zero training: budtenders use it on day one',
], lh=13, size=9.8)

# ══════════════════════════════════════════════════════════════════════════════
# ROW 4 — Traction Stats Bar  (y = 58 → 138)
# ══════════════════════════════════════════════════════════════════════════════
fill(MARGIN, R4_Y, W - 2 * MARGIN, R4_H, CARD)
hline(MARGIN, R4_Y + R4_H, W - MARGIN, BORDER, 1)
hline(MARGIN, R4_Y,        W - MARGIN, BORDER, 0.5)

c.setFillColor(HexColor('#444444')); c.setFont('Helvetica-Bold', 7.5)
c.drawString(MARGIN + INDENT, R4_Y + R4_H - 13,
    'PROVEN TRACTION  ·  617THC  ·  BOSTON, MA  ·  IN PRODUCTION SINCE 2024')

STAT_N   = 5
region_w = W - 2 * MARGIN - 2 * INDENT
stat_w   = region_w / STAT_N
stat_y   = R4_Y + 18

stats = [
    ('146K+',   'Orders Analyzed'),
    ('28',      'AI Query Tools'),
    ('+22.4%',  'YoY Revenue Growth'),
    ('$210K',   '30-Day Forecast'),
    ('<15 min', 'Per-Store Deployment'),
]
for i, (num, lbl) in enumerate(stats):
    cx = MARGIN + INDENT + stat_w * i + stat_w / 2
    c.setFillColor(AMBER); c.setFont('Helvetica-Bold', 21.8)
    c.drawCentredString(cx, stat_y + 16, num)
    c.setFillColor(MUTED2); c.setFont('Helvetica', 7.5)
    c.drawCentredString(cx, stat_y + 4, lbl.upper())
    if i < STAT_N - 1:
        vline(MARGIN + INDENT + stat_w * (i + 1), R4_Y + 10, R4_Y + R4_H - 18, MUTED3, 0.5)

# ══════════════════════════════════════════════════════════════════════════════
# FOOTER  (y = 4 → 50)
# ══════════════════════════════════════════════════════════════════════════════
fill(0, FOOTER_Y, W, FOOTER_H, DARK_CARD)
hline(0, FOOTER_Y + FOOTER_H, W, BORDER, 0.5)

# Left: The Ask
c.setFillColor(HexColor('#444444')); c.setFont('Helvetica-Bold', 6.9)
c.drawString(MARGIN, FOOTER_Y + 34, 'THE ASK')
c.setFillColor(WARM); c.setFont('Helvetica-Bold', 10.9)
c.drawString(MARGIN, FOOTER_Y + 22, 'Seeking capital to scale from 1 store → 100+')
c.setFillColor(MUTED2); c.setFont('Helvetica', 8.6)
c.drawString(MARGIN, FOOTER_Y + 10, 'Use of funds: engineering, sales, Flowhub partnership & multi-POS expansion')

# Center divider
vline(W / 2, FOOTER_Y + 6, FOOTER_Y + FOOTER_H - 6, BORDER, 0.5)

# Right: Contact
c.setFillColor(HexColor('#444444')); c.setFont('Helvetica-Bold', 6.9)
c.drawRightString(W - MARGIN, FOOTER_Y + 34, 'DEVELOPED BY')
c.setFillColor(WARM); c.setFont('Helvetica-Bold', 11.5)
c.drawRightString(W - MARGIN, FOOTER_Y + 21, '617THC  ·  Boston, MA')
c.setFillColor(AMBER); c.setFont('Helvetica', 9.8)
c.drawRightString(W - MARGIN, FOOTER_Y + 9, 'bill@617thc.com')

# ══════════════════════════════════════════════════════════════════════════════
# BOTTOM AMBER BAR
# ══════════════════════════════════════════════════════════════════════════════
fill(0, 0, W, BOTTOM_BAR_H, AMBER)

# ══════════════════════════════════════════════════════════════════════════════
c.save()
print(f'✅  Saved: {OUTPUT}')
