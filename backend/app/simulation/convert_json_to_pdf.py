import os
import sys
import json
import tempfile
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable, Image
)

def render_charts(data: dict, temp_dir: str):
    """Renders high-resolution publication-quality matplotlib charts for embedding into PDF."""
    chart_paths = {}

    # Chart 1: Volume & Queue Dynamics Timeline
    timeline = data.get("trends", [])
    if timeline:
        times = [p.get("time", 0) for p in timeline]
        active_veh = [p.get("activeVehicles", 0) for p in timeline]
        comp_veh = [p.get("completedVehicles", 0) for p in timeline]
        speeds = [p.get("avgSpeed", 0) for p in timeline]

        fig, ax1 = plt.subplots(figsize=(7.2, 2.4), dpi=200)
        fig.patch.set_facecolor('#ffffff')
        ax1.set_facecolor('#f8fafc')

        ax1.plot(times, active_veh, color='#0284c7', linewidth=2, label='Active Corridor Vehicles')
        ax1.plot(times, comp_veh, color='#059669', linewidth=2, linestyle='--', label='Completed Trips')
        ax1.fill_between(times, active_veh, color='#0284c7', alpha=0.10)
        ax1.set_xlabel('Simulation Elapsed Time (Seconds)', fontsize=8, fontweight='bold', color='#334155')
        ax1.set_ylabel('Vehicle Count', fontsize=8, fontweight='bold', color='#334155')
        ax1.tick_params(axis='both', labelsize=7, colors='#64748b')
        ax1.grid(True, linestyle=':', alpha=0.6, color='#cbd5e1')

        ax2 = ax1.twinx()
        ax2.plot(times, speeds, color='#d97706', linewidth=1.5, label='Corridor Speed (km/h)')
        ax2.set_ylabel('Speed (km/h)', fontsize=8, fontweight='bold', color='#d97706')
        ax2.tick_params(axis='y', labelsize=7, colors='#d97706')

        lines1, labels1 = ax1.get_legend_handles_labels()
        lines2, labels2 = ax2.get_legend_handles_labels()
        ax1.legend(lines1 + lines2, labels1 + labels2, loc='upper left', fontsize=7, framealpha=0.9)
        plt.title('Real-Time Volume, Trip Completions & Speed Dynamics (5-Min Run)', fontsize=9, fontweight='bold', pad=8, color='#0f172a')
        plt.tight_layout()

        c1_path = os.path.join(temp_dir, "chart_timeline.png")
        plt.savefig(c1_path, dpi=200, bbox_inches='tight')
        plt.close()
        chart_paths["timeline"] = c1_path

    # Chart 2: Junction-by-Junction Speed & Delay Profile (Clean Abbreviated Names)
    bottlenecks = data.get("bottlenecks", [])
    if bottlenecks:
        name_map = {
            "SVNIT / Ichchhanath Circle": "SVNIT",
            "Ghod Dod Road Commercial Cross": "Ghod Dod",
            "Majura Gate BRTS Multi-Leg Hub": "Majura Gate",
            "Sahara Darwaja Railway Flyover": "Sahara Darwaja"
        }
        j_names = [name_map.get(b.get("location", ""), b.get("location", "").split("/")[0].strip()) for b in bottlenecks]
        j_scores = [b.get("score", 0) for b in bottlenecks]
        j_speeds = [b.get("avgSpeedKmh", 25.0) for b in bottlenecks]

        fig, ax = plt.subplots(figsize=(7.2, 2.2), dpi=200)
        fig.patch.set_facecolor('#ffffff')
        ax.set_facecolor('#f8fafc')

        x = range(len(j_names))
        width = 0.32

        ax.bar([i - width/2 for i in x], j_scores, width, label='Congestion Score (0-100)', color='#ef4444', alpha=0.85)
        ax.bar([i + width/2 for i in x], j_speeds, width, label='Corridor Speed (km/h)', color='#10b981', alpha=0.85)

        ax.set_xlabel('Corridor Junctions (West to East)', fontsize=8, fontweight='bold', color='#334155')
        ax.set_xticks(list(x))
        ax.set_xticklabels(j_names, fontsize=8, fontweight='bold', color='#1e293b')
        ax.tick_params(axis='y', labelsize=7, colors='#64748b')
        ax.legend(loc='upper right', fontsize=7, framealpha=0.9)
        ax.grid(axis='y', linestyle=':', alpha=0.6, color='#cbd5e1')
        plt.title('Junction Congestion Severity & Average Travel Speed Profile', fontsize=9, fontweight='bold', pad=8, color='#0f172a')
        plt.tight_layout()

        c2_path = os.path.join(temp_dir, "chart_junctions.png")
        plt.savefig(c2_path, dpi=200, bbox_inches='tight')
        plt.close()
        chart_paths["junctions"] = c2_path

    return chart_paths

def generate_pdf_from_json(json_path: str, output_pdf_path: str):
    """Compiles a complete 2-page executive engineering PDF report with embedded charts."""
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    temp_dir = tempfile.mkdtemp()
    chart_paths = render_charts(data, temp_dir)

    doc = SimpleDocTemplate(
        output_pdf_path,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=30,
        bottomMargin=30
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#0f172a')
    )

    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#64748b')
    )

    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor('#1e293b'),
        spaceBefore=8,
        spaceAfter=4
    )

    body_style = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor('#334155')
    )

    bold_cell_style = ParagraphStyle(
        'BoldCell',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#0f172a')
    )

    header_style = ParagraphStyle(
        'HeaderCell',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#ffffff')
    )

    kpi_val_style = ParagraphStyle(
        'KPIValue',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=16,
        textColor=colors.HexColor('#059669'),
        alignment=1
    )

    kpi_lbl_style = ParagraphStyle(
        'KPILabel',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=9,
        textColor=colors.HexColor('#64748b'),
        alignment=1
    )

    elements = []

    # ================= PAGE 1 =================
    # 1. Header Banner
    header_data = [
        [
            Paragraph("<b>E-RAKSHAK: SURAT SMART TRAFFIC COMMAND</b>", title_style),
            Paragraph(f"<b>Run ID:</b> {data.get('runId', 'N/A')}<br/><b>Date:</b> {data.get('generatedAt', '')[:10]}", subtitle_style)
        ]
    ]
    t_header = Table(header_data, colWidths=[380, 160])
    t_header.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(t_header)
    elements.append(Paragraph("5-Minute SUMO Micro-Simulation & Ground-Truth Adaptive Analytics Report", subtitle_style))
    elements.append(Spacer(1, 4))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#059669'), spaceBefore=2, spaceAfter=6))

    # Configuration Metadata Box
    cfg = data.get('configuration', {})
    meta_text = (
        f"<b>Corridor:</b> {cfg.get('networkCorridor', 'N/A')}<br/>"
        f"<b>Policy:</b> {cfg.get('scenarioName', 'N/A')}  |  "
        f"<b>Demand:</b> {cfg.get('demandLevel', '').upper()} ({cfg.get('spawnRate', 0)} veh/min)  |  "
        f"<b>Duration:</b> {cfg.get('simulationDuration', 0):.0f}s (3,000 steps)"
    )
    meta_box = Table([[Paragraph(meta_text, body_style)]], colWidths=[540])
    meta_box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('PADDING', (0, 0), (-1, -1), 5),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e1')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(meta_box)
    elements.append(Spacer(1, 6))

    # 2. Executive KPI Cards (6 Top KPIs Matching Dashboard)
    kpis = data.get('kpis', {})
    kpi_cards_row1 = [
        Table([[Paragraph(f"{kpis.get('throughputVph', 0):.1f} <font size=7>vph</font>", kpi_val_style)], [Paragraph("THROUGHPUT CAPACITY", kpi_lbl_style)]], colWidths=[175]),
        Table([[Paragraph(f"{kpis.get('avgSpeedKmh', 0):.1f} <font size=7>km/h</font>", kpi_val_style)], [Paragraph("CORRIDOR SPEED", kpi_lbl_style)]], colWidths=[175]),
        Table([[Paragraph(f"{kpis.get('avgWaitTimeSec', 0):.1f} <font size=7>sec</font>", kpi_val_style)], [Paragraph("AVERAGE DELAY", kpi_lbl_style)]], colWidths=[175]),
    ]
    kpi_cards_row2 = [
        Table([[Paragraph(f"{kpis.get('maxQueueVehicles', 0)} <font size=7>veh</font>", kpi_val_style)], [Paragraph("PEAK QUEUE", kpi_lbl_style)]], colWidths=[175]),
        Table([[Paragraph(f"{kpis.get('totalCO2Kg', 0):.1f} <font size=7>kg</font>", kpi_val_style)], [Paragraph("CO2 GENERATED", kpi_lbl_style)]], colWidths=[175]),
        Table([[Paragraph(f"{kpis.get('fuelSavedLiters', 0):.1f} <font size=7>Liters</font>", kpi_val_style)], [Paragraph("FUEL SAVED", kpi_lbl_style)]], colWidths=[175]),
    ]

    t_kpis = Table([kpi_cards_row1, kpi_cards_row2], colWidths=[180, 180, 180], rowHeights=[45, 45])
    t_kpis.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#ffffff')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
        ('PADDING', (0, 0), (-1, -1), 4),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(t_kpis)
    elements.append(Spacer(1, 10))

    # 4. Ground-Truth What-If Comparison Table
    whatif = data.get('whatIfComparison', {})
    baseline = whatif.get('baseline', {})
    opt = whatif.get('optimized', {})
    imp = whatif.get('improvements', {})

    elements.append(Paragraph("1. Ground-Truth Scenario Comparison (Adaptive Control vs Fixed-Time Baseline)", h2_style))

    # Clean format deltas
    tp_pct = imp.get('throughputGainPct', 0)
    spd_pct = imp.get('speedIncreasePct', 0)
    wait_pct = imp.get('waitReductionPct', 0)
    queue_pct = imp.get('queueReductionPct', 0)
    co2_pct = imp.get('co2ReductionPct', 0)

    tp_str = f"+{tp_pct:.1f}%" if tp_pct >= 0 else f"{tp_pct:.1f}%"
    spd_str = f"+{spd_pct:.1f}%" if spd_pct >= 0 else f"{spd_pct:.1f}%"
    wait_str = f"-{abs(wait_pct):.1f}%" if wait_pct >= 0 else f"+{abs(wait_pct):.1f}%"
    queue_str = f"-{abs(queue_pct):.1f}%" if queue_pct >= 0 else f"+{abs(queue_pct):.1f}%"
    co2_str = f"-{abs(co2_pct):.1f}%" if co2_pct >= 0 else f"+{abs(co2_pct):.1f}%"

    comp_data = [
        [
            Paragraph("<b>Performance Metric</b>", header_style),
            Paragraph("<b>Fixed-Time Baseline</b>", header_style),
            Paragraph("<b>Adaptive Control</b>", header_style),
            Paragraph("<b>Net Benefit</b>", header_style)
        ],
        [
            Paragraph("Throughput Capacity", body_style),
            Paragraph(f"{baseline.get('throughput', 0):.1f} vph", body_style),
            Paragraph(f"{opt.get('throughput', 0):.1f} vph", bold_cell_style),
            Paragraph(f"<font color='#059669'><b>{tp_str}</b></font>", bold_cell_style)
        ],
        [
            Paragraph("Average Corridor Speed", body_style),
            Paragraph(f"{baseline.get('avgSpeed', 0):.1f} km/h", body_style),
            Paragraph(f"{opt.get('avgSpeed', 0):.1f} km/h", bold_cell_style),
            Paragraph(f"<font color='#059669'><b>{spd_str}</b></font>", bold_cell_style)
        ],
        [
            Paragraph("Average Intersection Delay", body_style),
            Paragraph(f"{baseline.get('avgWait', 0):.1f} s", body_style),
            Paragraph(f"{opt.get('avgWait', 0):.1f} s", bold_cell_style),
            Paragraph(f"<font color='#059669'><b>{wait_str}</b></font>", bold_cell_style)
        ],
        [
            Paragraph("Peak Corridor Queue", body_style),
            Paragraph(f"{baseline.get('maxQueue', 0)} veh", body_style),
            Paragraph(f"{opt.get('maxQueue', 0)} veh", bold_cell_style),
            Paragraph(f"<font color='#059669'><b>{queue_str}</b></font>", bold_cell_style)
        ],
        [
            Paragraph("Total CO2 Emissions", body_style),
            Paragraph(f"{baseline.get('totalCO2Kg', 0):.1f} kg", body_style),
            Paragraph(f"{opt.get('totalCO2Kg', 0):.1f} kg", bold_cell_style),
            Paragraph(f"<font color='#059669'><b>{co2_str}</b></font>", bold_cell_style)
        ]
    ]

    t_comp = Table(comp_data, colWidths=[175, 125, 130, 110])
    t_comp.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#ffffff'), colors.HexColor('#f8fafc')]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(t_comp)
    elements.append(Spacer(1, 6))

    # 5. Embedded Timeline Plot
    if "timeline" in chart_paths:
        elements.append(Image(chart_paths["timeline"], width=540, height=180))

    # ================= PAGE 2 =================
    elements.append(PageBreak())

    # 6. Embedded Junction Bar Chart
    elements.append(Paragraph("2. Corridor Junction Performance & Bottleneck Analysis", h2_style))
    if "junctions" in chart_paths:
        elements.append(Image(chart_paths["junctions"], width=540, height=165))
        elements.append(Spacer(1, 6))

    # 7. 4-Junction Operational Performance & Level of Service
    junctions = data.get('junctions', {})
    if junctions:
        j_data = [
            [
                Paragraph("<b>Junction Corridor Node</b>", header_style),
                Paragraph("<b>Throughput</b>", header_style),
                Paragraph("<b>Avg Delay</b>", header_style),
                Paragraph("<b>HCM LOS</b>", header_style),
                Paragraph("<b>Avg Speed</b>", header_style),
                Paragraph("<b>Max Queue</b>", header_style),
                Paragraph("<b>Phase Split (EW/NS)</b>", header_style)
            ]
        ]
        for jid, j_item in junctions.items():
            los_color = '#059669' if j_item.get('levelOfService') in ['A', 'B'] else '#d97706' if j_item.get('levelOfService') in ['C', 'D'] else '#dc2626'
            ps = j_item.get('phaseSplit', {})
            j_data.append([
                Paragraph(f"<b>{j_item.get('shortName', jid)}</b>", bold_cell_style),
                Paragraph(f"{j_item.get('throughputVph', 0):.0f} vph", body_style),
                Paragraph(f"{j_item.get('avgDelaySec', 0):.1f} s", body_style),
                Paragraph(f"<font color='{los_color}'><b>LOS {j_item.get('levelOfService', 'A')}</b></font>", bold_cell_style),
                Paragraph(f"{j_item.get('avgSpeedKmh', 0):.1f} km/h", body_style),
                Paragraph(f"{j_item.get('maxQueueVehicles', 0)} veh", body_style),
                Paragraph(f"{ps.get('ewGreenPct', 50):.0f}% / {ps.get('nsGreenPct', 50):.0f}%", body_style)
            ])

        t_junc = Table(j_data, colWidths=[125, 65, 55, 55, 60, 60, 120])
        t_junc.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
            ('TOPPADDING', (0, 0), (-1, -1), 2.5),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#ffffff'), colors.HexColor('#f8fafc')]),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(t_junc)
        elements.append(Spacer(1, 6))

    # 8. Dynamic Bottleneck Hotspots Table
    bottlenecks = data.get('bottlenecks', [])
    bot_data = [
        [
            Paragraph("<b>Rank</b>", header_style),
            Paragraph("<b>Junction Location</b>", header_style),
            Paragraph("<b>Score</b>", header_style),
            Paragraph("<b>Speed</b>", header_style),
            Paragraph("<b>Delay</b>", header_style),
            Paragraph("<b>Severity</b>", header_style),
            Paragraph("<b>Quantitative Root Cause & Sensor Telemetry</b>", header_style)
        ]
    ]
    for b in bottlenecks:
        sev_color = '#dc2626' if b.get('severity') == 'Critical' else '#d97706' if b.get('severity') == 'High' else '#2563eb'
        bot_data.append([
            Paragraph(f"#{b.get('rank')}", bold_cell_style),
            Paragraph(f"<b>{b.get('location')}</b>", body_style),
            Paragraph(f"{b.get('score', 0):.0f}/100", bold_cell_style),
            Paragraph(f"{b.get('avgSpeedKmh', 25.0):.1f} km/h", body_style),
            Paragraph(f"{b.get('avgDelay')}", body_style),
            Paragraph(f"<font color='{sev_color}'><b>{b.get('severity')}</b></font>", bold_cell_style),
            Paragraph(f"{b.get('primaryFactor', '')}", body_style)
        ])

    t_bot = Table(bot_data, colWidths=[35, 125, 45, 50, 45, 50, 190])
    t_bot.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#ffffff'), colors.HexColor('#f8fafc')]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(t_bot)
    elements.append(Spacer(1, 6))

    # 8. Data-Driven Contextual Recommendations
    recs = data.get('recommendations', [])
    elements.append(Paragraph("3. Contextual Engineering Recommendations", h2_style))

    rec_data = [
        [
            Paragraph("<b>Code</b>", header_style),
            Paragraph("<b>Category</b>", header_style),
            Paragraph("<b>Action Plan & Engineering Specification</b>", header_style),
            Paragraph("<b>Target Location</b>", header_style),
            Paragraph("<b>Impact</b>", header_style)
        ]
    ]
    for r in recs:
        rec_data.append([
            Paragraph(f"<b>{r.get('id')}</b>", bold_cell_style),
            Paragraph(f"{r.get('category', '')}", body_style),
            Paragraph(f"<b>{r.get('title')}</b><br/><font color='#475569'>{r.get('description')}</font>", body_style),
            Paragraph(f"{r.get('targetLocation', '')}", body_style),
            Paragraph(f"<b>{r.get('impact')}</b>", bold_cell_style)
        ])

    t_recs = Table(rec_data, colWidths=[45, 80, 250, 115, 50])
    t_recs.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#ffffff'), colors.HexColor('#f8fafc')]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(t_recs)

    doc.build(elements)
    print(f"[SUCCESS] Converted JSON to Pristine 2-Page PDF: {output_pdf_path}")

if __name__ == "__main__":
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    json_file = sys.argv[1] if len(sys.argv) > 1 else os.path.join(backend_dir, "app", "simulation_runs", "SIM_1786864948.json")
    pdf_file = sys.argv[2] if len(sys.argv) > 2 else os.path.join(backend_dir, "app", "simulation_runs", "SIM_1786864948_report.pdf")
    generate_pdf_from_json(json_file, pdf_file)
