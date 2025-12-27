import csv
import os
import sys
import json
import glob
from datetime import datetime

# Fallback for thermal comfort if library is missing
try:
    from pythermalcomfort.models import pmv_ppd
except ImportError:
    def pmv_ppd(tdb, tr, vr, rh, met, clo):
        # Very simplified mock PMV calculation: optimal range 20-24C
        pmv = (tdb - 22) / 2
        return {'pmv': pmv}

class LabMEPAgent:
    def __init__(self, room_data=None):
        self.rooms = room_data or []
        self.standards = {
            "ISO_7": {"min_ach": 30, "max_ach": 65, "pressure_pa": 15},
            "ISO_8": {"min_ach": 10, "max_ach": 25, "pressure_pa": 10},
            "BSL_3": {"min_ach": 12, "pressure_pa": -30}
        }

    def validate_ventilation(self, room):
        """Calculates Air Changes per Hour (ACH) and checks vs Standards"""
        volume = room['area'] * room['height']
        calc_ach = (room['supply_airflow_m3h']) / volume
        
        target = self.standards.get(room['class'], {})
        status = "PASS" if calc_ach >= target.get('min_ach', 0) else "FAIL"
        
        return {
            "room_name": room['name'],
            "calculated_ach": round(calc_ach, 2),
            "required_min": target.get('min_ach'),
            "status": status
        }

    def check_thermal_comfort(self, room):
        """Calculates PMV (Predicted Mean Vote) for lab occupants"""
        res = pmv_ppd(tdb=room['temp'], tr=room['temp'], vr=0.1, rh=room['humidity'], met=1.2, clo=0.7)
        return "Optimal" if abs(res['pmv']) < 0.5 else "Sub-optimal"

    def validate_equipment(self, equipment_row):
        """Validates MEP equipment based on schedule data"""
        category = equipment_row.get('Category', '')
        mark = equipment_row.get('Mark', '')
        status = "PASS"
        issues = []

        # Example validation rules
        try:
            if category == 'Fan':
                sp_str = equipment_row.get('Static Pressure (in wg)', '0')
                sp = float(sp_str) if sp_str and sp_str != '-' else 0
                if sp <= 0:
                    status = "FAIL"
                    issues.append("Zero/Missing static pressure")
            
            if category == 'Pump':
                flow_str = equipment_row.get('Flow Rate (GPM)', '0')
                flow = float(flow_str) if flow_str and flow_str != '-' else 0
                if flow <= 0:
                    status = "FAIL"
                    issues.append("Missing flow rate")
        except ValueError:
            status = "FAIL"
            issues.append("Invalid numeric data")

        power = equipment_row.get('Power (V/PH/Hz)', '')
        if not power or '/' not in power:
            status = "FAIL"
            issues.append("Invalid power format")

        return {
            "mark": mark,
            "category": category,
            "status": status,
            "issues": ", ".join(issues) if issues else "None"
        }

def load_rooms_from_csv(file_path):
    rooms = []
    if os.path.exists(file_path):
        try:
            with open(file_path, mode='r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    # Convert numeric strings to floats/ints
                    try:
                        processed_row = {
                            "name": row.get('name', 'Unknown'),
                            "class": row.get('class', 'ISO_8'),
                            "area": float(row.get('area', 0)),
                            "height": float(row.get('height', 0)),
                            "supply_airflow_m3h": float(row.get('supply_airflow_m3h', 0)),
                            "temp": float(row.get('temp', 22)),
                            "humidity": float(row.get('humidity', 50))
                        }
                        rooms.append(processed_row)
                    except ValueError:
                        continue
        except Exception as e:
            print(f"Error loading rooms: {e}")
    return rooms

def load_equipment_from_csv(file_path):
    equipment_data = []
    if os.path.exists(file_path):
        try:
            # Try utf-8-sig first (covers Excel-exported CSVs with BOM)
            with open(file_path, mode='r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    equipment_data.append(row)
        except UnicodeDecodeError:
            # Fallback to latin-1 if utf-8 fails (common for older Excel formats or special chars)
            with open(file_path, mode='r', encoding='latin-1') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    equipment_data.append(row)
    return equipment_data

def get_next_audit_paths(base_dir):
    if not os.path.exists(base_dir):
        os.makedirs(base_dir)
    
    count = 1
    while True:
        base_name = f"audit_{count}"
        txt_path = os.path.join(base_dir, f"{base_name}.txt")
        json_path = os.path.join(base_dir, f"{base_name}.json")
        if not os.path.exists(txt_path) and not os.path.exists(json_path):
            return txt_path, json_path
        count += 1

class Logger(object):
    def __init__(self, filename):
        self.terminal = sys.stdout
        self.log = open(filename, "a")

    def write(self, message):
        self.terminal.write(message)
        self.log.write(message)

    def flush(self):
        self.terminal.flush()
        self.log.flush()

import argparse

def interactive_setup(project_dir):
    print("\n" + "="*60)
    print("--- MEP AUDIT AGENT SETUP ---")
    print("="*60)
    
    # 1. Choose Input File
    csv_files = glob.glob(os.path.join(project_dir, "*.csv"))
    selected_csv = ""
    
    if not csv_files:
        print("[!] No CSV files found in directory.")
        selected_csv = input("Enter path to input CSV: ").strip()
    else:
        print("\nAvailable input files:")
        for i, f in enumerate(csv_files, 1):
            print(f" {i}. {os.path.basename(f)}")
        
        choice = input(f"\nSelect a file (1-{len(csv_files)}) or enter manual path: ").strip()
        if choice.isdigit() and 1 <= int(choice) <= len(csv_files):
            selected_csv = csv_files[int(choice)-1]
        else:
            selected_csv = choice

    # 2. Job Reference
    job_ref = input("\nEnter Job Reference ID (e.g., PROJ-101): ").strip()
    if not job_ref:
        job_ref = "UNREFERENCED"

    return selected_csv, job_ref

# --- Main Report Execution ---
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MEP Audit Agent")
    parser.add_argument("--file", help="Path to the input CSV file")
    parser.add_argument("--job", help="Job Reference ID")
    args = parser.parse_args()

    project_dir = os.path.dirname(os.path.abspath(__file__))
    
    if args.file and args.job:
        csv_path = args.file
        job_reference = args.job
        print(f"Running in HEADLESS mode...")
    else:
        # Interactive Inputs
        csv_path, job_reference = interactive_setup(project_dir)

    # Setup Paths
    audit_dir = os.path.join(project_dir, "audit runs")
    audit_txt, audit_json = get_next_audit_paths(audit_dir)
    
    # Setup TXT Logging (Redirects stdout)
    sys.stdout = Logger(audit_txt)

    # Prepare JSON Data Structure
    audit_data = {
        "job_reference": job_reference,
        "run_date": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "input_file": os.path.basename(csv_path),
        "rooms": [],
        "equipment": []
    }

    print(f"\nJOB REFERENCE: {job_reference}")
    print(f"INPUT FILE: {os.path.basename(csv_path)}")
    print(f"RUN DATE: {audit_data['run_date']}")
    print(f"AUDIT LOGS: \n - {audit_txt}\n - {audit_json}\n")

    # Room Data Logic (Dynamically loaded from RoomSchedule.csv)
    room_csv_path = os.path.join(project_dir, "RoomSchedule.csv")
    project_data = load_rooms_from_csv(room_csv_path)
    
    if not project_data:
        print("[!] No room data found. Check RoomSchedule.csv")
        # Fallback to empty list or basic structure
        project_data = []

    agent = LabMEPAgent(project_data)
    
    print("="*60)
    print("--- MEP VALIDATION REPORT (ISO 14644-1 COMPLIANCE) ---")
    print("="*60)
    for room in project_data:
        report = agent.validate_ventilation(room)
        comfort = agent.check_thermal_comfort(room)
        print(f"Room: {report['room_name']:<25} | ACH: {report['calculated_ach']:>6} | Status: {report['status']:<4} | Comfort: {comfort}")
        
        # Add to JSON
        audit_data["rooms"].append({
            "name": report["room_name"],
            "ach": report["calculated_ach"],
            "status": report["status"],
            "comfort": comfort
        })

    # Equipment Data Logic
    equipment_list = load_equipment_from_csv(csv_path)
    
    if equipment_list:
        print("\n" + "="*60)
        print("--- EQUIPMENT SCHEDULE VALIDATION ---")
        print("="*60)
        print(f"{'Mark':<10} | {'Category':<15} | {'Status':<6} | {'Issues'}")
        print("-" * 60)
        for equip in equipment_list:
            res = agent.validate_equipment(equip)
            print(f"{res['mark']:<10} | {res['category']:<15} | {res['status']:<6} | {res['issues']}")
            
            # Add to JSON
            audit_data["equipment"].append(res)
    else:
        print(f"\n[!] No equipment data found in: {os.path.basename(csv_path)}")

    # Save JSON Audit
    with open(audit_json, 'w') as jf:
        json.dump(audit_data, jf, indent=4)

    print("\n" + "="*60)
    print(f"Report complete for Job: {job_reference}")
    print(f"Audits saved to:\n - {audit_txt}\n - {audit_json}")
    print("="*60)
