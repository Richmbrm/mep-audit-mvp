export const STANDARDS_DB = {
    "ISO_14644_SERIES": {
        "ISO_14644_1_Classification": {
            "ISO_1": "Ultrapure environment. Max 10 particles/m³ at 0.1μm. Restricted to semiconductor nanoscience.",
            "ISO_2": "Max 100 particles/m³ at 0.1μm. Critical micro-manufacturing.",
            "ISO_3_Class_1": "Max 35 particles/m³ at 0.5μm. High-end microelectronics manufacturing.",
            "ISO_4_Class_10": "Max 352 particles/m³ at 0.5μm. Semiconductor and precision electronics.",
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
        "Clinical_Labs": "Minimum 12-15 ACH for BSL-3, 6-12 ACH for general clinical labs.",
        "OR_Operating_Theatres": "Minimum 20 ACH for infection control, with 100% fresh air often required.",
        "ASHRAE_62_1": "General ventilation standard for acceptable indoor air quality. Defines minimum CFM per person and square footage."
    },
    "PRESSURE_HIEARCHY_PH": {
        "Sterile_Positive": "Min +15 Pa vs corridor. Flow: High Pressure -> Low Pressure. Prevents infiltration.",
        "Containment_Negative": "Min -15 Pa vs corridor. Flow: Ambient -> Contained space. Prevents escape of agents.",
        "Pressure_Cascade": "Sequential pressure steps (e.g., Room +30Pa -> Airlock +15Pa -> Corridor 0Pa).",
        "Airlocks": {
            "Bubble_Airlock": "Airlock is at higher pressure than both surrounding rooms. Prevents cross-contamination between rooms.",
            "Sink_Airlock": "Airlock is at lower pressure than both surrounding rooms. Typical for toxic containment.",
            "Cascade_Airlock": "Pressure flows in one direction from clean to less clean via steps."
        }
    },
    "FILTER_TYPES_AND_HVAC": {
        "HEPA_H13": "99.95% efficiency for 0.3μm particles. Standard for ISO 7-8 labs.",
        "HEPA_H14": "99.995% efficiency for 0.3μm particles. Critical sterile environments (ISO 5).",
        "ULPA_U15": "99.9995% efficiency. Used for electronics and ISO 1-3 applications.",
        "Pre_Filters": "E.g., G4 or F7. Extended the life of expensive HEPA filters by trapping large lint/dust.",
        "Filter_Face_Velocity": "Typically 0.45 m/s (90 fpm) for laminar flow ISO 5 hoods.",
        "VAV_Tracking": "Volumetric tracking where Supply Air - Exhaust Air = Constant Offset (for room pressure)."
    },
    "LAB_SAFETY_CODES": {
        "BS_EN_12469": "Standard for Microbiological Safety Cabinets (MSCs). Class II cabinets are most common.",
        "ACDP_Guidelines": "Advisory Committee on Dangerous Pathogens. Categorizes BSL 1-4 containment requirements.",
        "Duct_Leakage_DW144": "Requirement for cleanroom supply ductwork to prevent air loss. Usually Class C or D (high pressure)."
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
        },
        "High_Temperature": {
            "Cause": "Cooling coil valve stuck or reheat system failure.",
            "Action": "Check chilled water flow and actuator functionality."
        }
    }
};
