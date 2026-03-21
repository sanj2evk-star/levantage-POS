#!/usr/bin/env python3
"""Generate Le Vantage Print Proxy Setup Guide PDF"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.units import inch, mm
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    KeepTogether, HRFlowable
)

OUTPUT_FILE = "LeVantage-PrintProxy-Setup-Guide.pdf"

# Colors
AMBER = HexColor("#d97706")
AMBER_LIGHT = HexColor("#fef3c7")
AMBER_DARK = HexColor("#92400e")
GREEN = HexColor("#16a34a")
GREEN_LIGHT = HexColor("#dcfce7")
BLUE = HexColor("#2563eb")
BLUE_LIGHT = HexColor("#dbeafe")
GRAY = HexColor("#6b7280")
GRAY_LIGHT = HexColor("#f3f4f6")
RED = HexColor("#dc2626")
RED_LIGHT = HexColor("#fee2e2")

def build_pdf():
    doc = SimpleDocTemplate(
        OUTPUT_FILE,
        pagesize=A4,
        topMargin=0.6*inch,
        bottomMargin=0.6*inch,
        leftMargin=0.75*inch,
        rightMargin=0.75*inch,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle', parent=styles['Title'],
        fontSize=28, textColor=AMBER_DARK, spaceAfter=6,
        fontName='Helvetica-Bold',
    )
    subtitle_style = ParagraphStyle(
        'Subtitle', parent=styles['Normal'],
        fontSize=12, textColor=GRAY, spaceAfter=20,
        fontName='Helvetica',
    )
    heading_style = ParagraphStyle(
        'CustomHeading', parent=styles['Heading1'],
        fontSize=18, textColor=AMBER_DARK, spaceBefore=20, spaceAfter=10,
        fontName='Helvetica-Bold',
    )
    subheading_style = ParagraphStyle(
        'CustomSubheading', parent=styles['Heading2'],
        fontSize=14, textColor=black, spaceBefore=14, spaceAfter=6,
        fontName='Helvetica-Bold',
    )
    body_style = ParagraphStyle(
        'CustomBody', parent=styles['Normal'],
        fontSize=11, leading=16, spaceAfter=6,
        fontName='Helvetica',
    )
    step_style = ParagraphStyle(
        'StepStyle', parent=styles['Normal'],
        fontSize=11, leading=16, spaceAfter=4,
        fontName='Helvetica', leftIndent=20,
    )
    code_style = ParagraphStyle(
        'CodeStyle', parent=styles['Normal'],
        fontSize=9.5, leading=14, spaceAfter=8,
        fontName='Courier', backColor=GRAY_LIGHT,
        leftIndent=10, rightIndent=10,
        borderPadding=(6, 6, 6, 6),
    )
    note_style = ParagraphStyle(
        'NoteStyle', parent=styles['Normal'],
        fontSize=10, leading=14, spaceAfter=8,
        fontName='Helvetica-Oblique', textColor=GRAY,
        leftIndent=20,
    )
    bold_style = ParagraphStyle(
        'BoldBody', parent=body_style,
        fontName='Helvetica-Bold',
    )

    story = []

    # ---- TITLE ----
    story.append(Spacer(1, 0.3*inch))
    story.append(Paragraph("Le Vantage Cafe", title_style))
    story.append(Paragraph("Print Proxy Setup Guide", ParagraphStyle(
        'TitleSub', parent=title_style, fontSize=20, textColor=AMBER, spaceAfter=8,
    )))
    story.append(Paragraph("How to install the print system on the cashier's Windows laptop", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=AMBER, spaceAfter=20))

    # ---- WHAT IS THIS? ----
    story.append(Paragraph("What is the Print Proxy?", heading_style))
    story.append(Paragraph(
        "The Print Proxy is a small program that runs on your Windows laptop. "
        "It listens for print jobs from the Le Vantage POS web app and sends them "
        "to your thermal printers (Kitchen, Cafe, Bar, Billing) over the local network.",
        body_style
    ))
    story.append(Spacer(1, 6))

    # Info box
    info_data = [[Paragraph(
        "<b>Printers on your network:</b><br/>"
        "- Billing/Cashier: 192.168.1.200<br/>"
        "- Kitchen: 192.168.1.160<br/>"
        "- Cafe/Coffee: 192.168.1.216<br/>"
        "- Bar/Mocktail: 192.168.1.229",
        ParagraphStyle('InfoText', parent=body_style, fontSize=10, leading=15)
    )]]
    info_table = Table(info_data, colWidths=[doc.width])
    info_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BLUE_LIGHT),
        ('BOX', (0, 0), (-1, -1), 1, BLUE),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 10))

    # ---- PREREQUISITES ----
    story.append(Paragraph("What You Need", heading_style))

    prereq_items = [
        ["1.", "Windows laptop (the cashier's laptop)"],
        ["2.", "Internet connection (for initial download)"],
        ["3.", "Both laptop and printers on the same WiFi/LAN network"],
        ["4.", "Your Supabase Anon Key (you already have this)"],
    ]
    for item in prereq_items:
        story.append(Paragraph(
            f"<b>{item[0]}</b> {item[1]}",
            step_style
        ))
    story.append(Spacer(1, 6))

    # ---- STEP 1 ----
    story.append(Paragraph("Step 1: Install Node.js", heading_style))
    story.append(Paragraph(
        "Node.js is the engine that runs the print proxy. If it's already installed, skip this step.",
        body_style
    ))
    story.append(Spacer(1, 4))

    steps_1 = [
        "Open a web browser on the cashier's laptop",
        "Go to <b>https://nodejs.org</b>",
        'Click the big green button that says <b>"LTS"</b> (Long Term Support)',
        "Run the downloaded installer",
        'Click <b>Next</b> through all the steps (default settings are fine)',
        "Click <b>Finish</b> when done",
    ]
    for i, step in enumerate(steps_1, 1):
        story.append(Paragraph(f"<b>{i}.</b> {step}", step_style))

    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "To verify: Open Command Prompt and type: node --version",
        note_style
    ))

    # ---- STEP 2 ----
    story.append(Paragraph("Step 2: Run the Setup Command", heading_style))
    story.append(Paragraph(
        "This single command downloads and installs everything automatically.",
        body_style
    ))
    story.append(Spacer(1, 4))

    steps_2 = [
        'Press <b>Windows key</b>, type <b>PowerShell</b>, and click to open it',
        "Copy and paste the command below into PowerShell:",
    ]
    for i, step in enumerate(steps_2, 1):
        story.append(Paragraph(f"<b>{i}.</b> {step}", step_style))

    story.append(Spacer(1, 6))

    # Command box
    cmd = (
        'Invoke-WebRequest -Uri "https://raw.githubusercontent.com/'
        'sanj2evk-star/levantage-POS/main/print-server/setup.bat"'
        ' -OutFile "$env:TEMP\\setup.bat"; &amp; "$env:TEMP\\setup.bat"'
    )
    cmd_data = [[Paragraph(cmd, ParagraphStyle(
        'CmdText', parent=code_style, fontSize=8.5, leading=12,
        textColor=white, backColor=None,
    ))]]
    cmd_table = Table(cmd_data, colWidths=[doc.width])
    cmd_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), HexColor("#1e293b")),
        ('BOX', (0, 0), (-1, -1), 1, HexColor("#334155")),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(cmd_table)
    story.append(Spacer(1, 6))

    story.append(Paragraph(
        "<b>3.</b> Press <b>Enter</b> and wait for it to finish",
        step_style
    ))
    story.append(Paragraph(
        "<b>4.</b> You should see <b>\"Setup Complete!\"</b> at the end",
        step_style
    ))
    story.append(Spacer(1, 6))

    # What it does box
    whatitdoes = [[Paragraph(
        "<b>What the setup does automatically:</b><br/>"
        "- Downloads print proxy files from GitHub<br/>"
        "- Installs to C:\\Users\\&lt;username&gt;\\LeVantage-PrintProxy\\<br/>"
        "- Installs Node.js dependencies<br/>"
        "- Adds auto-start on Windows boot (runs minimized)",
        ParagraphStyle('WhatText', parent=body_style, fontSize=10, leading=15)
    )]]
    what_table = Table(whatitdoes, colWidths=[doc.width])
    what_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), GREEN_LIGHT),
        ('BOX', (0, 0), (-1, -1), 1, GREEN),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(what_table)

    # ---- STEP 3 ----
    story.append(Paragraph("Step 3: Add Your Supabase Key", heading_style))
    story.append(Paragraph(
        "The print proxy needs your Supabase key to connect to the database and receive print jobs.",
        body_style
    ))
    story.append(Spacer(1, 4))

    steps_3 = [
        'Open <b>File Explorer</b> and go to:<br/>'
        '<font face="Courier" size="10">C:\\Users\\&lt;username&gt;\\LeVantage-PrintProxy\\</font>',
        'Find the file named <b>.env</b> and open it with <b>Notepad</b>',
        "You will see this:",
    ]
    for i, step in enumerate(steps_3, 1):
        story.append(Paragraph(f"<b>{i}.</b> {step}", step_style))

    story.append(Spacer(1, 4))
    env_content = (
        "SUPABASE_URL=https://ivhmvhnrxiodpneflszu.supabase.co<br/>"
        "SUPABASE_KEY=PASTE_YOUR_ANON_KEY_HERE"
    )
    env_data = [[Paragraph(env_content, ParagraphStyle(
        'EnvText', parent=code_style, fontSize=9, textColor=white, backColor=None,
    ))]]
    env_table = Table(env_data, colWidths=[doc.width])
    env_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), HexColor("#1e293b")),
        ('BOX', (0, 0), (-1, -1), 1, HexColor("#334155")),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(env_table)
    story.append(Spacer(1, 4))

    story.append(Paragraph(
        '<b>4.</b> Replace <font face="Courier" size="10">PASTE_YOUR_ANON_KEY_HERE</font> '
        'with your actual Supabase anon key (the long string starting with <b>eyJ...</b>)',
        step_style
    ))
    story.append(Paragraph(
        "<b>5.</b> Save the file (<b>Ctrl+S</b>) and close Notepad",
        step_style
    ))
    story.append(Spacer(1, 6))

    # Warning box
    warn_data = [[Paragraph(
        "<b>Where to find your Supabase Anon Key:</b><br/>"
        "Go to your Supabase Dashboard &gt; Settings &gt; API &gt; "
        'copy the <b>anon (public)</b> key. This is the same key used in your .env.local file.',
        ParagraphStyle('WarnText', parent=body_style, fontSize=10, leading=15)
    )]]
    warn_table = Table(warn_data, colWidths=[doc.width])
    warn_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), AMBER_LIGHT),
        ('BOX', (0, 0), (-1, -1), 1, AMBER),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(warn_table)

    # ---- STEP 4 ----
    story.append(Paragraph("Step 4: Start the Print Proxy", heading_style))

    steps_4 = [
        'Go to <font face="Courier" size="10">C:\\Users\\&lt;username&gt;\\LeVantage-PrintProxy\\</font>',
        "Double-click <b>start.bat</b>",
        'A black terminal window will open showing <b>"Listening for print jobs..."</b>',
        "Try printing a test bill from the POS app to verify it works",
    ]
    for i, step in enumerate(steps_4, 1):
        story.append(Paragraph(f"<b>{i}.</b> {step}", step_style))

    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "The print proxy will <b>auto-start</b> every time the laptop is turned on. "
        "You don't need to manually start it again.",
        body_style
    ))

    # ---- AUTO-UPDATE ----
    story.append(Paragraph("Auto-Update Feature", heading_style))
    story.append(Paragraph(
        "Every time start.bat runs, it automatically downloads the latest version "
        "of the print proxy from GitHub. This means any bug fixes or improvements "
        "will be applied automatically without any action needed.",
        body_style
    ))

    # ---- TROUBLESHOOTING ----
    story.append(Paragraph("Troubleshooting", heading_style))

    troubles = [
        [
            '"Node.js is not installed" error',
            "Download and install Node.js from https://nodejs.org (LTS version). "
            "Restart your computer after installing, then run setup again."
        ],
        [
            "Print proxy starts but prints don't come out",
            "Check that: (1) The laptop is on the same WiFi network as the printers. "
            "(2) The .env file has the correct Supabase key. "
            "(3) The printers are turned on and connected to the network."
        ],
        [
            "Terminal window closes immediately",
            "Open Command Prompt manually, navigate to the install folder, "
            'and type: <font face="Courier" size="10">node index.js</font> '
            "to see the error message."
        ],
        [
            "Want to stop auto-start",
            "Press Windows+R, type shell:startup, and delete the "
            "LeVantage-PrintProxy shortcut."
        ],
        [
            "Need to reinstall",
            "Delete the LeVantage-PrintProxy folder and run the setup command "
            "from Step 2 again."
        ],
    ]

    for problem, solution in troubles:
        story.append(KeepTogether([
            Paragraph(f"<b>Problem:</b> {problem}", ParagraphStyle(
                'ProblemStyle', parent=body_style, fontSize=10, textColor=RED,
                spaceBefore=8, spaceAfter=2,
            )),
            Paragraph(f"<b>Solution:</b> {solution}", ParagraphStyle(
                'SolutionStyle', parent=body_style, fontSize=10,
                leftIndent=15, spaceAfter=6,
            )),
        ]))

    # ---- QUICK REFERENCE ----
    story.append(Paragraph("Quick Reference Card", heading_style))

    ref_data = [
        [Paragraph("<b>Action</b>", bold_style),
         Paragraph("<b>How To</b>", bold_style)],
        [Paragraph("Start print proxy", body_style),
         Paragraph("Double-click start.bat", body_style)],
        [Paragraph("Stop print proxy", body_style),
         Paragraph("Close the terminal window (or Ctrl+C)", body_style)],
        [Paragraph("Check if running", body_style),
         Paragraph('Look for black terminal window saying "Listening..."', body_style)],
        [Paragraph("Disable auto-start", body_style),
         Paragraph("Win+R > shell:startup > delete shortcut", body_style)],
        [Paragraph("Re-enable auto-start", body_style),
         Paragraph("Run setup.bat again", body_style)],
        [Paragraph("Update manually", body_style),
         Paragraph("Just restart start.bat (it auto-updates)", body_style)],
        [Paragraph("Change Supabase key", body_style),
         Paragraph("Edit .env file in install folder", body_style)],
    ]

    ref_table = Table(ref_data, colWidths=[doc.width * 0.35, doc.width * 0.65])
    ref_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), AMBER),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, GRAY_LIGHT]),
        ('BOX', (0, 0), (-1, -1), 1, AMBER),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, HexColor("#e5e7eb")),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(ref_table)

    # ---- FOOTER ----
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=1, color=GRAY_LIGHT, spaceAfter=10))
    story.append(Paragraph(
        "Le Vantage Cafe - Print Proxy Setup Guide | Generated March 2026",
        ParagraphStyle('Footer', parent=body_style, fontSize=9, textColor=GRAY, alignment=TA_CENTER)
    ))

    doc.build(story)
    print(f"PDF created: {OUTPUT_FILE}")

if __name__ == "__main__":
    build_pdf()
