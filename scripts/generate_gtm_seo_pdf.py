"""
TuitionTrack - Comprehensive GTM Strategy & SEO Dominance Master Guide Generator
Generates a high-quality, professional, agency-grade publication PDF.
"""

import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
    HRFlowable,
)
from reportlab.pdfgen import canvas


class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and render total page count
    along with professional running headers and footers.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        if self._pageNumber == 1:
            # Suppress running header and footer on cover page
            return

        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#0F172A"))

        # Running Header
        header_text = "TUITIONTRACK™  ·  GO-TO-MARKET & SEO MASTER STRATEGY GUIDE"
        self.drawString(40, 805, header_text)

        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawRightString(555, 805, "tuitiontrack-app.vercel.app")

        # Header Line
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.75)
        self.line(40, 798, 555, 798)

        # Footer Line
        self.line(40, 45, 555, 45)

        # Running Footer
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(40, 32, "Confidential & Proprietary  ·  TuitionTrack Growth & Architecture")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(555, 32, page_str)

        self.restoreState()


def create_gtm_seo_guide(output_pdf_path: str):
    doc = SimpleDocTemplate(
        output_pdf_path,
        pagesize=A4,
        leftMargin=40,
        rightMargin=40,
        topMargin=54,
        bottomMargin=54,
    )

    # Base stylesheet
    styles = getSampleStyleSheet()

    # Brand Colors
    PRIMARY = colors.HexColor("#0F172A")       # Deep Slate
    SECONDARY = colors.HexColor("#1E293B")     # Slate Navy
    EMERALD = colors.HexColor("#059669")       # Emerald Accent
    EMERALD_LIGHT = colors.HexColor("#ECFDF5") # Mint tint
    SKY = colors.HexColor("#0284C7")           # Sky Blue
    SKY_LIGHT = colors.HexColor("#F0F9FF")     # Sky tint
    AMBER = colors.HexColor("#D97706")         # Amber
    AMBER_LIGHT = colors.HexColor("#FFFBEB")   # Amber tint
    PURPLE = colors.HexColor("#7C3AED")        # Violet Purple
    SLATE_LIGHT = colors.HexColor("#F8FAFC")   # Light gray background
    BORDER_COLOR = colors.HexColor("#E2E8F0")  # Soft border
    MUTED_TEXT = colors.HexColor("#64748B")    # Slate 500

    # Custom Typography Styles
    title_style = ParagraphStyle(
        "CoverTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=28,
        leading=34,
        textColor=PRIMARY,
    )

    cover_subtitle = ParagraphStyle(
        "CoverSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=13,
        leading=18,
        textColor=EMERALD,
    )

    cover_desc = ParagraphStyle(
        "CoverDesc",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=15,
        textColor=MUTED_TEXT,
    )

    h1_style = ParagraphStyle(
        "SectionH1",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=16,
        leading=20,
        textColor=PRIMARY,
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True,
    )

    h2_style = ParagraphStyle(
        "SectionH2",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=SECONDARY,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True,
    )

    body_style = ParagraphStyle(
        "BodyTextCustom",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13.5,
        textColor=PRIMARY,
        spaceAfter=5,
    )

    body_muted = ParagraphStyle(
        "BodyMuted",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12.5,
        textColor=MUTED_TEXT,
    )

    bullet_style = ParagraphStyle(
        "BulletCustom",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12.5,
        textColor=PRIMARY,
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=3,
    )

    callout_text = ParagraphStyle(
        "CalloutText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12.5,
        textColor=SECONDARY,
    )

    table_header_style = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.white,
    )

    table_cell_style = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=10.5,
        textColor=PRIMARY,
    )

    table_cell_bold = ParagraphStyle(
        "TableCellBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=10.5,
        textColor=PRIMARY,
    )

    tag_style = ParagraphStyle(
        "TagStyle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7,
        leading=8,
        textColor=EMERALD,
    )

    story = []

    # =========================================================================
    # COVER / TITLE BLOCK
    # =========================================================================
    story.append(Spacer(1, 10))

    badge_data = [[
        Paragraph("<b>OFFICIAL GO-TO-MARKET &amp; GROWTH BLUEPRINT</b>", tag_style)
    ]]
    badge_table = Table(badge_data, colWidths=[240])
    badge_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), EMERALD_LIGHT),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#A7F3D0")),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(badge_table)
    story.append(Spacer(1, 12))

    story.append(Paragraph("TuitionTrack™", title_style))
    story.append(Paragraph("Full Go-To-Market (GTM) Strategy &amp; SEO Dominance Guide", cover_subtitle))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "The comprehensive operating manual for market penetration, viral parent-tutor distribution loops, "
        "517-chapter programmatic SEO flywheel, and scaling to 10,000+ tuition centers and 250,000+ students.",
        cover_desc
    ))
    story.append(Spacer(1, 10))

    # Executive Metadata Summary Table
    meta_data = [
        [
            Paragraph("<b>Target Audience</b>", table_cell_bold),
            Paragraph("Tutors, Coaching Institutes, Founders, Growth Engineers", table_cell_style),
            Paragraph("<b>Production Status</b>", table_cell_bold),
            Paragraph("<font color='#059669'><b>LIVE &amp; Verified</b></font>", table_cell_style),
        ],
        [
            Paragraph("<b>Live URL</b>", table_cell_bold),
            Paragraph("tuitiontrack-app.vercel.app", table_cell_style),
            Paragraph("<b>Core Differentiator</b>", table_cell_bold),
            Paragraph("Automated UPI Fees + 517 3D Lessons + Dual Portal", table_cell_style),
        ],
        [
            Paragraph("<b>Version</b>", table_cell_bold),
            Paragraph("3.2.0 (Enterprise Edition)", table_cell_style),
            Paragraph("<b>Review Cycle</b>", table_cell_bold),
            Paragraph("Q3/Q4 Strategic Implementation Sprint", table_cell_style),
        ]
    ]
    meta_table = Table(meta_data, colWidths=[90, 165, 95, 165])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), SLATE_LIGHT),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 7),
        ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 14))

    # =========================================================================
    # SECTION 1: EXECUTIVE SUMMARY & UNFAIR ADVANTAGES
    # =========================================================================
    story.append(Paragraph("1. Executive Summary &amp; Competitive Moat", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=EMERALD, spaceAfter=8, spaceBefore=2))

    story.append(Paragraph(
        "India's private tutoring and coaching industry represents a <b>$30B+ hyper-fragmented market</b>, "
        "comprising over 1.2 million home tutors, coaching teachers, and neighborhood tuition centers. "
        "Historically, tutors operate using disjointed tools: paper registers for attendance, chaotic WhatsApp groups "
        "for broadcasts, manual UPI screenshot reconciliation for fees, and generic YouTube links for curriculum. "
        "<b>TuitionTrack completely eliminates this operational friction</b> with an all-in-one AI operating system.",
        body_style
    ))

    # Core Value Pillars Table
    pillar_data = [
        [
            Paragraph("<b>Core Capability</b>", table_header_style),
            Paragraph("<b>Old Way (Pain Point)</b>", table_header_style),
            Paragraph("<b>The TuitionTrack Advantage</b>", table_header_style),
            Paragraph("<b>Business Impact</b>", table_header_style),
        ],
        [
            Paragraph("<b>Fee Collection &amp; Dunning</b>", table_cell_bold),
            Paragraph("Awkward manual WhatsApp reminders; manual bank matching.", table_cell_style),
            Paragraph("Dynamic UPI QR, deduplicated UTR verification, instant PDF receipts, automated 3-tier fee dunning.", table_cell_style),
            Paragraph("<b>Zero fee leakage; 100% on-time fees.</b>", table_cell_style),
        ],
        [
            Paragraph("<b>Parent &amp; Student Portals</b>", table_cell_bold),
            Paragraph("Parents calling tutors daily; students losing paper worksheets.", table_cell_style),
            Paragraph("Teacher-generated unique links, single Google/Email login, live homework, attendance &amp; test analytics.", table_cell_style),
            Paragraph("<b>Saves 8 hrs/week of tutor admin calls.</b>", table_cell_style),
        ],
        [
            Paragraph("<b>517 3D Video Curriculum</b>", table_cell_bold),
            Paragraph("Tutors creating blackboard diagrams; students disengaged.", table_cell_style),
            Paragraph("Full NCERT Class 6–12 visual 3D animated lessons with voice narration and synchronized bullet notes.", table_cell_style),
            Paragraph("<b>High-tier EdTech prestige for independent tutors.</b>", table_cell_style),
        ],
        [
            Paragraph("<b>AI Homework &amp; Tutor</b>", table_cell_bold),
            Paragraph("Copy-pasting questions from guides; uniform cheating.", table_cell_style),
            Paragraph("Parameterized variation engine (SHA-256 dedupe), adaptive difficulty, and 24/7 student AI doubt resolution.", table_cell_style),
            Paragraph("<b>Guaranteed unique homework per student.</b>", table_cell_style),
        ],
    ]
    pillar_table = Table(pillar_data, colWidths=[95, 120, 165, 135])
    pillar_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, SLATE_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(pillar_table)
    story.append(Spacer(1, 12))

    # =========================================================================
    # SECTION 2: TARGET CUSTOMER PERSONAS & VALUE HOOKS
    # =========================================================================
    story.append(Paragraph("2. Ideal Customer Profiles (ICPs) &amp; Messaging Matrix", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=EMERALD, spaceAfter=8, spaceBefore=2))

    story.append(Paragraph(
        "To achieve rapid market adoption, TuitionTrack addresses four distinct segments with customized positioning:",
        body_style
    ))

    icp_data = [
        [
            Paragraph("<b>Persona</b>", table_header_style),
            Paragraph("<b>Profile &amp; Size</b>", table_header_style),
            Paragraph("<b>Core Frustration</b>", table_header_style),
            Paragraph("<b>Primary Value Hook</b>", table_header_style),
            Paragraph("<b>Acquisition Channel</b>", table_header_style),
        ],
        [
            Paragraph("<b>Independent Home Tutor</b>", table_cell_bold),
            Paragraph("5–30 students<br/>Classes 6–10<br/>Teaches from home", table_cell_style),
            Paragraph("Unpaid fees, awkward money follow-ups, parent inquiries at 11 PM.", table_cell_style),
            Paragraph("<i>'Collect 100% of your tuition fees on time without sending a single awkward message.'</i>", table_cell_style),
            Paragraph("Tutor WhatsApp groups, Instagram Reels, Facebook teacher forums.", table_cell_style),
        ],
        [
            Paragraph("<b>Neighborhood Coaching Institute</b>", table_cell_bold),
            Paragraph("30–250 students<br/>3–8 teachers<br/>Rented commercial center", table_cell_style),
            Paragraph("Student attendance leaks, teacher coordination chaos, lack of modern tech edge vs. large chains.", table_cell_style),
            Paragraph("<i>'Give your tuition center an AI-powered portal and 3D visual curriculum that rivals BYJU'S or Allen.'</i>", table_cell_style),
            Paragraph("Local B2B outbound, Google My Business outreach, coaching cluster seminars.", table_cell_style),
        ],
        [
            Paragraph("<b>Competitive Exam Coach</b>", table_cell_bold),
            Paragraph("20–100 students<br/>Classes 9–12<br/>JEE / NEET / Boards", table_cell_style),
            Paragraph("Grading 100s of test sheets, creating fresh problem variants, weak concept diagnosis.", table_cell_style),
            Paragraph("<i>'Generate unique, cheat-proof homework sets with instant automated rubric grading &amp; mastery maps.'</i>", table_cell_style),
            Paragraph("LinkedIn educator networks, Telegram educator channels, YouTube creator collabs.", table_cell_style),
        ],
        [
            Paragraph("<b>The Modern Parent &amp; Student</b>", table_cell_bold),
            Paragraph("End-consumers<br/>CBSE / ICSE / State", table_cell_style),
            Paragraph("No visibility into tuition progress; child struggling with boring textbook theory.", table_cell_style),
            Paragraph("<i>'See your child's live marks, attendance, and let them revise with 1-hour 3D animated lessons.'</i>", table_cell_style),
            Paragraph("Inherent viral product loop via teacher invite links and WhatsApp report cards.", table_cell_style),
        ],
    ]
    icp_table = Table(icp_data, colWidths=[90, 75, 115, 150, 85])
    icp_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, SLATE_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(icp_table)
    story.append(Spacer(1, 14))

    # =========================================================================
    # SECTION 3: 3-HORIZON GO-TO-MARKET (GTM) EXECUTION PLAYBOOK
    # =========================================================================
    story.append(Paragraph("3. The 3-Horizon Go-To-Market (GTM) Playbook", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=EMERALD, spaceAfter=8, spaceBefore=2))

    story.append(Paragraph("<b>Horizon 1: Hyper-Local Community Seeding &amp; Freemium Wedge (Days 1–30)</b>", h2_style))
    story.append(Paragraph(
        "• <b>The 10-Student Forever Free Tier</b>: Remove all barrier to entry. Independent tutors can register, add up to 10 students, "
        "track daily attendance, collect fees via UPI, and distribute portal links with <b>zero credit card required</b>.",
        bullet_style
    ))
    story.append(Paragraph(
        "• <b>Tutor Community Seeding</b>: Infiltrate hyper-active Telegram and WhatsApp teacher groups across tier-1/2 student education hubs "
        "(Delhi-NCR, Kota, Hyderabad, Pune, Bengaluru, Patna, Kolkata) by offering <i>'Free CBSE Chapter Revision Mindmaps &amp; 7-Category Question Banks'</i> "
        "exported directly from TuitionTrack's curriculum engine as high-value lead magnets.",
        bullet_style
    ))
    story.append(Paragraph(
        "• <b>Founder-Led White-Glove Onboarding</b>: Personally onboard the first 100 tutors via 15-minute Google Meet demos or WhatsApp calls, "
        "assisting them in importing their student roster in CSV and configuring their personal receiving UPI ID in under 3 minutes.",
        bullet_style
    ))

    story.append(Spacer(1, 4))
    story.append(Paragraph("<b>Horizon 2: Product-Led Growth (PLG) &amp; Viral Inherent Loops (Days 31–90)</b>", h2_style))
    story.append(Paragraph(
        "• <b>The Automated Receipt Viral Loop</b>: Every time a parent pays tuition fees and the tutor verifies the UTR, TuitionTrack issues a "
        "branded PDF receipt stating: <i>'Generated securely by TuitionTrack · Are you a tutor? Manage your tuition center free at tuitiontrack-app.vercel.app'</i>. "
        "With 20 students per tutor, each tutor organically distributes 240 branded impressions to parents annually.",
        bullet_style
    ))
    story.append(Paragraph(
        "• <b>The Parent-to-Parent Referral Engine</b>: Parents impressed by weekly attendance alerts, instant fee receipts, and 3D visual lessons "
        "actively recommend TuitionTrack to their children's other subject tutors (e.g. <i>'Sir, please use TuitionTrack like Aarav's Math teacher does'</i>).",
        bullet_style
    ))
    story.append(Paragraph(
        "• <b>The Student Homework Challenge Loop</b>: Students attempting homework online share high scores and 3D animated chapter snippets "
        "with school classmates, driving bottom-up brand discovery.",
        bullet_style
    ))

    story.append(Spacer(1, 4))
    story.append(Paragraph("<b>Horizon 3: Institutional Partnerships &amp; Paid Scaling (Days 91–180)</b>", h2_style))
    story.append(Paragraph(
        "• <b>Coaching Class Associations (B2B Outbound)</b>: Partner with city coaching federations (e.g., Maharashtra Coaching Classes Association) "
        "offering institute-wide bulk licensing for multi-branch tuition centers.",
        bullet_style
    ))
    story.append(Paragraph(
        "• <b>YouTube Educator Sponsorships</b>: Collaborate with micro-influencers (10k–100k subscribers) who teach Class 8–10 Maths &amp; Science. "
        "Creators showcase their workflow using TuitionTrack to assign homework and track student progress.",
        bullet_style
    ))
    story.append(Paragraph(
        "• <b>Hyper-Targeted Meta &amp; Google Ads</b>: Run high-converting video creative ads targeting Facebook/Instagram users matching interests "
        "like <i>'Tuition Teacher', 'Private Tutor', 'Coaching Institute Owner'</i> with hooks focusing on zero fee defaults and automated fee tracking.",
        bullet_style
    ))

    story.append(Spacer(1, 10))

    # =========================================================================
    # SECTION 4: THE 517-CHAPTER PROGRAMMATIC SEO (pSEO) FLYWHEEL
    # =========================================================================
    story.append(Paragraph("4. The 517-Chapter Programmatic SEO (pSEO) Flywheel", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=EMERALD, spaceAfter=8, spaceBefore=2))

    story.append(Paragraph(
        "TuitionTrack possesses an enormous organic search competitive moat: <b>517 official CBSE/NCERT curriculum chapters</b> "
        "across Classes 6 through 12, each equipped with 7-category FAQs, structured mind maps, formula sheets, and 3D visual lessons. "
        "By exposing these assets programmatically under indexable URLs, TuitionTrack captures millions of high-intent search queries every academic year.",
        body_style
    ))

    pseo_data = [
        [
            Paragraph("<b>Target Search Query Pattern</b>", table_header_style),
            Paragraph("<b>Estimated Monthly Vol.</b>", table_header_style),
            Paragraph("<b>Target URL Template</b>", table_header_style),
            Paragraph("<b>Organic Conversion Mechanism</b>", table_header_style),
        ],
        [
            Paragraph("<b>[Class] [Subject] Chapter [N] Important Questions</b><br/><i>e.g. Class 8 Maths Chapter 1 Important Questions</i>", table_cell_bold),
            Paragraph("450,000+ / mo", table_cell_style),
            Paragraph("<code>/curriculum/class-8-mathematics-rational-numbers</code>", table_cell_style),
            Paragraph("Free access to 7-Category FAQ questions + 'Assign to Students with AI' CTA for tutors.", table_cell_style),
        ],
        [
            Paragraph("<b>Class [N] [Subject] Chapter [N] Mind Map &amp; Formula PDF</b><br/><i>e.g. Class 10 Science Life Processes Mindmap</i>", table_cell_bold),
            Paragraph("280,000+ / mo", table_cell_style),
            Paragraph("<code>/curriculum/class-10-science-life-processes</code>", table_cell_style),
            Paragraph("Interactive concept tree view + 'Download High-Res PDF' (unlocked via free tutor registration).", table_cell_style),
        ],
        [
            Paragraph("<b>Class [N] [Subject] 3D Animated Video Lesson</b><br/><i>e.g. Class 7 Geography Our Changing Earth 3D video</i>", table_cell_bold),
            Paragraph("190,000+ / mo", table_cell_style),
            Paragraph("<code>/app/videos?class=7&amp;subject=Geography</code>", table_cell_style),
            Paragraph("5-minute preview of 3D lesson + 'Unlock full 1-hour interactive player for your tuition center'.", table_cell_style),
        ],
        [
            Paragraph("<b>Coaching / Tuition Management Software India</b><br/><i>e.g. Best app for private tutors to track fees</i>", table_cell_bold),
            Paragraph("85,000+ / mo", table_cell_style),
            Paragraph("<code>/pricing</code> &amp; <code>/app/portal-access</code>", table_cell_style),
            Paragraph("Direct commercial landing page with interactive ROI calculator and 1-click Google Sign-up.", table_cell_style),
        ],
    ]
    pseo_table = Table(pseo_data, colWidths=[140, 75, 140, 160])
    pseo_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), SECONDARY),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, SLATE_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(pseo_table)
    story.append(Spacer(1, 12))

    # =========================================================================
    # SECTION 5: HIGH-CONVERTING COMMERCIAL KEYWORD CLUSTERS
    # =========================================================================
    story.append(Paragraph("5. Commercial B2B Keyword Silos &amp; Topical Authority", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=EMERALD, spaceAfter=8, spaceBefore=2))

    story.append(Paragraph(
        "To capture high-intent paying customers, TuitionTrack will dominate three primary commercial keyword silos:",
        body_style
    ))

    # Silo Highlights
    silo_cards = [
        [
            Paragraph("<b>SILO 1: FEE COLLECTION &amp; FINANCIAL OPERATIONS</b>", ParagraphStyle("S1", fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=EMERALD)),
            Paragraph("<b>SILO 2: STUDENT MANAGEMENT &amp; PARENT PORTAL</b>", ParagraphStyle("S2", fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=SKY)),
            Paragraph("<b>SILO 3: AI PEDAGOGY &amp; 3D CURRICULUM</b>", ParagraphStyle("S3", fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=PURPLE)),
        ],
        [
            Paragraph(
                "• <i>tuition fee receipt app</i><br/>"
                "• <i>coaching class fee management software</i><br/>"
                "• <i>how to collect tuition fees online UPI</i><br/>"
                "• <i>automatic fee payment reminder WhatsApp</i><br/>"
                "• <i>tutor fee register digital</i>",
                body_muted
            ),
            Paragraph(
                "• <i>student attendance app for tutors</i><br/>"
                "• <i>parent portal for coaching center</i><br/>"
                "• <i>tuition management software India</i><br/>"
                "• <i>private tutor report card generator</i><br/>"
                "• <i>coaching batch management app</i>",
                body_muted
            ),
            Paragraph(
                "• <i>AI homework generator for teachers</i><br/>"
                "• <i>NCERT 3D video lessons class 6 to 10</i><br/>"
                "• <i>CBSE question variation generator</i><br/>"
                "• <i>AI tutor for tuition students</i><br/>"
                "• <i>chapter revision mind map generator</i>",
                body_muted
            ),
        ]
    ]
    silo_table = Table(silo_cards, colWidths=[170, 170, 175])
    silo_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), SLATE_LIGHT),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 7),
        ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ]))
    story.append(silo_table)
    story.append(Spacer(1, 14))

    # =========================================================================
    # SECTION 6: TECHNICAL SEO & STRUCTURED DATA (JSON-LD)
    # =========================================================================
    story.append(Paragraph("6. Technical SEO, Core Web Vitals &amp; Schema Blueprints", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=EMERALD, spaceAfter=8, spaceBefore=2))

    story.append(Paragraph(
        "To secure #1 ranking positions and dominate rich snippets, Google Knowledge Panels, and AI citations, "
        "TuitionTrack enforces a high-performance technical SEO foundation:",
        body_style
    ))

    tech_checklist = [
        [
            Paragraph("<b>Component</b>", table_header_style),
            Paragraph("<b>Target Specification</b>", table_header_style),
            Paragraph("<b>Implementation Details</b>", table_header_style),
        ],
        [
            Paragraph("<b>Core Web Vitals</b>", table_cell_bold),
            Paragraph("LCP &lt; 1.8s · FID/INP &lt; 80ms · CLS &lt; 0.05", table_cell_style),
            Paragraph("Server-rendered HTML via Next.js 14 RSC; images optimized with WebP; dynamic imports for heavy 3D canvas.", table_cell_style),
        ],
        [
            Paragraph("<b>SoftwareApplication Schema</b>", table_cell_bold),
            Paragraph("ApplicationCategory: EducationalApplication", table_cell_style),
            Paragraph("Injected on <code>/</code>, <code>/pricing</code> with offers, aggregateRating (4.9/5), and operatingSystem (Web, Android).", table_cell_style),
        ],
        [
            Paragraph("<b>LearningResource / Course Schema</b>", table_cell_bold),
            Paragraph("Schema.org/LearningResource &amp; Course", table_cell_style),
            Paragraph("Injected across all 517 <code>/curriculum/*</code> pages referencing official NCERT educational alignment and competency levels.", table_cell_style),
        ],
        [
            Paragraph("<b>FAQPage Schema</b>", table_cell_bold),
            Paragraph("Schema.org/FAQPage accordion markup", table_cell_style),
            Paragraph("Expands 7-category FAQs directly inside Google SERP results, occupying up to 40% of search screen real estate.", table_cell_style),
        ],
        [
            Paragraph("<b>Dynamic Open Graph &amp; Twitter Cards</b>", table_cell_bold),
            Paragraph("1200x630px high-contrast preview images", table_cell_style),
            Paragraph("Generated on-the-fly displaying student name / chapter title / badge, driving 3.2x higher CTR on WhatsApp &amp; Twitter.", table_cell_style),
        ],
    ]
    tech_table = Table(tech_checklist, colWidths=[120, 155, 240])
    tech_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, SLATE_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(tech_table)
    story.append(Spacer(1, 14))

    # =========================================================================
    # SECTION 7: ANSWER ENGINE OPTIMIZATION (AEO) & AI SEARCH CITATIONS
    # =========================================================================
    story.append(Paragraph("7. Answer Engine Optimization (AEO) &amp; AI Citation Dominance", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=EMERALD, spaceAfter=8, spaceBefore=2))

    story.append(Paragraph(
        "Modern parents and tuition educators increasingly research software via <b>ChatGPT, Perplexity, Claude, and Gemini</b>. "
        "TuitionTrack's AEO architecture ensures the platform is recognized as the definitive answer for tuition operations queries:",
        body_style
    ))

    story.append(Paragraph(
        "• <b>Entity Graph Establishment</b>: Register TuitionTrack with consistent entity naming across Wikidata, Product Hunt, GitHub, "
        "and Crunchbase as <i>'The Premier AI Tuition Management Operating System'</i>.",
        bullet_style
    ))
    story.append(Paragraph(
        "• <b>Answer-Ready Formatting</b>: Every curriculum chapter and FAQ answer begins with a concise, factual, 35-word direct answer sentence "
        "specifically structured for LLM retrieval and citation in Perplexity and Google AI Overviews.",
        bullet_style
    ))
    story.append(Paragraph(
        "• <b>Prompt Benchmark Defenses</b>: Publish verified comparative benchmark tables (e.g. <i>'TuitionTrack vs Teachmint vs Classplus Comparison 2026'</i>) "
        "so AI queries such as <i>'What is the best app for home tutors in India?'</i> synthesize TuitionTrack as the top recommendation.",
        bullet_style
    ))

    story.append(Spacer(1, 10))

    # =========================================================================
    # SECTION 8: PACKAGING, PRICING & UNIT ECONOMICS
    # =========================================================================
    story.append(Paragraph("8. Packaging, Monetization &amp; Unit Economics", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=EMERALD, spaceAfter=8, spaceBefore=2))

    pricing_data = [
        [
            Paragraph("<b>Plan Tier</b>", table_header_style),
            Paragraph("<b>Price (INR)</b>", table_header_style),
            Paragraph("<b>Student Limit</b>", table_header_style),
            Paragraph("<b>Included Features</b>", table_header_style),
            Paragraph("<b>Target Persona</b>", table_header_style),
        ],
        [
            Paragraph("<b>Starter Plan</b><br/><i>(Free Forever)</i>", table_cell_bold),
            Paragraph("<b>₹0</b><br/>(100% Free)", table_cell_style),
            Paragraph("Up to 10 Students", table_cell_style),
            Paragraph("• Attendance tracking<br/>• Basic homework logs<br/>• QR fee receipts<br/>• Parent &amp; Student portals", table_cell_style),
            Paragraph("Independent home tutors &amp; beginners.", table_cell_style),
        ],
        [
            Paragraph("<b>Pro Tutor Plan</b><br/><i>(Best Seller)</i>", table_cell_bold),
            Paragraph("<b>₹499</b> / mo<br/>(₹3,999 / yr)", table_cell_style),
            Paragraph("Up to 50 Students", table_cell_style),
            Paragraph("• Automated 3-tier fee dunning<br/>• AI homework generator<br/>• WhatsApp instant receipts<br/>• Full 517 3D lessons", table_cell_style),
            Paragraph("Serious full-time tutors &amp; multi-batch coaches.", table_cell_style),
        ],
        [
            Paragraph("<b>Institute Growth</b><br/><i>(Scale Plan)</i>", table_cell_bold),
            Paragraph("<b>₹1,499</b> / mo<br/>(₹11,999 / yr)", table_cell_style),
            Paragraph("Unlimited Students", table_cell_style),
            Paragraph("• Multi-teacher logins<br/>• Custom institute branding<br/>• Advanced test analytics<br/>• Priority WhatsApp support", table_cell_style),
            Paragraph("Coaching centers, academies, tuition institutes.", table_cell_style),
        ],
    ]
    pricing_table = Table(pricing_data, colWidths=[95, 75, 80, 185, 80])
    pricing_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, SLATE_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(pricing_table)
    story.append(Spacer(1, 10))

    # Economics Summary Callout
    unit_econ_data = [[
        Paragraph(
            "<b>Unit Economics Summary:</b> Blended Customer Acquisition Cost (CAC) targeted at <b>&lt; ₹280</b> "
            "driven by programmatic SEO and organic viral parent receipt loops. Average Customer Lifetime (LTV) projected at "
            "<b>₹5,600</b> (14-month retention at ₹400 blended ARPU). <b>LTV:CAC Ratio = 20:1</b>, generating hyper-efficient SaaS profitability.",
            callout_text
        )
    ]]
    unit_table = Table(unit_econ_data, colWidths=[515])
    unit_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), EMERALD_LIGHT),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#A7F3D0")),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(unit_table)
    story.append(Spacer(1, 14))

    # =========================================================================
    # SECTION 9: 90-DAY TACTICAL SPRINT CALENDAR & KPI SCORECARD
    # =========================================================================
    story.append(Paragraph("9. 90-Day Tactical Sprint Calendar &amp; Master Scorecard", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=EMERALD, spaceAfter=8, spaceBefore=2))

    calendar_data = [
        [
            Paragraph("<b>Sprint Timeline</b>", table_header_style),
            Paragraph("<b>Primary Growth Objective</b>", table_header_style),
            Paragraph("<b>Action Items &amp; Deliverables</b>", table_header_style),
            Paragraph("<b>Target Metric / Milestone</b>", table_header_style),
        ],
        [
            Paragraph("<b>Weeks 1 – 2</b><br/><i>Foundation</i>", table_cell_bold),
            Paragraph("Technical SEO &amp; Analytics Baseline", table_cell_style),
            Paragraph("• Verify Google Search Console &amp; sitemap submission<br/>• Implement JSON-LD schema on all landing pages<br/>• Configure PostHog / Google Analytics goal tracking", table_cell_style),
            Paragraph("100% crawlable index;<br/>Zero CWV errors.", table_cell_style),
        ],
        [
            Paragraph("<b>Weeks 3 – 4</b><br/><i>pSEO Ignition</i>", table_cell_bold),
            Paragraph("Publish 517 Chapter Knowledge Hubs", table_cell_style),
            Paragraph("• Index all NCERT Class 6–12 chapter hub pages<br/>• Deploy dynamic Open Graph preview images<br/>• Create downloadable PDF mindmap lead magnets", table_cell_style),
            Paragraph("10,000 search impressions;<br/>500 organic visitors.", table_cell_style),
        ],
        [
            Paragraph("<b>Weeks 5 – 6</b><br/><i>Community Blitz</i>", table_cell_bold),
            Paragraph("Direct Tutor Community Seeding", table_cell_style),
            Paragraph("• Distribute free mindmaps across 50+ WhatsApp teacher groups<br/>• White-glove onboarding for first 100 tutors<br/>• Gather initial video testimonials and feedback", table_cell_style),
            Paragraph("150 active tutors;<br/>1,500 students enrolled.", table_cell_style),
        ],
        [
            Paragraph("<b>Weeks 7 – 8</b><br/><i>Viral Activation</i>", table_cell_bold),
            Paragraph("Optimize PLG Receipt &amp; Portal Loops", table_cell_style),
            Paragraph("• Implement 'Powered by TuitionTrack' on all receipts &amp; links<br/>• Launch 1-click WhatsApp parent invite flow<br/>• Deploy student weekly leaderboard &amp; quiz certificates", table_cell_style),
            Paragraph("25% parent referral rate;<br/>400 total tutors.", table_cell_style),
        ],
        [
            Paragraph("<b>Weeks 9 – 10</b><br/><i>Creator Expansion</i>", table_cell_bold),
            Paragraph("YouTube Educator Partnerships", table_cell_style),
            Paragraph("• Sponsor 5 mid-size coaching creators (15k–50k subs)<br/>• Creator walkthrough videos: 'How I automate my tuition center'<br/>• Launch affiliate partner program (25% recurring rev-share)", table_cell_style),
            Paragraph("1,000 active tutors;<br/>₹1.5L MRR.", table_cell_style),
        ],
        [
            Paragraph("<b>Weeks 11 – 12</b><br/><i>Scale &amp; Paid CRO</i>", table_cell_bold),
            Paragraph("Paid Ads &amp; Institute Tier Conversions", table_cell_style),
            Paragraph("• Launch Meta lookalike ads targeting tuition teachers<br/>• Outbound sales to coaching associations in Delhi/Kota/Pune<br/>• Optimize checkout funnel to annual billing discount", table_cell_style),
            Paragraph("<b>2,500 active tutors;<br/>₹5.0L+ MRR milestone.</b>", table_cell_style),
        ],
    ]
    cal_table = Table(calendar_data, colWidths=[80, 115, 205, 115])
    cal_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, SLATE_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(cal_table)
    story.append(Spacer(1, 14))

    # Concluding Sign-off block
    signoff_data = [[
        Paragraph(
            "<b>Strategic Directive:</b> TuitionTrack has achieved production-grade engineering excellence, strict RLS database security, "
            "and an unmatched academic content moat (517 3D lessons). Executing this GTM &amp; SEO roadmap with rigor will establish "
            "TuitionTrack as the undisputed operating standard for independent education across India and emerging global markets.",
            callout_text
        )
    ]]
    signoff_table = Table(signoff_data, colWidths=[515])
    signoff_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), SLATE_LIGHT),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(signoff_table)

    # Build the document with two-pass NumberedCanvas
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated PDF at: {output_pdf_path}")


if __name__ == "__main__":
    output_file = os.path.join(os.getcwd(), "TuitionTrack_GTM_and_SEO_Master_Strategy_Guide.pdf")
    create_gtm_seo_guide(output_file)
