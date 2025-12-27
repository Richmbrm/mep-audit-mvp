export const STANDARDS_DB = {
    "ISO_14644": {
        "General": "ISO 14644-1 is the primary standard for Cleanrooms and associated controlled environments. Part 1 covers classification of air cleanliness by particle concentration.",
        "Part_1": {
            "ISO_5": "Maximum concentration of 3,520 particles/m³ (≥0.5µm). Equivalent to Class 100. Typical for sterile filling or surgical suites.",
            "ISO_7": "Maximum concentration of 352,000 particles/m³ (≥0.5µm). Equivalent to Class 10,000. Typical for life science prep areas.",
            "ISO_8": "Maximum concentration of 3,520,000 particles/m³ (≥0.5µm). Equivalent to Class 100,000. General laboratory prep."
        },
        "Part_3": {
            "Airflow_Test": "Verification that the air system is providing the required airflow rate and uniformity (HEPA filter face velocity).",
            "Pressure_Diff": "Requirement for pressure differentials between rooms to prevent cross-contamination. Positive pressure for sterile (min 10-15 Pa), Negative for containment (min -15 to -30 Pa)."
        }
    },
    "BS_EN_12469": {
        "Title": "Biotechnology - Performance criteria for microbiological safety cabinets.",
        "Requirement": "Ensures operator and environment protection for BSL-2 and BSL-3 labs. Requires specific inflow and downflow velocities."
    },
    "Failure_Modes": {
        "Low_ACH": {
            "Explanation": "Air Changes per Hour (ACH) are below standard. This increases the time needed to 'clean up' contaminants after an event.",
            "Regulatory_Ref": "ISO 14644-3 / GMP Annex 1",
            "Action": "Check fan static pressure, terminal unit damper positions, or HEPA filter loading."
        },
        "Low_Pressure": {
            "Explanation": "Pressure differential is insufficient to maintain the design hygiene envelope.",
            "Regulatory_Ref": "ISO 14644-1 / BSRIA BG 65",
            "Action": "Validate room airtightness, check door seals, and verify supply/exhaust balance."
        },
        "Negative_Pressure_Fail": {
            "Explanation": "Required negative pressure for bio-containment (BSL-3) is not maintained, risking aerosol escape.",
            " Regulatory_Ref": "ACDP / BS EN 12128",
            "Action": "IMMEDIATE ACTION REQUIRED. Inspect exhaust fan redundancy and secondary containment seals."
        }
    }
};
