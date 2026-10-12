import asyncio
import json
import os
import re
import sys
import httpx

# Ensure UTF-8 output on Windows consoles
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Ensure backend root is in python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.src.core.database import async_session, init_db
from backend.src.models.mapping import SectionMapping
from sqlalchemy import select, func, delete

MAPPING_URL = "https://raw.githubusercontent.com/Tejanshu9/legal-mind/main/data/mapping_of_laws.json"
BNS_URL = "https://raw.githubusercontent.com/Tejanshu9/legal-mind/main/data/bns.json"
IPC_URL = "https://raw.githubusercontent.com/Tejanshu9/legal-mind/main/data/ipc.json"


def clean_str(val: str) -> str:
    if not val:
        return ""
    # Replace non-standard encoding artifacts
    cleaned = val.replace("\r\n", " ").replace("\n", " ").strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned


def parse_act_and_section(raw_str: str, default_act: str = "") -> tuple:
    """Parses 'BNS 101' -> ('BNS', '101') or 'IPC 302' -> ('IPC', '302')."""
    raw = clean_str(raw_str)
    if not raw:
        return (default_act, "")

    parts = raw.split(" ", 1)
    if len(parts) == 2 and parts[0].upper() in ["BNS", "BNSS", "BSA", "IPC", "CRPC", "IEA"]:
        return (parts[0].upper(), parts[1].strip())
    elif len(parts) == 1 and parts[0].upper() in ["BNS", "BNSS", "BSA", "IPC", "CRPC", "IEA"]:
        return (parts[0].upper(), "")
    else:
        return (default_act, raw)


async def download_and_ingest(reset: bool = True):
    print("=" * 60)
    print("[1/4] Downloading comprehensive Bare Acts dataset from GitHub...")
    print(f"URL: {MAPPING_URL}")
    print("=" * 60)

    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.get(MAPPING_URL)
        if res.status_code != 200:
            print(f"[ERROR] Failed to download dataset. Status: {res.status_code}")
            return
        raw_mappings = res.json()

    print(f"[OK] Downloaded {len(raw_mappings)} statutory cross-mappings from MHA/BPR&D records.")

    print("\n[2/4] Normalizing and cleaning section mappings...")
    normalized_list = []
    seen_keys = set()

    for item in raw_mappings:
        fields = item.get("fields", {})
        source_file = item.get("source_file", "")

        # Default acts based on source file
        def_new = "BNS"
        def_old = "IPC"
        if "BNSS" in source_file or "CrPC" in source_file:
            def_new = "BNSS"
            def_old = "CrPC"
        elif "BSA" in source_file or "IEA" in source_file:
            def_new = "BSA"
            def_old = "IEA"

        new_act, new_sec = parse_act_and_section(fields.get("New_Law_Section", ""), def_new)
        old_act, old_sec = parse_act_and_section(fields.get("Old_Law_Section", ""), def_old)
        subject = clean_str(fields.get("Subject", ""))
        summary = clean_str(fields.get("Summary_of_comparison", ""))

        if not new_sec and not old_sec:
            continue

        key = (old_act, old_sec, new_act, new_sec)
        if key in seen_keys:
            continue
        seen_keys.add(key)

        is_identical = (
            "identical" in summary.lower()
            or "same" in summary.lower()
            or "no change" in summary.lower()
            or "substantively similar" in summary.lower()
        )

        entry = {
            "old_act": old_act,
            "old_section": old_sec,
            "old_title": subject,
            "old_text": f"{old_act} Section {old_sec}: {subject}",
            "new_act": new_act,
            "new_section": new_sec,
            "new_title": subject,
            "new_text": f"{new_act} Section {new_sec}: {subject}",
            "mapping_notes": summary,
            "is_identical": is_identical,
        }
        normalized_list.append(entry)

    def natural_sort_key_entry(entry: dict):
        act_order = {
            "IPC": 1, "BNS": 1,
            "CRPC": 2, "BNSS": 2,
            "IEA": 3, "BSA": 3
        }
        old_act = entry.get("old_act", "").upper()
        act_rank = act_order.get(old_act, 9)

        sec_str = entry.get("old_section", "").strip() or entry.get("new_section", "").strip()
        m = re.match(r"^(\d+)(.*)", sec_str)
        if m:
            main_num = int(m.group(1))
            rest = m.group(2).strip()
            m_sub = re.search(r"\((\d+)\)", rest)
            sub_num = int(m_sub.group(1)) if m_sub else 0
            return (act_rank, main_num, sub_num, rest.lower())
        return (act_rank, 999998, 0, sec_str.lower())

    normalized_list.sort(key=natural_sort_key_entry)
    print(f"[OK] Normalized and sorted {len(normalized_list)} clean section entries in ascending order.")

    # Save to local file backend/data/section_mappings.json
    data_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "data",
        "section_mappings.json",
    )
    backup_path = data_path + ".bak"
    if os.path.exists(data_path):
        with open(data_path, "r", encoding="utf-8") as f_old:
            old_data = f_old.read()
        with open(backup_path, "w", encoding="utf-8") as f_bak:
            f_bak.write(old_data)
        print(f"[INFO] Backed up previous mappings to: {backup_path}")

    with open(data_path, "w", encoding="utf-8") as f:
        json.dump(normalized_list, f, indent=2, ensure_ascii=False)
    print(f"[OK] Updated local dataset in ascending numerical order: {data_path} ({len(normalized_list)} sections)")

    print("\n[3/4] Ingesting into Supabase PostgreSQL database...")
    await init_db()

    async with async_session() as session:
        if reset:
            print("[INFO] Resetting table: clearing old section_mapping entries...")
            await session.execute(delete(SectionMapping))
            await session.commit()
            print("[OK] Table cleared.")

        # Batch insert
        batch_size = 100
        total = len(normalized_list)
        inserted = 0
        act_counts = {}

        for idx in range(0, total, batch_size):
            batch = normalized_list[idx : idx + batch_size]
            for item in batch:
                mapping = SectionMapping(
                    old_act=item["old_act"],
                    old_section=item["old_section"],
                    old_title=item["old_title"],
                    old_text=item["old_text"],
                    new_act=item["new_act"],
                    new_section=item["new_section"],
                    new_title=item["new_title"],
                    new_text=item["new_text"],
                    mapping_notes=item["mapping_notes"],
                    is_identical=item["is_identical"],
                )
                session.add(mapping)
                pair = f"{item['old_act']} <-> {item['new_act']}"
                act_counts[pair] = act_counts.get(pair, 0) + 1
                inserted += 1

            await session.commit()
            print(f"  -> Uploaded {inserted}/{total} sections to Supabase...")

        total_in_db = (
            await session.execute(select(func.count(SectionMapping.id)))
        ).scalar() or 0

    print("\n" + "=" * 60)
    print(">>> [4/4] COMPLETE BARE ACT INGESTION COMPLETED! <<<")
    print("=" * 60)
    print(f"Total sections saved to Supabase: {total_in_db}")
    print("\nBreakdown by Act:")
    for pair, count in act_counts.items():
        print(f"  * {pair}: {count} statutory sections")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(download_and_ingest(reset=True))
