export const STANDARDS_DB = {
    "ISO_14644_SERIES": {
        "ISO_14644_1_Classification": {
            "ISO_1": "Ultrapure environment. Max 10 particles/m³ at 0.1μm. Restricted to semiconductor nanoscience.",
            "ISO_3_Class_1": "Max 35 particles/m³ at 0.5μm. High-end microelectronics manufacturing.",
            "ISO_5_Class_100": "Max 3,520 particles/m³ at 0.5μm. Standard for sterile drug compounding and filling.",
            "ISO_6_Class_1000": "Max 35,200 particles/m³ at 0.5μm. Precision engineering and optics assembly.",
            "ISO_7_Class_10000": "Max 352,000 particles/m³ at 0.5μm. General biopharmaceutical prep and surgical device assembly.",
            "ISO_8_Class_100000": "Max 3,520,000 particles/m³ at 0.5μm. Final packaging of sterile goods, general industrial cleanroom.",
            "ISO_9": "Max 35,200,000 particles/m³ at 0.5μm. Standard ambient air for controlled non-clean environments."
        },
        "ISO_14644_2_Monitoring": "Establishes monitoring requirements for particles and pressure to ensure 'In-Operation' compliance. Recommends risk-based frequency for filter leak testing.",
        "ISO_14644_3_Testing": "Defines test methods for airflow, pressure, leak detection, and recovery time. The 100:1 recovery test proves how fast a room clears contaminants.",
        "ISO_14644_4_Design": "Detailed guidance on cleanroom architecture. Emphasizes air showers, material pass-throughs, and gowning protocols."
    },
    "AIR_CHANGE_RATES_ACH": {
        "ISO_5_Rec": "Typically 240 - 480 Air Changes per Hour (Laminar flow recommended).",
        "ISO_6_Rec": "Typically 150 - 240 Air Changes per Hour.",
        "ISO_7_Rec": "Typically 60 - 90 Air Changes per Hour.",
        "ISO_8_Rec": "Typically 10 - 25 Air Changes per Hour.",
        "Clinical_Labs": "Minimum 6-12 ACH depending on hazardous material handled.",
        "OR_Operating_Theatres": "Minimum 20 ACH for infection control."
    },
    "PRESSURE_HIEARCHY_PH": {
        "Sterile_Positive": "Min +15 Pa vs corridor. Flow: High Pressure -> Low Pressure.",
        "Containment_Negative": "Min -15 Pa vs corridor. Flow: Ambient -> Contained space.",
        "Airlocks": {
            "Bubble_Airlock": "Airlock is at higher pressure than both surrounding rooms. Prevents cross-contamination.",
            "Sink_Airlock": "Airlock is at lower pressure than both surrounding rooms. Typical for toxic containment.",
            "Cascade_Airlock": "Sequential pressure steps (e.g., +15 Pa -> +30 Pa -> +45 Pa)."
        }
    },
    "FILTER_TYPES_HEPA": {
        "H13": "99.95% efficiency for 0.3μm particles. Standard for ISO 7-8 labs.",
        "H14": "99.995% efficiency for 0.3μm particles. Critical sterile environments (ISO 5).",
        "U15_ULPA": "99.9995% efficiency. Used for electronics and ISO 1-3 applications.",
        "Maintenance": "Replace filters when pressure drop (ΔP) across the filter doubles its clean state value."
    },
    "HVAC_AND_MEP_MECHANICAL": {
        "Duct_Leakage": "DW/144 Class C is the requirement for cleanroom supply ductwork to prevent air loss.",
        "VAV_Systems": "Variable Air Volume controllers maintain constant room pressure as filter loading increases.",
        "Humidification": "Cleanrooms typically targeted at 45-55% RH to prevent static discharge (low) or microbial growth (high)."
    },
    "FAILURE_ANALYSIS_MODES": {
        "Particle_Exceedance": {
            "Cause": "Filter gasket leak or bypass, torn gowning, or excessive personnel in room.",
            "Action": "Perform smoke pattern test and re-validate HEPA integrity."
        },
        "ACH_Variance": {
            "Cause": "Fan speed controller (VFD) failure or blocked intake dampers.",
            "Action": "Check BMS fan status and verify airflow sensor calibration."
        },
        "Cross_Contamination": {
            "Cause": "Pressure reversal because of door left open or exhaust fan failure.",
            "Action": "Verify interlock timing on airlocks and check door sweep seals."
        }
    }
};
